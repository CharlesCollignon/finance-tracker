import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { shiftIsoDate } from "@finance/core/constants";
import { dcaNeedForMonth, transferCoversMonth } from "@finance/core/dca-need";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

import { walletCategoriesTheBankDebits } from "./bank-feed";
import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * Bring each transfer that follows the DCAs (`pricing_type = 'purchases'`)
 * to what the month it covers needs (`dcaNeedForMonth`).
 *
 * Stored in the template's `amount`, the way a share-priced template's last
 * quote is: every reader of a template's amount — the forecast, the
 * projection, the month's fill, « C'est arrivé ? » — then reads the figure
 * without knowing how it was reached. Run where those figures can move: the
 * daily quote refresh, the app opening, and a charge or one of its days
 * changing. Only what differs is written.
 *
 * A month with no purchase at all leaves the amount as it was: a template
 * cannot be zero, and a month without DCAs is one with nothing to follow.
 *
 * Returns the error, if a write failed.
 */
export async function followPurchases(
  db: Db,
  userId: string,
  today: string,
): Promise<string | null> {
  const { data: rows, error } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) {
    return dbError(error);
  }

  const templates = (rows ?? []) as RecurringTemplateWithCategory[];
  const transfers = templates.filter(
    (template) => template.pricing_type === "purchases",
  );
  if (transfers.length === 0) {
    return null;
  }

  // What has already settled a transfer's occurrence, from the earliest one
  // still in play: confirmed against the bank, written, or skipped.
  const from = shiftIsoDate(today, -31);
  const ids = transfers.map((transfer) => transfer.id);
  const [fulfilled, written, skipped, debited] = await Promise.all([
    db
      .from("recurring_fulfilments")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .in("template_id", ids)
      .gte("occurred_on", from),
    db
      .from("transactions")
      .select("recurring_template_id, occurred_on")
      .eq("user_id", userId)
      .in("recurring_template_id", ids)
      .gte("occurred_on", from),
    db
      .from("recurring_skips")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", from),
    walletCategoriesTheBankDebits(db, userId),
  ]);
  for (const result of [fulfilled, written, skipped]) {
    if (result.error) {
      return dbError(result.error);
    }
  }

  const settledKeys = new Set([
    ...(fulfilled.data ?? []).map((row) =>
      recurringOccurrenceKey(row.template_id, row.occurred_on),
    ),
    ...(written.data ?? []).map((row) =>
      recurringOccurrenceKey(row.recurring_template_id!, row.occurred_on),
    ),
  ]);
  // Skips of the transfers settle them; skips of the DCAs take a purchase
  // out of the month it would have been bought in.
  const skippedKeys = new Set(
    (skipped.data ?? []).map((row) =>
      recurringOccurrenceKey(row.template_id, row.occurred_on),
    ),
  );

  for (const transfer of transfers) {
    const covered = transferCoversMonth(
      transfer,
      today,
      new Set([...settledKeys, ...skippedKeys]),
    );
    if (!covered) {
      continue;
    }
    const need = dcaNeedForMonth({
      templates,
      debited,
      skippedKeys,
      year: covered.year,
      month: covered.month,
    });
    if (need.amount <= 0 || need.amount === Number(transfer.amount)) {
      continue;
    }
    const { error: updateError } = await db
      .from("recurring_templates")
      .update({ amount: need.amount })
      .eq("id", transfer.id)
      .eq("user_id", userId);
    if (updateError) {
      return dbError(updateError);
    }
  }

  return null;
}
