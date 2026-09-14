import type { SupabaseClient } from "@supabase/supabase-js";

import {
  READING_VERSION,
  readingIsStale,
  verifyInstrumentReading,
} from "@finance/core/instrument-reading";
import type { Database } from "@finance/core/types/database";
import { instrumentReadingConfigured } from "@/lib/instrument-reading/client";
import { instrumentReadingSource } from "@/lib/instrument-reading/source";
import {
  getInstrumentReadings,
  getReadingTally,
} from "@/lib/queries/instrument-readings";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonth } from "@finance/core/constants";
import { monthColumnValue } from "@finance/core/month-close";

type Client = SupabaseClient<Database>;

/**
 * Reading one instrument, end to end.
 *
 * The same order as every other paid call in this app — decide, reserve, ask,
 * verify, store or refund — with one difference worth stating: the decision
 * about whether this instrument needs reading at all happens *before* the
 * reservation, so re-walking a portfolio that is already read costs nothing.
 * That matters because the client walks the queue one instrument at a time
 * and will happily re-walk it after a page reload.
 *
 * Deliberately one instrument per request. A portfolio of twenty unread
 * positions is twenty requests, which is visible progress instead of one call
 * that the platform kills at sixty seconds with the allowance already spent.
 */

/**
 * How many instruments may be read a month.
 *
 * Generous against a real portfolio — nobody holds forty positions — and a
 * cap all the same, because a client could otherwise re-read the same
 * portfolio every day. `reserve_instrument_reading` also refuses any ISIN the
 * caller does not actually hold, which is the tighter of the two bounds.
 */
export const READINGS_PER_MONTH = 40;

/** A second press on the same button is one call. */
const COOLDOWN_SECONDS = 2;

/** Longer than any read takes, short enough not to strand a retry. */
const RESERVATION_SECONDS = 120;

export type ReadInstrumentOutcome =
  | { status: "read" }
  | { status: "already-fresh" }
  | { status: "not-yours" }
  | { status: "allowance-spent" }
  | { status: "no-reader" }
  | { status: "unavailable" };

function thisMonthColumn(): string {
  const { year, month } = getCurrentMonth();
  return monthColumnValue(year, month);
}

function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "42883"
  );
}

export async function readInstrument(
  userId: string,
  isin: string,
  name: string,
  symbol: string | null,
  client?: Client,
  now: Date = new Date(),
): Promise<ReadInstrumentOutcome> {
  if (!instrumentReadingConfigured()) {
    return { status: "no-reader" };
  }

  const supabase = client ?? (await createClient());
  const normalised = isin.trim().toUpperCase();

  // Checked before anything is reserved: a fresh reading means there is
  // nothing to buy, and charging for the discovery would make re-walking a
  // read portfolio expensive.
  const existing = await getInstrumentReadings(userId, supabase);
  if (!existing.tracked) {
    return { status: "unavailable" };
  }

  const held = existing.byIsin.get(normalised);
  if (held && !readingIsStale(held, now)) {
    return { status: "already-fresh" };
  }

  // The tally as it stands, so the reservation can be recognised. The
  // function returns a row either way — it falls back to the current one when
  // the conflict clause declines — so "granted" and "refused" are told apart
  // by the count moving, never by the row being present.
  const before = await getReadingTally(userId, supabase);

  const { data: reserved, error: reserveError } = await supabase.rpc(
    "reserve_instrument_reading",
    {
      target_user: userId,
      target_isin: normalised,
      this_month: thisMonthColumn(),
      allowance: READINGS_PER_MONTH,
      cooldown_seconds: COOLDOWN_SECONDS,
      reservation_seconds: RESERVATION_SECONDS,
    },
  );

  if (reserveError) {
    if (isMissingSchema(reserveError)) {
      return { status: "unavailable" };
    }
    // The function raises rather than returns for an ISIN the caller does not
    // hold, which is the one refusal worth distinguishing: it means the
    // client asked about something that is not theirs.
    if (/not held by that user/.test(reserveError.message)) {
      return { status: "not-yours" };
    }
    return { status: "unavailable" };
  }

  if (!reserved || reserved.reads <= before.reads) {
    return { status: "allowance-spent" };
  }

  const answer = await instrumentReadingSource.read({
    isin: normalised,
    name,
    symbol,
  });

  if (answer === null) {
    // Never reached the provider, or came back unusable at the envelope
    // level. The one case that is refunded: nothing was spent.
    await refund(supabase, userId);
    return { status: "unavailable" };
  }

  const verdict = verifyInstrumentReading(
    { isin: normalised, name, symbol },
    answer,
    now,
    instrumentReadingSource.model,
  );

  if (!verdict.ok) {
    // Not refunded: an answer arrived and cost money. Nothing is stored, so
    // the instrument stays in the queue and can be tried again — which is the
    // right outcome for a search that landed on the wrong share class.
    await release(supabase, userId);
    return { status: "unavailable" };
  }

  const reading = verdict.reading;
  const { error: storeError } = await supabase.rpc("store_instrument_reading", {
    target_user: userId,
    target_isin: reading.isin,
    new_charge: reading.ongoingCharge,
    new_currency: reading.currency,
    new_country_weights: reading.countryWeights as never,
    new_sector_weights: reading.sectorWeights as never,
    new_constituents: reading.topConstituents as never,
    new_coverage: reading.constituentsCoverage,
    new_sources: reading.sources as never,
    new_model: reading.model,
    new_version: READING_VERSION,
  });

  if (storeError && !isMissingSchema(storeError)) {
    throw storeError;
  }

  return { status: "read" };
}

/** Hand the attempt back. Never fatal — see `refundWalletRead`. */
async function refund(supabase: Client, userId: string): Promise<void> {
  try {
    await supabase.rpc("refund_instrument_reading", { target_user: userId });
  } catch {
    // Swallowed: a failed refund costs one attempt, an error costs the press.
  }
}

/**
 * Clear the reservation without giving the attempt back.
 *
 * The answer arrived and was paid for, but nothing is being stored — so the
 * meter must not stay showing a call in flight, or the queue is blocked until
 * the reservation ages out. `store_instrument_reading` normally does this as
 * part of landing a reading; there is no reading to land here.
 *
 * Through the RPC, not an UPDATE. The tally is select-only, so writing to it
 * from here would be silently refused by row level security — no error, no
 * effect, and a queue that looked blocked for two minutes for no visible
 * reason.
 */
async function release(supabase: Client, userId: string): Promise<void> {
  try {
    await supabase.rpc("release_instrument_reading", { target_user: userId });
  } catch {
    // Swallowed: the reservation ages out on its own within two minutes.
  }
}
