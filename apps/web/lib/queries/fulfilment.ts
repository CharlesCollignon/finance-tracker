import {
  explainFulfilmentMisses,
  proposeFulfilments,
  refusalKey,
  type FulfilmentMiss,
  type FulfilmentMovement,
  type FulfilmentOccurrence,
  type FulfilmentProposal,
  type ProposeOptions,
} from "@finance/core/recurring-fulfilment";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "@finance/core/recurrence";
import { getMonthBounds, todayIsoLocal } from "@finance/core/constants";
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

/**
 * Whether an error means "this feature's schema is not here yet".
 *
 * Same three codes as the other optional features. Before migration 023 the
 * tables do not exist, and a screen people use every day must not fall over
 * because an enhancement's migration has not been run.
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

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
 * Every occurrence a month's active templates call for.
 *
 * The whole month rather than only the past: a charge due on the 5th that the
 * bank paid on the 3rd is still a future occurrence on the 4th, and it is
 * exactly the one worth asking about. The date window in
 * `proposeFulfilments` is what keeps that honest.
 */
function occurrencesFor(
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
): FulfilmentOccurrence[] {
  const byId = new Map(categories.map((c) => [c.id, c] as const));
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const out: FulfilmentOccurrence[] = [];

  for (const template of templates) {
    if (!template.active) {
      continue;
    }
    const category = byId.get(template.category_id);
    if (!category) {
      continue;
    }

    const dates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        year,
        month,
      ),
      template.starts_on,
      template.ends_on,
    ).filter((date) => date.startsWith(monthPrefix));

    for (const date of dates) {
      out.push({
        templateId: template.id,
        occurredOn: date,
        amount: Number(template.amount),
        categoryId: template.category_id,
        categoryType: category.type,
        label: template.description?.trim() || category.name,
      });
    }
  }

  return out;
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

export async function getFulfilmentReport(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Category[],
  year: number,
  month: number,
  client?: Client,
): Promise<FulfilmentReport> {
  const occurrences = occurrencesFor(templates, categories, year, month);
  if (occurrences.length === 0) {
    return { proposals: [], misses: [] };
  }

  const { movements, options } = await readCandidates(
    userId,
    year,
    month,
    client,
  );
  const proposals = proposeFulfilments(occurrences, movements, options);

  return {
    proposals,
    misses: explainFulfilmentMisses(occurrences, movements, proposals, options),
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
  const occurrences = occurrencesFor(templates, categories, year, month);
  if (occurrences.length === 0) {
    return [];
  }

  const { movements, options } = await readCandidates(
    userId,
    year,
    month,
    client,
  );
  return proposeFulfilments(occurrences, movements, options);
}

/**
 * The movements that could fulfil something this month, and what the user has
 * already decided about them.
 */
async function readCandidates(
  userId: string,
  year: number,
  month: number,
  client?: Client,
): Promise<{ movements: FulfilmentMovement[]; options: ProposeOptions }> {
  const supabase = client ?? (await createClient());
  const { start, end } = getMonthBounds(year, month);

  // A window either side of the month, because a charge due on the 1st can be
  // paid on the last day of the previous month and one due on the 31st on the
  // 2nd of the next.
  const from = shiftDays(start, -5);
  const to = shiftDays(end, 5);

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

function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return date.toISOString().slice(0, 10);
}
