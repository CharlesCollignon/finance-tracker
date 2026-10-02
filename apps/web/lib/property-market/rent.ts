import "server-only";

import { todayIsoLocal } from "@finance/core/constants";
import {
  anilDatasetUrl,
  anilFileUrl,
  readAnilCsv,
  rentReference,
  rentSeriesFor,
  type AnilRow,
  type RentReference,
} from "@finance/core/rent-reference";
import { isLet } from "@finance/core/rental";
import type {
  PropertyKind,
  PropertyUsage,
  RentSeries,
} from "@finance/core/types/database";
import type { Db } from "@finance/data/client";
import * as properties from "@finance/data/properties";

/**
 * What homes like a let property are advertised for around it, read on the
 * web server from the ANIL's « Carte des loyers » on data.gouv.fr and kept
 * on the property's own row (migration 051).
 *
 * Each table is a national file of about 5 MB, the same for anyone who
 * asks: nothing about the user is sent. It is read once a day per server
 * and kept in memory by commune.
 */

/** The map is published once a year, in December; a day is plenty. */
const TABLE_TTL_MS = 24 * 60 * 60 * 1000;

interface Table {
  edition: number;
  rows: Map<string, AnilRow>;
}

const tables = new Map<RentSeries, { at: number; table: Promise<Table | null> }>();

async function fetchOk(url: string, timeoutMs: number): Promise<Response | null> {
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
  return response;
}

/**
 * The latest edition's table: this year's map if it is out, else last
 * year's, else the one before. Anything that goes wrong throws, so a
 * reference is never forgotten because a server was slow.
 */
async function fetchTable(series: RentSeries): Promise<Table | null> {
  const year = Number(todayIsoLocal().slice(0, 4));
  for (const edition of [year, year - 1, year - 2]) {
    const dataset = await fetchOk(anilDatasetUrl(edition), 10_000);
    const url = dataset ? anilFileUrl(await dataset.json(), series) : null;
    if (!url) {
      continue;
    }
    const file = await fetchOk(url, 20_000);
    if (!file) {
      continue;
    }
    // The ANIL writes Windows-1252: « Montsalès », not UTF-8.
    const text = new TextDecoder("windows-1252").decode(
      await file.arrayBuffer(),
    );
    const rows = readAnilCsv(text);
    if (rows.size === 0) {
      throw new Error(`${url} could not be read`);
    }
    return { edition, rows };
  }
  return null;
}

function latestTable(series: RentSeries): Promise<Table | null> {
  const cached = tables.get(series);
  if (cached && Date.now() - cached.at < TABLE_TTL_MS) {
    return cached.table;
  }
  const table = fetchTable(series);
  tables.set(series, { at: Date.now(), table });
  // A failure is not kept: the next reading asks again.
  table.catch(() => tables.delete(series));
  return table;
}

/**
 * Read a property's asking rents and keep them — or forget them, when it
 * is not let, has no commune, or the ANIL gives no reliable figure there.
 */
export async function readPropertyRent(
  db: Db,
  userId: string,
  property: {
    id: string;
    kind: PropertyKind;
    usage: PropertyUsage;
    citycode: string | null;
    rooms: number | null;
  },
): Promise<void> {
  const series = rentSeriesFor(property.kind, property.rooms);
  let reference: RentReference | null = null;
  if (isLet(property.usage) && property.citycode && series) {
    const table = await latestTable(series);
    if (!table) {
      // No edition found at all: data.gouv.fr moved it, not a commune
      // without a figure. What was kept stays.
      return;
    }
    reference = rentReference(
      table.rows.get(property.citycode),
      series,
      table.edition,
    );
  }
  const saved = await properties.saveRentReference(
    db,
    userId,
    property.id,
    reference,
  );
  if (saved.error) {
    throw new Error(saved.error);
  }
}
