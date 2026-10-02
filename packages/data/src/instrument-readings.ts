import {
  ASSET_KINDS,
  type AssetKind,
  type InstrumentReading,
  type SectorId,
} from "@finance/core/instrument-reading";
import type { InstrumentReadingRow } from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * What has been read about each instrument a user holds — the look-through's
 * raw material — for both apps and the nightly reading run, which each had a
 * copy of the same mapping.
 */

function isAssetKind(value: string | null | undefined): value is AssetKind {
  return (
    value !== null &&
    value !== undefined &&
    (ASSET_KINDS as readonly string[]).includes(value)
  );
}

/** One stored row, as the look-through reads it. */
export function toInstrumentReading(
  row: InstrumentReadingRow,
): InstrumentReading {
  return {
    isin: row.isin,
    // Narrowed rather than cast: the column is plain text with a permissive
    // check, because the vocabulary lives in core and a kind added to it
    // should not need a migration. A value this build does not know reads as
    // "not asked", which is the safe answer — the instrument keeps whatever
    // composition it reported.
    assetKind: isAssetKind(row.asset_kind) ? row.asset_kind : null,
    ongoingCharge:
      row.ongoing_charge === null ? null : Number(row.ongoing_charge),
    currency: row.currency,
    countryWeights: (row.country_weights ?? {}) as Record<string, number>,
    sectorWeights: (row.sector_weights ?? {}) as Partial<
      Record<SectorId, number>
    >,
    topConstituents: (row.top_constituents ?? []) as {
      name: string;
      weight: number;
    }[],
    constituentsCoverage:
      row.constituents_coverage === null
        ? 0
        : Number(row.constituents_coverage),
    sources: (row.sources ?? []) as string[],
    sourcedAt: row.sourced_at,
    model: row.model,
    version: row.version,
  };
}

export interface InstrumentReadings {
  byIsin: Map<string, InstrumentReading>;
  /** False when migration 032 has not run. */
  tracked: boolean;
}

export async function getInstrumentReadings(
  db: Db,
  userId: string,
): Promise<InstrumentReadings> {
  const { data, error } = await db
    .from("instrument_readings")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return { byIsin: new Map(), tracked: false };
    }
    throw error;
  }

  const byIsin = new Map<string, InstrumentReading>();
  for (const row of data ?? []) {
    const reading = toInstrumentReading(row as InstrumentReadingRow);
    byIsin.set(reading.isin, reading);
  }
  return { byIsin, tracked: true };
}
