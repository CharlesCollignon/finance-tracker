import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BEARING_ARRANGEMENTS_PER_MONTH,
  BEARING_COOLDOWN_SECONDS,
  BEARING_RESERVATION_SECONDS,
} from "@finance/core/bearing-budget";
import type { BearingFacts } from "@finance/core/bearing-facts";
import type { Arrangement } from "@finance/core/bearing-read";
import type { TilePins } from "@finance/core/bearing-tiles";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import { monthColumnValue } from "@finance/core/month-close";
import { getCurrentMonth } from "@finance/core/constants";
import type {
  BearingArrangementRow,
  Database,
} from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";

type Client = SupabaseClient<Database>;

/**
 * The database side of the Bearing.
 *
 * Two stores, because migration 029 keeps two things apart for two different
 * reasons. The user's pins are an ordinary preference, read and written
 * straight through row level security. The model's arrangement and its tally
 * are read straight through and written only via the three `security
 * definer` functions, because a counter a client may UPDATE is a counter a
 * client may reset.
 *
 * Tolerant of the migration not having run, exactly as `lib/month-read/store.ts`
 * is: a missing optional table must not take down the app's landing page. The
 * two halves fail independently — somebody without 029 still gets the
 * Bearing, in the app's own ordering, with no arrange button and no dragging.
 */

function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    // No such function: the migration-not-run case for an RPC.
    error?.code === "42883"
  );
}

/** The month the allowance is counted in — now, not the month written about. */
function thisMonthColumn(): string {
  const { year, month } = getCurrentMonth();
  return monthColumnValue(year, month);
}

export interface StoredArrangement {
  arrangement: Arrangement | null;
  facts: BearingFacts | null;
  arrangedAt: string | null;
  model: string | null;
  promptVersion: number | null;
  dropped: number;
  /**
   * The language the captions are in.
   *
   * Null for a row written before any caption survived, which reads as the
   * default. Same reasoning as a month read's: prose stays in the language it
   * was written in, so the labels spliced into it have to as well.
   */
  locale: Locale;
  tally: MonthReadTally;
  /** The month `tally` is counting, so a stale month reads as a full allowance. */
  tallyMonth: string;
}

export interface BearingState {
  /** Null when nothing has ever been arranged. */
  stored: StoredArrangement | null;
  /** False when migration 029 has not run. */
  tracked: boolean;
}

function toStored(row: BearingArrangementRow): StoredArrangement {
  const current = thisMonthColumn();
  return {
    arrangement: (row.arrangement as Arrangement | null) ?? null,
    facts: (row.facts as BearingFacts | null) ?? null,
    arrangedAt: row.arranged_at,
    model: row.model,
    promptVersion: row.prompt_version,
    dropped: row.dropped,
    locale: parseLocale(row.locale) ?? DEFAULT_LOCALE,
    tally: {
      // A tally from a month that has passed is not this month's tally. The
      // database resets it on the next reservation, but a page rendered
      // before that would otherwise say "0 left" on the first of the month.
      writes: row.tally_month < current ? 0 : row.writes,
      refused: row.refused,
      lastWrittenAt: row.last_written_at,
      pendingSince: row.pending_since,
    },
    tallyMonth: row.tally_month,
  };
}

export async function readBearingState(
  userId: string,
  client?: Client,
): Promise<BearingState> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("bearing_arrangements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { stored: null, tracked: false };
    }
    throw error;
  }

  return {
    stored: data ? toStored(data as BearingArrangementRow) : null,
    tracked: true,
  };
}

/**
 * Take an attempt, if the allowance permits.
 *
 * Returns the tally as it stands afterwards, or null when the schema is
 * absent. The caller compares `writes` with what it saw before to learn
 * whether the reservation was granted — the function cannot say, because
 * "declined" and "granted" both come back as a row.
 */
export async function reserveArrangement(
  userId: string,
  client?: Client,
): Promise<MonthReadTally | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("reserve_bearing_arrangement", {
    target_user: userId,
    this_month: thisMonthColumn(),
    allowance: BEARING_ARRANGEMENTS_PER_MONTH,
    cooldown_seconds: BEARING_COOLDOWN_SECONDS,
    reservation_seconds: BEARING_RESERVATION_SECONDS,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  return data ? toStored(data as BearingArrangementRow).tally : null;
}

/** Land a finished attempt. Null `arrangement` means nothing survived. */
export async function storeArrangement(
  userId: string,
  payload: {
    arrangement: Arrangement | null;
    facts: BearingFacts | null;
    digest: string | null;
    dropped: number;
    model: string;
    promptVersion: number;
    locale: Locale;
    refusedDelta: number;
  },
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.rpc("store_bearing_arrangement", {
    target_user: userId,
    new_arrangement: payload.arrangement as never,
    new_facts: payload.facts as never,
    new_digest: payload.digest,
    new_dropped: payload.dropped,
    new_model: payload.model,
    new_prompt_version: payload.promptVersion,
    new_locale: payload.locale,
    refused_delta: payload.refusedDelta,
  });

  if (error && !isMissingSchema(error)) {
    throw error;
  }
}

/**
 * Hand back an attempt that never reached the provider.
 *
 * Never fatal. A refund that fails leaves the user one attempt worse off,
 * which is a far better outcome than an error on a press whose real problem
 * was that a model could not be reached.
 */
export async function refundArrangement(
  userId: string,
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  try {
    await supabase.rpc("refund_bearing_arrangement", { target_user: userId });
  } catch {
    // Deliberately swallowed; see above.
  }
}

/* ------------------------------------------------------------- the pins */

/**
 * Where the user has put their tiles.
 *
 * An ordinary preference read, and an empty object for somebody who has never
 * dragged anything — the distinction between "no pins" and "no row" matters
 * to the database, which stores null, but not to the caller, for whom both
 * mean the arrangement leads.
 */
export async function readPins(
  userId: string,
  client?: Client,
): Promise<TilePins> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("user_preferences")
    .select("bearing_pins")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return {};
    }
    throw error;
  }

  const raw = data?.bearing_pins;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  // Narrowed here rather than trusted from the column. The check constraint
  // in 029 guarantees an object of numbers, and this guarantees it again for
  // a row written before that constraint existed or by a hand at a psql
  // prompt — `mergeArrangement` drops what it cannot use, but it should not
  // have to defend itself against a string.
  const pins: Record<string, number> = {};
  for (const [id, slot] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof slot === "number" && Number.isInteger(slot) && slot >= 0) {
      pins[id] = slot;
    }
  }
  return pins;
}

/**
 * Remember where the user put their tiles.
 *
 * Upserted, because `user_preferences` rows are created lazily: somebody who
 * has never changed language has no row, and dragging a tile is a perfectly
 * ordinary way to acquire one. An empty map is stored as null rather than
 * `{}`, so clearing an order returns the surface to "no opinion" rather than
 * to "an opinion that happens to be empty".
 */
export async function writePins(
  userId: string,
  pins: TilePins,
  client?: Client,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const value = Object.keys(pins).length > 0 ? pins : null;

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: userId, bearing_pins: value as never },
      { onConflict: "user_id" },
    );

  if (error && !isMissingSchema(error)) {
    throw error;
  }
}
