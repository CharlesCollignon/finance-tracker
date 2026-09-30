import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildApplyRecurringPlan,
  calledForKeys,
  countRecurringToApply,
  followTemplateUpdates,
  forecastsNoLongerCalledFor,
  pastOccurrencesNotWritten,
  recurringOccurrenceKey,
  type RecurringOccurrenceUpdate,
} from "@finance/core/apply-recurring";
import { getCurrentMonth, getMonthBounds } from "@finance/core/constants";
import {
  isQuotePriced,
  resolveRecurringAmount,
} from "@finance/core/recurring-shares";
import { quoteSource } from "@/lib/quote-source";
import type {
  Database,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

/**
 * The reads and writes behind applying recurring templates.
 *
 * Kept out of the server-action module because the daily run needs the same
 * steps under the service role, and a `"use server"` file cannot export a
 * helper without also publishing it as an action.
 *
 * Every query filters on `user_id`, so these work identically under RLS with
 * the caller's own client and under the service role with a user id chosen by
 * the cron.
 */

type Client = SupabaseClient<Database>;

/** PostgREST's and PostgreSQL's ways of saying a table is not there yet. */
const MISSING_SCHEMA = new Set(["PGRST205", "42P01", "42703"]);

export interface ExistingRecurringTx {
  id: string;
  amount: number;
  note: string | null;
  category_id: string;
}

export async function loadApplyRecurringData(
  supabase: Client,
  userId: string,
  year: number,
  month: number,
) {
  const { start, end } = getMonthBounds(year, month);

  const [
    { data: templates, error: tplError },
    { data: transactions, error: txError },
    { data: skips, error: skipError },
    { data: fulfilments, error: fulfilmentError },
  ] = await Promise.all([
    supabase
      .from("recurring_templates")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("transactions")
      .select(
        "id, amount, note, category_id, recurring_template_id, occurred_on",
      )
      .eq("user_id", userId)
      .not("recurring_template_id", "is", null)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    supabase
      .from("recurring_skips")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    supabase
      .from("recurring_fulfilments")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
  ]);

  if (tplError) {
    throw new Error(tplError.message);
  }

  if (txError) {
    throw new Error(txError.message);
  }

  if (skipError) {
    throw new Error(skipError.message);
  }

  // Missing only before migration 023, where nothing can have been fulfilled.
  if (fulfilmentError && !MISSING_SCHEMA.has(fulfilmentError.code)) {
    throw new Error(fulfilmentError.message);
  }

  const existingByKey = new Map<string, ExistingRecurringTx>();

  for (const tx of transactions ?? []) {
    if (!tx.recurring_template_id) {
      continue;
    }

    existingByKey.set(`${tx.recurring_template_id}:${tx.occurred_on}`, {
      id: tx.id,
      amount: Number(tx.amount),
      note: tx.note,
      category_id: tx.category_id,
    });
  }

  // A fulfilled occurrence is already in the ledger, as the movement the
  // user confirmed it was. Writing the template's row as well would count it
  // twice, so to anything that writes it is as good as skipped.
  const skippedKeys = new Set(
    [...(skips ?? []), ...(fulfilments ?? [])].map(
      (row) => `${row.template_id}:${row.occurred_on}`,
    ),
  );

  return {
    templates: (templates ?? []) as RecurringTemplateWithCategory[],
    existingByKey,
    skippedKeys,
  };
}

/**
 * Write a plan's repricing through.
 *
 * These occurrences are entirely derived from their template — a forecast of
 * a purchase that has not happened yet — so the whole row is brought back in
 * line, category included. There is nothing here the user typed to preserve.
 */
export async function writeReprices(
  supabase: Client,
  userId: string,
  reprices: readonly RecurringOccurrenceUpdate[],
): Promise<{ repriced: number; failures: string[] }> {
  let repriced = 0;
  const failures: string[] = [];

  for (const item of reprices) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: item.amount,
        note: item.note,
        category_id: item.categoryId,
      })
      .eq("id", item.transactionId)
      .eq("user_id", userId);

    if (error) {
      failures.push(error.message);
      continue;
    }

    repriced += 1;
  }

  return { repriced, failures };
}

/**
 * Bring each quote-priced template's stored price up to date.
 *
 * `last_quote_price` is what an occurrence falls back to when the market
 * cannot be reached, and the stored `amount` is what projections and the
 * recurring screen read without pricing anything themselves. Both go stale on
 * their own, so something has to touch them even in a month where nothing is
 * applied.
 */
