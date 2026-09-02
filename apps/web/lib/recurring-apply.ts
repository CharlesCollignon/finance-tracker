import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecurringOccurrenceUpdate } from "@finance/core/apply-recurring";
import { getMonthBounds } from "@finance/core/constants";
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
 * Kept out of the server-action module because the daily repricing run needs
 * the same three steps under the service role, and a `"use server"` file
 * cannot export a helper without also publishing it as an action.
 *
 * Every query filters on `user_id`, so these work identically under RLS with
 * the caller's own client and under the service role with a user id chosen by
 * the cron.
 */

type Client = SupabaseClient<Database>;

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

  const skippedKeys = new Set(
    (skips ?? []).map((row) => `${row.template_id}:${row.occurred_on}`),
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
