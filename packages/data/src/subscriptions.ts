import { shiftIsoDate } from "@finance/core/constants";
import { allRows } from "@finance/core/paging";
import {
  watchSubscriptions,
  type Subscription,
  type SubscriptionFinding,
} from "@finance/core/subscription-watch";
import type { TransactionWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/** How far back the watch reads: a yearly one needs two of its charges. */
const LOOK_BACK_DAYS = 400;

/**
 * The subscriptions the ledger shows and what changed about them
 * (`watchSubscriptions`), for the « Abonnements » block on Récurrents.
 */
export async function readSubscriptions(
  db: Db,
  userId: string,
  today: string,
): Promise<{ subscriptions: Subscription[]; findings: SubscriptionFinding[] }> {
  const rows = (await allRows((start, end) =>
    db
      .from("transactions")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .gte("occurred_on", shiftIsoDate(today, -LOOK_BACK_DAYS))
      .lte("occurred_on", today)
      .order("occurred_on", { ascending: true })
      .order("id")
      .range(start, end),
  )) as TransactionWithCategory[];

  return watchSubscriptions(
    rows.map((tx) => ({
      occurredOn: tx.occurred_on,
      amount: Number(tx.amount),
      note: tx.note,
      categoryName: tx.categories.name,
      categoryType: tx.categories.type,
    })),
    today,
  );
}