export async function refreshTemplateQuotes(
  supabase: Client,
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
): Promise<number> {
  let refreshed = 0;

  for (const template of templates) {
    if (
      !isQuotePriced({
        pricing_type: template.pricing_type ?? "fixed",
        share_count: template.share_count,
        instrument_symbol: template.instrument_symbol,
      })
    ) {
      continue;
    }

    let quoteUpdate: {
      amount: number;
      last_quote_price: number;
      last_quote_at: string;
    } | null = null;

    try {
      const resolved = await resolveRecurringAmount(
        {
          pricing_type: template.pricing_type ?? "fixed",
          amount: Number(template.amount),
          share_count: template.share_count,
          instrument_symbol: template.instrument_symbol,
          instrument_name: template.instrument_name,
          description: template.description,
          last_quote_price: template.last_quote_price,
        },
        quoteSource,
      );
      quoteUpdate = resolved.quoteUpdate;
    } catch {
      // No price and nothing to fall back to. Leaving the stored figures as
      // they are beats overwriting them with a guess.
      continue;
    }

    if (!quoteUpdate) {
      continue;
    }

    const { error } = await supabase
      .from("recurring_templates")
      .update(quoteUpdate)
      .eq("id", template.id)
      .eq("user_id", userId);

    if (!error) {
      refreshed += 1;
    }
  }

  return refreshed;
}

/**
 * Whether this user's ledger is fed by a bank — `hasBankFeed`, for a client
 * that is not the request's own. The daily run asks it of every user under
 * the service role, where the request-scoped query has nobody to ask about.
 */
export async function isBankFed(
  supabase: Client,
  userId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}

/** PostgreSQL's unique-violation code: the row is already there. */
const ALREADY_WRITTEN = "23505";

/**
 * Write the occurrences of one month whose day has come and that are not in
 * the ledger yet.
 *
 * Only what is due — see `isDue`. Everything after today stays planned: the
 * ledger draws it from the template, and it is written here on its day. That
 * is what lets a charge's months ahead change the moment the charge does,
 * with nothing stored to bring back in line. Nobody is asked, because the
 * templates are instructions the user already gave; only `toCreate` is
 * written, since a row that differs from its template may be one the user
 * corrected. Repricing rides along because the write is already open.
 *
 * Asked on nearly every visit and nearly always answered "nothing", so the
 * question is put first without pricing anything. Safe to run twice at once:
 * the unique index on (template, date) turns the slower run's inserts into
 * no-ops.
 *
 * `only` writes named occurrences whose day has come even from before the
 * template was set up — the user asking for them by name, when creating a
 * charge with "include this month" or bringing a skipped one back — without
 * filling in anything else.
 *
 * The caller decides whether templates may write at all. With a bank feeding
 * the ledger they only forecast — see `hasBankFeed`.
 */
export async function fillMonth(
  supabase: Client,
  userId: string,
  year: number,
  month: number,
  today: string,
  only?: ReadonlySet<string>,
): Promise<{ created: number; failures: string[] }> {
  const { templates, existingByKey, skippedKeys } =
    await loadApplyRecurringData(supabase, userId, year, month);

  // Named occurrences are checked against today only; the rest must be due.
  const dueBy = only ? undefined : today;

  const waiting = countRecurringToApply(
    templates,
    new Set(existingByKey.keys()),
    year,
    month,
    skippedKeys,
    dueBy,
  );
  if (waiting === 0) {
    return { created: 0, failures: [] };
  }

  const plan = await buildApplyRecurringPlan(
    templates,
    existingByKey,
    year,
    month,
    { quotes: quoteSource, skippedKeys, today, dueBy },
  );

  let created = 0;
  const failures: string[] = [];
  const priced = new Set<string>();

  for (const item of plan.toCreate) {
    if (
      only &&
      (!only.has(recurringOccurrenceKey(item.templateId, item.occurredOn)) ||
        item.occurredOn > today)
    ) {
      continue;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      category_id: item.categoryId,
      recurring_template_id: item.templateId,
      occurred_on: item.occurredOn,
      amount: item.amount,
      note: item.note,
    });

    if (error) {
      if (error.code !== ALREADY_WRITTEN) {
        failures.push(error.message);
      }
      continue;
    }

    created += 1;
    if (item.pricedFromQuote) {
      priced.add(item.templateId);
    }
  }

  // The price each new row was written at becomes the template's fallback,
  // so a month whose quote cannot be fetched is priced from the latest one.
  if (priced.size > 0) {
    await refreshTemplateQuotes(
      supabase,
      userId,
      templates.filter((template) => priced.has(template.id)),
    );
  }

  const reprices = await writeReprices(supabase, userId, plan.toReprice);
  failures.push(...reprices.failures);

  return { created, failures };
}

/** The month before, and this one: what a fill looks at. */
function fillWindow(): { year: number; month: number }[] {
  const current = getCurrentMonth();
  const previous =
    current.month === 1
      ? { year: current.year - 1, month: 12 }
      : { year: current.year, month: current.month - 1 };
  return [previous, current];
}

/**
 * Write every occurrence that has come due and is not written yet.
 *
 * The month before is looked at as well as this one. A charge on the 31st is
 * written on the 31st by the daily run or by whoever opens the app — and if
 * neither happened, it would otherwise slip through when the month turned.
 * Looking back is safe because only due occurrences are written: nothing from
 * before a charge was set up, and nothing a skip has taken out.
 */
