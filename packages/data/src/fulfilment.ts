import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { todayIsoLocal } from "@finance/core/constants";
import {
  bankForecast,
  fulfilmentOccurrences,
  fulfilmentScope,
  proposalsForMonth,
  proposeFulfilments,
  refusalKey,
  type BankForecast,
  type FulfilmentMovement,
  type FulfilmentProposal,
  type ProposeOptions,
} from "@finance/core/recurring-fulfilment";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * Which recurring charges the bank looks to have already delivered.
 *
 * The candidates are drawn wide and cut down by `proposeFulfilments`, which
 * holds the rules and is tested on its own. This is the plumbing: what counts
 * as an occurrence this month, what counts as a movement that could fulfil
 * one, and what the user has already decided.
 */

/** Occurrences already fulfilled, as occurrence keys. */
export async function getFulfilledKeys(
  db: Db,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from("recurring_fulfilments")
    .select("template_id, occurred_on")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return new Set();
    }
    throw error;
  }

  return new Set(
    (data ?? []).map((row) =>
      recurringOccurrenceKey(row.template_id, row.occurred_on),
    ),
  );
}

/**
 * Which ledger rows stand in for an occurrence, by transaction id.
 *
 * The same table as `getFulfilledKeys` read down its other axis: that one
 * answers "is this occurrence settled?" for the forecast, this one answers
 * "does this row settle something?" for a row on screen.
 *
 * Deliberately not month-scoped, and it must stay that way.
 * `recurring_fulfilments.occurred_on` is the date of the *occurrence*, not of
 * the movement — that separation is the whole point of the table — so a
 * payment on the 31st can settle an occurrence dated the 1st. Filtering this
 * by the month on screen would take the mark off the very row that earned it.
 *
 * Separate from `getFulfilmentReport` rather than folded into it because the
 * report gives up early when a month generates no occurrences, which happens
 * whenever a template is inactive or outside its date range. Sourced from
 * there, a confirmation would disappear the moment its template was switched
 * off — retroactively, across every month.
 */
export async function getConfirmedTransactionIds(
  db: Db,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from("recurring_fulfilments")
    .select("transaction_id")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return new Set();
    }
    throw error;
  }

  // `transaction_id` is `not null` in migration 023, so nothing can slip in.
  return new Set((data ?? []).map((row) => row.transaction_id as string));
}

export interface FulfilmentReport {
  proposals: FulfilmentProposal[];
}

/**
 * A month's questions: the pairings planned in it, and the ones whose money
 * moved in it — the October salary paid on 22 September is asked about in
 * September as well as in October (`fulfilmentScope`). Matched across the
 * three months at once, so one payment is never offered for two of them.
 */
async function monthQuestions(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
) {
  const scope = fulfilmentScope(year, month);
  const occurrences = fulfilmentOccurrences(
    templates,
    categories,
    scope.months,
  );
  if (occurrences.length === 0) {
    return null;
  }

  const { movements, options } = await readCandidates(
    db,
    userId,
    scope.from,
    scope.to,
  );
  return { all: proposeFulfilments(occurrences, movements, options) };
}

export async function getFulfilmentReport(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<FulfilmentReport> {
  const asked = await monthQuestions(
    db,
    userId,
    templates,
    categories,
    year,
    month,
  );
  if (!asked) {
    return { proposals: [] };
  }

  return { proposals: proposalsForMonth(asked.all, year, month) };
}

export async function getFulfilmentProposals(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<FulfilmentProposal[]> {
  const asked = await monthQuestions(
    db,
    userId,
    templates,
    categories,
    year,
    month,
  );
  return asked ? proposalsForMonth(asked.all, year, month) : [];
}

/**
 * What the bank has and has not brought of the charges around today, for a
 * ledger it feeds — see `bankForecast`. Matched over the month in progress
 * and its neighbours, as far as a movement can be from its occurrence, so
 * whichever month a screen shows, its forecast and the questions agree.
 */
export async function getBankForecast(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  today: string,
): Promise<BankForecast> {
  const scope = fulfilmentScope(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
  );
  // The templates carry their category; nothing else needs reading.
  const categories = templates.map((template) => ({
    id: template.category_id,
    type: template.categories.type,
    name: template.categories.name,
  }));
  const occurrences = fulfilmentOccurrences(
    templates,
    categories,
    scope.months,
  );
  if (occurrences.length === 0) {
    return { awaited: new Set(), arrived: new Set() };
  }

  const { movements, options } = await readCandidates(
    db,
    userId,
    scope.from,
    scope.to,
  );
  return bankForecast(
    templates,
    occurrences,
    proposeFulfilments(occurrences, movements, options),
    today,
  );
}

/**
 * The movements that could fulfil something between two days, and what the
 * user has already decided about them.
 */
async function readCandidates(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<{ movements: FulfilmentMovement[]; options: ProposeOptions }> {
  const [
    { data: transactions, error: txError },
    { data: fulfilments, error: fulfilError },
    { data: refusals, error: refusalError },
  ] = await Promise.all([
    // Only rows no template wrote. A row a template wrote is already the
    // occurrence; asking whether it fulfils one would be asking whether it is
    // itself.
    db
      .from("transactions")
      .select("id, occurred_on, amount, category_id, note")
      .eq("user_id", userId)
      .is("recurring_template_id", null)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    db
      .from("recurring_fulfilments")
      .select("template_id, occurred_on, transaction_id")
      .eq("user_id", userId),
    db
      .from("recurring_fulfilment_refusals")
      .select("template_id, occurred_on, transaction_id")
      .eq("user_id", userId),
  ]);

  if (txError) {
    throw txError;
  }
  // The two decision tables are the optional half. Without them every
  // proposal simply looks undecided, which is the right failure: the user is
  // asked again rather than having a confirmation silently forgotten.
  if (fulfilError && !isMissingSchema(fulfilError)) {
    throw fulfilError;
  }
  if (refusalError && !isMissingSchema(refusalError)) {
    throw refusalError;
  }

  const movements: FulfilmentMovement[] = (transactions ?? []).map((row) => ({
    transactionId: row.id as string,
    occurredOn: row.occurred_on as string,
    amount: Number(row.amount),
    categoryId: row.category_id as string,
    note: (row.note as string | null) ?? null,
  }));

  return {
    movements,
    options: {
      // A movement dated after today has not arrived, whatever else matches.
      today: todayIsoLocal(),
      fulfilledKeys: new Set(
        (fulfilments ?? []).map((row) =>
          recurringOccurrenceKey(row.template_id, row.occurred_on),
        ),
      ),
      claimedTransactionIds: new Set(
        (fulfilments ?? []).map((row) => row.transaction_id as string),
      ),
      refusedPairs: new Set(
        (refusals ?? []).map((row) =>
          refusalKey(row.template_id, row.occurred_on, row.transaction_id),
        ),
      ),
    },
  };
}

/**
 * How many are waiting.
 *
 * The same work as the full list, because the count is the length of it:
 * whether a movement fulfils an occurrence is decided by comparing the two,
 * and there is no cheaper question to ask the database. Called from the shell
 * for a nav badge, where it is one extra round of three indexed reads.
 */
export async function countFulfilmentProposals(
  db: Db,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): Promise<number> {
  const proposals = await getFulfilmentProposals(
    db,
    userId,
    templates,
    categories,
    year,
    month,
  );
  return proposals.length;
}
