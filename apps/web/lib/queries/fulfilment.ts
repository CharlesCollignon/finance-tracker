import { isMissingSchema } from "@finance/data/schema";
import {
  explainFulfilmentMisses,
  fulfilmentOccurrences,
  fulfilmentScope,
  proposalsForMonth,
  proposeFulfilments,
  refusalKey,
  type FulfilmentMiss,
  type FulfilmentMovement,
  type FulfilmentProposal,
  type ProposeOptions,
} from "@finance/core/recurring-fulfilment";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { todayIsoLocal } from "@finance/core/constants";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * The client to read through. Defaults to the caller's session; the
 * unattended digest hands in the service role, which has no session to read
 * a user id from.
 */
type Client = SupabaseClient<Database>;

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
  userId: string,
  client?: Client,
): Promise<Set<string>> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
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
  userId: string,
  client?: Client,
): Promise<Set<string>> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
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
  /**
   * Occurrences with no proposal, and the rule that excluded the nearest
   * candidate. Shown as one collapsed line, so a narrow matcher is legible
   * rather than merely silent.
   */
  misses: FulfilmentMiss[];
}

/**
 * A month's questions: the pairings planned in it, and the ones whose money
 * moved in it — the October salary paid on 22 September is asked about in
 * September as well as in October (`fulfilmentScope`). Matched across the
 * three months at once, so one payment is never offered for two of them.
 */
async function monthQuestions(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Client,
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
    userId,
    scope.from,
    scope.to,
    client,
  );
  const all = proposeFulfilments(occurrences, movements, options);
  return { occurrences, movements, options, all };
}

export async function getFulfilmentReport(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Client,
): Promise<FulfilmentReport> {
  const asked = await monthQuestions(
    userId,
    templates,
    categories,
    year,
    month,
    client,
  );
  if (!asked) {
    return { proposals: [], misses: [] };
  }

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return {
    proposals: proposalsForMonth(asked.all, year, month),
    // Only this month's occurrences can be missing from it.
    misses: explainFulfilmentMisses(
      asked.occurrences.filter((occurrence) =>
        occurrence.occurredOn.startsWith(monthKey),
      ),
      asked.movements,
      asked.all,
      asked.options,
    ),
  };
}

export async function getFulfilmentProposals(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Client,
): Promise<FulfilmentProposal[]> {
  const asked = await monthQuestions(
    userId,
    templates,
    categories,
    year,
    month,
    client,
  );
  return asked ? proposalsForMonth(asked.all, year, month) : [];
}

/**
 * The movements that could fulfil something between two days, and what the
 * user has already decided about them.
 */
async function readCandidates(
  userId: string,
  from: string,
  to: string,
  client?: Client,
): Promise<{ movements: FulfilmentMovement[]; options: ProposeOptions }> {
  const supabase = client ?? (await createClient());

  const [
    { data: transactions, error: txError },
    { data: fulfilments, error: fulfilError },
    { data: refusals, error: refusalError },
  ] = await Promise.all([
    // Only rows no template wrote. A row a template wrote is already the
    // occurrence; asking whether it fulfils one would be asking whether it is
    // itself.
    supabase
      .from("transactions")
      .select("id, occurred_on, amount, category_id, note")
      .eq("user_id", userId)
      .is("recurring_template_id", null)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("recurring_fulfilments")
      .select("template_id, occurred_on, transaction_id")
      .eq("user_id", userId),
    supabase
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
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Client,
): Promise<number> {
  const proposals = await getFulfilmentProposals(
    userId,
    templates,
    categories,
    year,
    month,
    client,
  );
  return proposals.length;
}
