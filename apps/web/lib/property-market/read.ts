import "server-only";

import { todayIsoLocal } from "@finance/core/constants";
import {
  dvfFileUrl,
  dvfSales,
  marketReading,
  MARKET_RULES,
  readDvfCsv,
  readDvfYears,
  type DvfSale,
} from "@finance/core/market-reading";
import {
  carryToLatest,
  INDEX_SERIES,
  inseeIndexUrl,
  priceIndexFromRows,
  quarterOf,
  readInseeIndex,
  seriesFor,
  type PriceIndex,
} from "@finance/core/price-index";
import { estimatedValue, type MarketContext } from "@finance/core/property";
import { halfYearOf, isNewRelease } from "@finance/core/property-moments";
import type { Db } from "@finance/data/client";
import * as properties from "@finance/data/properties";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPropertyRent } from "./rent";

/**
 * What the market says about a property, read on the web server: Etalab's
 * DVF files for its commune, INSEE's price index to carry each sale to the
 * latest quarter, and core's reading of the two. Kept on the property's own
 * row (migration 050) — through the user's client when the user asked, or
 * the service role from the weekly market cron.
 *
 * A let property's asking rents are read alongside (`./rent.ts`).
 *
 * Only public files are fetched, and nothing about the user is sent: a
 * commune's file is the same file for anyone who asks for it.
 */

const DVF_LISTING = "https://files.data.gouv.fr/geo-dvf/latest/csv/";

/** Twice a year Etalab adds a year; half a day of memory is plenty. */
const YEARS_TTL_MS = 12 * 60 * 60 * 1000;
let yearsCache: { at: number; years: number[] } | null = null;

/** The first quarter the index is kept from. */
const INDEX_START = "2010-Q1";

/**
 * A file's text, or null when there is none — a commune with no sale that
 * year has no file. Anything else that goes wrong throws, so a reading is
 * never replaced by "none" because a server was slow.
 */
async function fetchText(
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response.text();
}

async function dvfYears(): Promise<number[]> {
  if (yearsCache && Date.now() - yearsCache.at < YEARS_TTL_MS) {
    return yearsCache.years;
  }
  const listing = await fetchText(DVF_LISTING, 10_000);
  const years = listing ? readDvfYears(listing) : [];
  if (years.length > 0) {
    yearsCache = { at: Date.now(), years };
  }
  return years;
}

async function communeSales(
  citycode: string,
  years: readonly number[],
): Promise<DvfSale[]> {
  const files = await Promise.all(
    years.map((year) => fetchText(dvfFileUrl(citycode, year), 20_000)),
  );
  return files.flatMap((text) => (text ? dvfSales(readDvfCsv(text)) : []));
}

/** Every series of the index, as INSEE answers them today. */
export async function fetchPriceIndex(): Promise<
  { series: string; quarter: string; value: number }[]
> {
  const xml = await fetchText(inseeIndexUrl(INDEX_SERIES, INDEX_START), 20_000);
  return xml ? readInseeIndex(xml) : [];
}

/**
 * The index for these series: the stored one, or — before the cron has
 * filled it — INSEE's answer, kept when the service role is here to keep it.
 */
async function loadPriceIndex(
  db: Db,
  series: readonly string[],
): Promise<PriceIndex> {
  const stored = await properties.getPriceIndex(db, series);
  if (stored.size > 0) {
    return stored;
  }
  const fresh = await fetchPriceIndex();
  const admin = createAdminClient();
  if (admin && fresh.length > 0) {
    await properties.savePriceIndex(admin, fresh);
  }
  return priceIndexFromRows(fresh.filter((row) => series.includes(row.series)));
}

/** A home's estimate after the record of sales grew by a half-year. */
export interface NewEstimate {
  property: { id: string; name: string };
  /** The half-year its sales now reach: « 2026-H1 ». */
  halfYear: string;
  before: number;
  after: number;
}

export type MarketOutcome =
  /** A reading was kept. */
  | "read"
  /** Too few sales: the property's value is its purchase price, carried. */
  | "none"
  /** Premises, a property with no commune, or none of the user's. */
  | "skipped";

/**
 * Read what the market says about one property, and keep it — or forget an
 * old reading the sales no longer bear out. A thin commune is widened from
 * three years of sales to five before it is given up on. Its asking rents
 * are read at the same time; a failure there is logged and leaves what was
 * kept, and never stands in the way of the sales.
 */
