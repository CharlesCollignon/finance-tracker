import type { ActionResult } from "@finance/core/action-result";
import { firstIssue } from "@finance/core/action-result";
import type {
  InvestmentEvent,
  ReadEvent,
} from "@finance/core/investment-events";
import {
  investmentEventSchema,
  type InvestmentEventInput,
} from "@finance/core/validations/investment-events";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchema } from "./schema";

/**
 * What happened inside a person's wallets (migration 080), for both apps:
 * read, typed in, read off a broker's file, deleted. The figures drawn
 * from them are `@finance/core/investment-events`'s.
 *
 * Before migration 080 there is no table: reads answer with no event, and
 * a write says the feature is not there yet.
 */

const COLUMNS =
  "id, wallet, kind, occurred_on, instrument_name, instrument_symbol, isin, quantity, amount, note, source";

type Row = {
  id: string;
  wallet: InvestmentEvent["wallet"];
  kind: InvestmentEvent["kind"];
  occurred_on: string;
  instrument_name: string | null;
  instrument_symbol: string | null;
  isin: string | null;
  quantity: number | null;
  amount: number;
  note: string | null;
  source: InvestmentEvent["source"];
};

function fromRow(row: Row): InvestmentEvent {
  return {
    id: row.id,
    wallet: row.wallet,
    kind: row.kind,
    occurredOn: row.occurred_on,
    instrumentName: row.instrument_name,
    instrumentSymbol: row.instrument_symbol,
    isin: row.isin,
    quantity: row.quantity === null ? null : Number(row.quantity),
    amount: Number(row.amount),
    note: row.note,
    source: row.source,
  };
}

/** Every event of the person's, newest first. */
export async function readInvestmentEvents(
  db: Db,
  userId: string,
): Promise<InvestmentEvent[]> {
  const { data, error } = await db
    .from("investment_events")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map(fromRow);
}

export async function addInvestmentEvent(
  db: Db,
  userId: string,
  input: InvestmentEventInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = investmentEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const event = parsed.data;
  const { data, error } = await db
    .from("investment_events")
    .insert({
      user_id: userId,
      wallet: event.wallet,
      kind: event.kind,
      occurred_on: event.occurredOn,
      instrument_name: event.instrumentName || null,
      instrument_symbol: event.instrumentSymbol || null,
      isin: event.isin ?? null,
      quantity:
        event.kind === "buy" || event.kind === "sell"
          ? (event.quantity ?? null)
          : null,
      amount: event.amount,
      note: event.note || null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error ? dbError(error) : "errors.invalidInput" };
  }
  return { success: true, id: data.id, message: "events.added" };
}

export async function deleteInvestmentEvent(
  db: Db,
  userId: string,
  id: string,
): Promise<ActionResult> {
  const { error } = await db
    .from("investment_events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return error
    ? { error: dbError(error) }
    : { success: true, message: "events.deleted" };
}

/**
 * The events read off a file, stored: a line already known by its
 * fingerprint is left as it is, so the same export read twice adds
 * nothing twice. Says how many were new and how many were known.
 */
export async function importInvestmentEvents(
  db: Db,
  userId: string,
  events: readonly ReadEvent[],
): Promise<ActionResult<{ added: number; known: number }>> {
  if (events.length === 0) {
    return { success: true, added: 0, known: 0, message: "events.importNone" };
  }
  const { data, error } = await db
    .from("investment_events")
    .upsert(
      events.map((event) => ({
        user_id: userId,
        wallet: event.wallet,
        kind: event.kind,
        occurred_on: event.occurredOn,
        instrument_name: event.instrumentName,
        instrument_symbol: event.instrumentSymbol,
        isin: event.isin,
        quantity: event.quantity,
        amount: event.amount,
        note: event.note,
        source: "file" as const,
        fingerprint: event.fingerprint,
      })),
      { onConflict: "user_id,fingerprint", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    return { error: dbError(error) };
  }
  const added = data?.length ?? 0;
  return {
    success: true,
    added,
    known: events.length - added,
    message: "events.imported",
  };
}