export async function fillDue(
  supabase: Client,
  userId: string,
  today: string,
): Promise<{ created: number; failures: string[] }> {
  let created = 0;
  const failures: string[] = [];

  for (const { year, month } of fillWindow()) {
    const result = await fillMonth(supabase, userId, year, month, today);
    created += result.created;
    failures.push(...result.failures);
  }

  return { created, failures };
}

/**
 * Bring what one template has written in line with the template, right after
 * the user changed it.
 *
 * The months ahead need nothing: their occurrences are planned, drawn from
 * the template each time the ledger is read. What is left to decide is the
 * rows already written, and `from` is the user's answer — tomorrow for
 * "upcoming only", the first of this month for "this month too". Rows from
 * then on take the template's new amount, note and category; rows before it
 * are what happened and keep what they say. Past months are never reached,
 * whatever the answer.
 *
 * When `reschedule` is set — the template moved to another day, stopped, or
 * started again — two more things. The days its new schedule calls for that
 * have already come, this month and last, are skipped rather than filled:
 * this month's occurrence already happened on the old day, or the charge was
 * off. And rows written ahead of today that it no longer calls for are
 * removed. It is the caller's to set, because a row the user moved to another
 * date by hand is not called for either, and only a change to the template's
 * own schedule is a reason to take it away.
 */
export async function followTemplate(
  supabase: Client,
  userId: string,
  templateId: string,
  options: { today: string; from: string; reschedule: boolean },
): Promise<{ failures: string[] }> {
  const { today, from, reschedule } = options;
  const failures: string[] = [];

  if (reschedule) {
    for (const { year, month } of fillWindow()) {
      const { templates, existingByKey, skippedKeys } =
        await loadApplyRecurringData(supabase, userId, year, month);
      const skipError = await skipOccurrences(
        supabase,
        userId,
        pastOccurrencesNotWritten(
          templates.filter((template) => template.id === templateId),
          new Set(existingByKey.keys()),
          year,
          month,
          skippedKeys,
          today,
        ),
      );
      if (skipError) {
        failures.push(skipError);
      }
    }
  }

  const filled = await fillDue(supabase, userId, today);
  failures.push(...filled.failures);

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id, occurred_on")
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .gte("occurred_on", from < today ? from : today);

  if (error) {
    return { failures: [...failures, error.message] };
  }

  const months = new Set(
    (rows ?? []).map((row) => String(row.occurred_on).slice(0, 7)),
  );

  for (const monthKey of months) {
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) {
      continue;
    }

    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(supabase, userId, year, month);
    const plan = await buildApplyRecurringPlan(
      templates,
      existingByKey,
      year,
      month,
      { quotes: quoteSource, skippedKeys, today },
    );

    const updates = await writeReprices(
      supabase,
      userId,
      followTemplateUpdates(plan, templateId, from),
    );
    failures.push(...updates.failures);

    if (!reschedule) {
      continue;
    }

    const stale = forecastsNoLongerCalledFor(
      (rows ?? [])
        .filter((row) => String(row.occurred_on).startsWith(monthKey))
        .map((row) => ({
          id: row.id,
          templateId,
          occurredOn: String(row.occurred_on),
        })),
      calledForKeys(templates, year, month, skippedKeys),
      today,
    );

    if (stale.length > 0) {
      const { error: removeError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .in("id", stale);
      if (removeError) {
        failures.push(removeError.message);
      }
    }
  }

  return { failures };
}

/**
 * Take away the rows a template wrote ahead of today, before the template
 * itself goes. Once it is deleted its rows lose the link that says where they
 * came from, and a charge nobody pays any more would sit in next week's
 * ledger as an ordinary transaction. Today's row stays: it has been recorded.
 *
 * Only rows written ahead before occurrences were planned rather than stored
 * can be there at all.
 */
export async function removeTemplateForecasts(
  supabase: Client,
  userId: string,
  templateId: string,
  today: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .gt("occurred_on", today);

  return error?.message ?? null;
}

/**
 * Remember that the user took an occurrence out of its month, so filling the
 * month does not write it straight back.
 *
 * Deleting a row a template wrote, or moving it to another date, leaves its
 * occurrence unwritten — and a month that fills itself would recreate it the
 * next time the app opened. Recording the skip is what makes those two edits
 * stick, the same way Skip always did.
 */
export async function skipOccurrences(
  supabase: Client,
  userId: string,
  occurrences: readonly { templateId: string; occurredOn: string }[],
): Promise<string | null> {
  if (occurrences.length === 0) {
    return null;
  }

  const { error } = await supabase.from("recurring_skips").upsert(
    occurrences.map((occurrence) => ({
      user_id: userId,
      template_id: occurrence.templateId,
      occurred_on: occurrence.occurredOn,
    })),
    // Only ever inserted: the table has no update policy, so a skip that
    // is already there has to be left alone rather than written over.
    { onConflict: "user_id,template_id,occurred_on", ignoreDuplicates: true },
  );

  return error?.message ?? null;
}
