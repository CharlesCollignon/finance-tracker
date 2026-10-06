import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { isPurchaseInsideWallet } from "@finance/core/categories";
import { shiftIsoDate } from "@finance/core/constants";
import {
  PURCHASE_ASK_DAYS,
  purchasesToConfirm,
  type PurchaseToConfirm,
} from "@finance/core/purchases-to-confirm";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/**
 * The purchases inside a wallet waiting for a yes or a no, for a ledger a
 * bank feeds — see `purchasesToConfirm`. From the templates and confirmed
 * occurrences the caller has already read; what it adds is the rows and
 * skips of the few days the question is asked over.
 */
export async function getPurchasesToConfirm(
  db: Db,
  userId: string,
  {
    templates,
    fulfilledKeys,
    debited,
    today,
  }: {
    templates: readonly RecurringTemplateWithCategory[];
    fulfilledKeys: ReadonlySet<string>;
    /** `walletCategoriesTheBankDebits`: their debits settle them instead. */
    debited: ReadonlySet<string>;
    today: string;
  },
): Promise<PurchaseToConfirm[]> {
  const ids = templates
    .filter(
      (template) =>
        template.active &&
        isPurchaseInsideWallet(template.categories) &&
        !debited.has(template.category_id),
    )
    .map((template) => template.id);
  if (ids.length === 0) {
    return [];
  }

  const from = shiftIsoDate(today, -PURCHASE_ASK_DAYS);
  const [written, skipped] = await Promise.all([
    db
      .from("transactions")
      .select("recurring_template_id, occurred_on")
      .eq("user_id", userId)
      .in("recurring_template_id", ids)
      .gte("occurred_on", from)
      .lte("occurred_on", today),
    db
      .from("recurring_skips")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .in("template_id", ids)
      .gte("occurred_on", from)
      .lte("occurred_on", today),
  ]);
  if (written.error) {
    throw written.error;
  }
  if (skipped.error) {
    throw skipped.error;
  }

  return purchasesToConfirm({
    templates,
    writtenKeys: new Set(
      (written.data ?? []).map((row) =>
        recurringOccurrenceKey(row.recurring_template_id!, row.occurred_on),
      ),
    ),
    settledKeys: new Set([
      ...fulfilledKeys,
      ...(skipped.data ?? []).map((row) =>
        recurringOccurrenceKey(row.template_id, row.occurred_on),
      ),
    ]),
    debited,
    today,
  });
}
