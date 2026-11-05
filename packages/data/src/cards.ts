import type { ActionResult } from "@finance/core/action-result";
import {
  DEFAULT_DEBIT_DAY,
  debitDateFor,
  type CardCycle,
  type CardDebit,
  type CardRule,
} from "@finance/core/cards";
import { ledgerDatesOf } from "@finance/core/cash-date";
import { shiftIsoDate } from "@finance/core/constants";
import { z } from "zod";

import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * Cards (migration 087): each one Pluclair has seen, asked once whether it is
 * debited at once or later, and what a deferred one still owes.
 */

export interface CardRow {
  key: string;
  label: string | null;
  debit: CardDebit | null;
  debitDay: number | null;
  firstSeenOn: string;
}

/** Every card the owner has, as asked or not. */
export async function getCards(db: Db, ownerId: string): Promise<CardRow[]> {
  const { data, error } = await db
    .from("cards")
    .select("key, label, debit, debit_day, first_seen_on")
    .eq("user_id", ownerId)
    .order("first_seen_on", { ascending: true });
  if (error) {
    // Before migration 087, or a failed read: no card is known, which is
    // today's behaviour.
    return [];
  }
  return (data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    debit: (row.debit as CardDebit | null) ?? null,
    debitDay: row.debit_day,
    firstSeenOn: row.first_seen_on,
  }));
}

/** The cards as the feed reads them. */
export function cardRules(cards: readonly CardRow[]): CardRule[] {
  return cards.map(({ key, debit, debitDay }) => ({ key, debit, debitDay }));
}

/** The cards still waiting for their question, oldest first. */
export function unansweredCards(cards: readonly CardRow[]): CardRow[] {
  return cards.filter((card) => card.debit === null);
}

/**
 * Record the cards these lines named, the first time each is seen, so the
 * question can be asked. One already known is left as it is.
 */
export async function rememberCards(
  db: Db,
  ownerId: string,
  cards: readonly { key: string; label?: string | null }[],
): Promise<void> {
  const fresh = new Map<string, string | null>();
  for (const card of cards) {
    if (card.key && !fresh.has(card.key)) {
      fresh.set(card.key, card.label?.trim().slice(0, 100) || null);
    }
  }
  if (fresh.size === 0) {
    return;
  }
  await db.from("cards").upsert(
    [...fresh].map(([key, label]) => ({ user_id: ownerId, key, label })),
    { onConflict: "user_id,key", ignoreDuplicates: true },
  );
}

/** How far back a debit can still be owed: a little over a month. */
const OPEN_CYCLE_DAYS = 45;

/**
 * What each deferred card's payments add up to towards each debit, from the
 * lines already brought: what a month's combined debit is matched against
 * (`settledCycle`). A cycle a combined debit already paid is not owed again.
 */
export async function cardCycles(
  db: Db,
  ownerId: string,
  today: string,
): Promise<CardCycle[]> {
  const since = shiftIsoDate(today, -OPEN_CYCLE_DAYS);
  const { data, error } = await db
    .from("bank_feed_items")
    .select(
      "card_key, debited_on, amount, direction, status, decided_by, occurred_on",
    )
    .eq("user_id", ownerId)
    .not("card_key", "is", null)
    .gte("occurred_on", since);
  if (error || !data) {
    return [];
  }

  const paid = data
    .filter((row) => row.decided_by?.startsWith("card:settled:"))
    .map((row) => ({
      key: row.decided_by!.slice("card:settled:".length),
      on: row.occurred_on,
    }));
  const cycles = new Map<string, CardCycle>();
  for (const row of data) {
    if (!row.debited_on || !row.card_key || row.status === "ignored") {
      continue;
    }
    const id = `${row.card_key}|${row.debited_on}`;
    const cycle = cycles.get(id) ?? {
      key: row.card_key,
      debitOn: row.debited_on,
      total: 0,
    };
    const amount = Number(row.amount);
    cycle.total += row.direction === "out" ? amount : -amount;
    cycles.set(id, cycle);
  }
  return [...cycles.values()].filter(
    (cycle) =>
      cycle.total > 0 &&
      !paid.some(
        (settled) =>
          settled.key === cycle.key &&
          Math.abs(
            Date.parse(`${settled.on}T00:00:00Z`) -
              Date.parse(`${cycle.debitOn}T00:00:00Z`),
          ) <=
            6 * 86_400_000,
      ),
  );
}

const answerSchema = z.object({
  key: z.string().min(1).max(200),
  debit: z.enum(["immediate", "deferred"]),
  debitDay: z.coerce.number().int().min(1).max(31).optional(),
});

/**
 * Answer the question about a card, once: debited at once, or later on a
 * day of the month. A deferred card shown as its own account starts coming
 * into the ledger (`role = 'card'`); one said immediate is left aside again.
 * Its payments already brought by an alert, a notification or the card's
 * account move to the day their money leaves.
 */
export async function answerCard(
  db: Db,
  ownerId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }
  const { key, debit } = parsed.data;
  const debitDay =
    debit === "deferred" ? (parsed.data.debitDay ?? DEFAULT_DEBIT_DAY) : null;

  const { error } = await db
    .from("cards")
    .update({
      debit,
      debit_day: debitDay,
      answered_at: new Date().toISOString(),
    })
    .eq("user_id", ownerId)
    .eq("key", key);
  if (error) {
    return { error: dbError(error) };
  }

  if (key.startsWith("acct:")) {
    await db
      .from("bank_accounts")
      .update({ role: debit === "deferred" ? "card" : "ignored" })
      .eq("user_id", ownerId)
      .eq("provider_account_id", key.slice("acct:".length));
  }

  await redateCard(db, ownerId, key, debitDay);
  return { success: true, message: "actions.cardAnswered" };
}

/**
 * Move a card's payments to the day their money leaves, after its question
 * is answered: the ones made on the day and booked later — an alert's, a
 * notification's, a card account's. A line the bank booked on the current
 * account already says when the money left.
 */
async function redateCard(
  db: Db,
  ownerId: string,
  key: string,
  debitDay: number | null,
): Promise<void> {
  const { data: rows } = await db
    .from("bank_feed_items")
    .select(
      "id, occurred_on, purchased_on, debited_on, source, provider_account_id, transaction_id, decided_by",
    )
    .eq("user_id", ownerId)
    .eq("card_key", key);
  for (const row of rows ?? []) {
    const madeLater =
      row.source === "email" ||
      row.source === "notification" ||
      key === `acct:${row.provider_account_id}`;
    if (!madeLater || row.decided_by?.startsWith("card:settled:")) {
      continue;
    }
    const debitedOn =
      debitDay === null
        ? null
        : debitDateFor(row.purchased_on ?? row.occurred_on, debitDay);
    if (debitedOn === row.debited_on) {
      continue;
    }
    await db
      .from("bank_feed_items")
      .update({ debited_on: debitedOn })
      .eq("id", row.id)
      .eq("user_id", ownerId);
    if (row.transaction_id) {
      const dates = ledgerDatesOf({
        occurred_on: row.occurred_on,
        purchased_on: row.purchased_on,
        debited_on: debitedOn,
      });
      await db
        .from("transactions")
        .update({ cash_on: dates.cash_on })
        .eq("id", row.transaction_id)
        .eq("user_id", ownerId);
    }
  }
}
