import type { SupabaseClient } from "@supabase/supabase-js";

import {
  readingQueue,
  type InstrumentReading,
  type SectorId,
} from "@finance/core/instrument-reading";
import type { Database } from "@finance/core/types/database";
import { readInstrument } from "@/lib/instrument-reading/read";

type Client = SupabaseClient<Database>;

/**
 * Keeping readings current without anybody pressing anything.
 *
 * The look-through works the moment a position has an ISIN — the surface will
 * read an instrument on demand and show progress while it does. This is the
 * other half of "current": a charge that changed in March, or a country split
 * that drifted over a year, gets picked up without the user having to
 * remember that readings age.
 *
 * Deliberately small per run. One instrument per user, a handful of users,
 * once a day. A portfolio's worth of readings arrives over a few days rather
 * than in one request, which is the only way this fits a sixty-second
 * function alongside its own network call — and there is nothing urgent about
 * it, because a reading that is one day staler is a reading that is still
 * being used.
 *
 * Does not use `gatherLookThrough`, on purpose: that reaches for the cookie
 * client through `getWalletPortfolio`, and nobody is signed in here. The
 * queue is computed from the two tables this actually needs.
 */

/** Users touched per run. Each costs one paid call and one network wait. */
const USERS_PER_RUN = 3;

/** Instruments per user per run. */
const READINGS_PER_USER = 1;

export interface ReadingRunOutcome {
  users: number;
  read: number;
  skipped: number;
  failures: string[];
}

interface Candidate {
  userId: string;
  isin: string;
  name: string;
  symbol: string | null;
}

function toReading(row: {
  isin: string;
  ongoing_charge: number | null;
  currency: string | null;
  country_weights: unknown;
  sector_weights: unknown;
  top_constituents: unknown;
  constituents_coverage: number | null;
  sources: unknown;
  sourced_at: string;
  model: string | null;
  version: number;
}): InstrumentReading {
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

/**
 * Which instruments are most worth reading, across everybody.
 *
 * Never-read first, then thinnest, then oldest — `readingQueue`'s order, per
 * user. Users are taken in whatever order the positions come back in rather
 * than round-robined: at one a day a fair rotation would take longer to write
 * than the unfairness costs, and every user's queue empties within a week.
 */
async function findCandidates(supabase: Client): Promise<Candidate[]> {
  const { data: positions, error } = await supabase
    .from("investment_positions")
    .select("user_id, isin, name, instrument_symbol, current_value, share_count")
    .not("isin", "is", null);

  if (error) {
    throw error;
  }

  const byUser = new Map<string, Candidate[]>();
  for (const row of positions ?? []) {
    if (!row.isin) {
      continue;
    }
    const existing = byUser.get(row.user_id) ?? [];
    existing.push({
      userId: row.user_id,
      isin: row.isin,
      name: row.name,
      symbol: row.instrument_symbol,
    });
    byUser.set(row.user_id, existing);
  }

  if (byUser.size === 0) {
    return [];
  }

  const { data: readings, error: readingsError } = await supabase
    .from("instrument_readings")
    .select("*")
    .in("user_id", [...byUser.keys()]);

  if (readingsError) {
    throw readingsError;
  }

  const readingsByUser = new Map<string, Map<string, InstrumentReading>>();
  for (const row of readings ?? []) {
    const forUser = readingsByUser.get(row.user_id) ?? new Map();
    const reading = toReading(row);
    forUser.set(reading.isin, reading);
    readingsByUser.set(row.user_id, forUser);
  }

  const now = new Date();
  const candidates: Candidate[] = [];

  for (const [userId, held] of byUser.entries()) {
    const queue = readingQueue(
      [...new Set(held.map((row) => row.isin))],
      readingsByUser.get(userId) ?? new Map(),
      now,
    );

    for (const isin of queue.slice(0, READINGS_PER_USER)) {
      const position = held.find((row) => row.isin === isin)!;
      candidates.push(position);
    }

    if (candidates.length >= USERS_PER_RUN * READINGS_PER_USER) {
      break;
    }
  }

  return candidates;
}

export async function readInstrumentsForEveryUser(
  supabase: Client,
): Promise<ReadingRunOutcome> {
  const candidates = await findCandidates(supabase);
  const outcome: ReadingRunOutcome = {
    users: new Set(candidates.map((row) => row.userId)).size,
    read: 0,
    skipped: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    try {
      const result = await readInstrument(
        candidate.userId,
        candidate.isin,
        candidate.name,
        candidate.symbol,
        supabase,
      );
      if (result.status === "read") {
        outcome.read += 1;
      } else {
        outcome.skipped += 1;
      }
    } catch (error) {
      // One user's instrument failing must not stop the next one's. The
      // ISIN is safe to record — it is a public identifier — but nothing
      // from a provider error is.
      outcome.failures.push(
        `${candidate.isin}: ${
          error instanceof Error ? error.message : "read failed"
        }`,
      );
    }
  }

  return outcome;
}
