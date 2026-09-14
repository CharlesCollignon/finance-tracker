import type { SupabaseClient } from "@supabase/supabase-js";

import type { InstrumentReading, SectorId } from "@finance/core/instrument-reading";
import type {
  Database,
  InstrumentReadingRow,
} from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * What this person's instruments are made of.
 *
 * Tolerant of migration 032 not having run: an empty map is a portfolio
 * nothing is known about, which the look-through already renders honestly as
 * an unclassified share. A surface whose whole job is to say what it cannot
 * see must not fall over when the answer is "all of it".
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

function toReading(row: InstrumentReadingRow): InstrumentReading {
  return {
    isin: row.isin,
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
  userId: string,
  client?: Client,
): Promise<InstrumentReadings> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
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
    const reading = toReading(row as InstrumentReadingRow);
    byIsin.set(reading.isin, reading);
  }

  return { byIsin, tracked: true };
}

/** What is left of this month's reading allowance, and whether it is counted. */
export async function getReadingTally(
  userId: string,
  client?: Client,
): Promise<{ reads: number; pendingSince: string | null; tracked: boolean }> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("instrument_reading_tallies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { reads: 0, pendingSince: null, tracked: false };
    }
    throw error;
  }

  return {
    reads: data?.reads ?? 0,
    pendingSince: data?.pending_since ?? null,
    tracked: true,
  };
}