export async function readPropertyMarket(
  db: Db,
  userId: string,
  propertyId: string,
  options: {
    /**
     * Told when the reading's sales reach a half-year the one before did
     * not, for a home valued by its sales — the weekly cron's, to say so.
     */
    onNewEstimate?: (estimate: NewEstimate) => Promise<void>;
  } = {},
): Promise<MarketOutcome> {
  const { data: property, error } = await db
    .from("properties")
    .select(
      "id, name, kind, usage, citycode, rooms, latitude, longitude, living_area, purchase_price, purchased_on, value_pinned, value_pinned_on",
    )
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!property) {
    return "skipped";
  }
  const rent = readPropertyRent(db, userId, property).catch((rentError) =>
    console.error("Asking rents could not be read", rentError),
  );
  try {
    return await readSales(db, userId, property, options.onNewEstimate);
  } finally {
    await rent;
  }
}

type MarketReadingRow = NonNullable<MarketContext["reading"]>;

async function readSales(
  db: Db,
  userId: string,
  property: {
    id: string;
    name: string;
    kind: "apartment" | "house" | "other";
    citycode: string | null;
    latitude: number | null;
    longitude: number | null;
    living_area: number | null;
    purchase_price: number;
    purchased_on: string;
    value_pinned: number | null;
    value_pinned_on: string | null;
  },
  onNewEstimate?: (estimate: NewEstimate) => Promise<void>,
): Promise<MarketOutcome> {
  const propertyId = property.id;
  if (property.kind === "other" || !property.citycode) {
    await properties.saveMarketReading(db, userId, propertyId, null);
    return "skipped";
  }

  const kind = property.kind;
  const candidates = seriesFor(property.citycode, kind);
  const index = await loadPriceIndex(db, candidates);
  // One carry per quarter: a commune can have thousands of sales in a dozen.
  const factors = new Map<string, number>();
  const carry = (sale: DvfSale) => {
    const quarter = quarterOf(sale.date);
    let factor = factors.get(quarter);
    if (factor === undefined) {
      factor = carryToLatest(index, candidates, quarter)?.factor ?? 1;
      factors.set(quarter, factor);
    }
    return sale.perM2 * factor;
  };
  const point: [number, number] | null =
    property.latitude !== null && property.longitude !== null
      ? [Number(property.longitude), Number(property.latitude)]
      : null;

  const years = (await dvfYears()).slice(0, MARKET_RULES.widenedYears);
  let sales = await communeSales(
    property.citycode,
    years.slice(0, MARKET_RULES.years),
  );
  let reading = marketReading(sales, { kind, point, carry });
  if (!reading && years.length > MARKET_RULES.years) {
    sales = sales.concat(
      await communeSales(property.citycode, years.slice(MARKET_RULES.years)),
    );
    reading = marketReading(sales, { kind, point, carry });
  }

  const quarter =
    carryToLatest(index, candidates, INDEX_START)?.to ??
    quarterOf(todayIsoLocal());
  const previous = onNewEstimate
    ? await previousReading(db, userId, propertyId)
    : null;
  const next = reading ? { ...reading, quarter } : null;
  const saved = await properties.saveMarketReading(
    db,
    userId,
    propertyId,
    next,
  );
  if (saved.error) {
    throw new Error(saved.error);
  }
  // A home the user values themselves is not told the sales' view of it.
  if (
    onNewEstimate &&
    next &&
    previous &&
    property.value_pinned === null &&
    isNewRelease(previous.periodTo, next.periodTo)
  ) {
    const valueBy = (by: MarketReadingRow) =>
      estimatedValue(property, { reading: by, purchaseCarry: null }).value;
    await onNewEstimate({
      property: { id: property.id, name: property.name },
      halfYear: halfYearOf(next.periodTo),
      before: valueBy(previous),
      after: valueBy(next),
    });
  }
  return reading ? "read" : "none";
}

/** The reading a property had before this one, if any. */
async function previousReading(
  db: Db,
  userId: string,
  propertyId: string,
): Promise<MarketReadingRow | null> {
  const { data } = await db
    .from("property_market_readings")
    .select("*")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  return data
    ? {
        scope: data.scope,
        medianM2: Number(data.median_m2),
        q1M2: Number(data.q1_m2),
        q3M2: Number(data.q3_m2),
        sales: data.sales,
        periodFrom: data.period_from,
        periodTo: data.period_to,
        quarter: data.quarter,
      }
    : null;
}

/**
 * The same, for a user's action that should not wait on it forever: what
 * could not be read in time is the cron's to read.
 */
export async function readPropertyMarketSoon(
  db: Db,
  userId: string,
  propertyId: string,
  timeoutMs = 8_000,
): Promise<MarketOutcome | "later"> {
  try {
    return await Promise.race([
      readPropertyMarket(db, userId, propertyId),
      new Promise<"later">((resolve) =>
        setTimeout(() => resolve("later"), timeoutMs),
      ),
    ]);
  } catch (error) {
    console.error("Market reading failed", error);
    return "later";
  }
}
