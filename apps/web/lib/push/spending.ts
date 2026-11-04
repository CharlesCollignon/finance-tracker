import { shiftIsoDate } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { Translate } from "@finance/core/i18n/t";
import type { PendingNotification } from "@finance/core/push-digest";
import {
  newSpendingNotification,
  type NewSpending,
} from "@finance/core/push-messages";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * How recent a debit has to be to be news. A statement read for a past
 * month, or a first connection bringing ninety days, files rows that are new
 * to the app and old to the person; a payment from last week is not a « new
 * spending » however late it arrived.
 */
const NEWS_DAYS = 3;

/** Before anything was ever said: the day before, not the whole history. */
const FIRST_LOOK_MS = 24 * 60 * 60 * 1000;

/** Money put by, not spent: a transfer to savings or to a broker. */
const NOT_SPENDING = new Set(["savings", "investment"]);

/**
 * « Nouvelles dépenses »: the debits the bank brought since the person was
 * last told, for the refresh to say straight after the sync.
 *
 * Counted from the last time it was said rather than from this sync, like
 * the review: a held push (the quiet hours) is not logged, so what came in
 * overnight is said on the first run of the morning. When the review is due
 * on the same run, this one says it too and covers it, so the rows that need
 * a category do not buzz twice.
 */
export async function spendingNotificationFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  voice: { t: Translate; locale: Locale },
  review: PendingNotification | null,
  now: Date = new Date(),
): Promise<PendingNotification | null> {
  const { data: last } = await supabase
    .from("notification_log")
    .select("sent_at")
    .eq("user_id", userId)
    .like("key", "spending:%")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const since =
    last?.sent_at ?? new Date(now.getTime() - FIRST_LOOK_MS).toISOString();

  const { data: rows } = await supabase
    .from("bank_feed_items")
    .select("amount, counterparty, note, transaction_id, created_at")
    .eq("user_id", userId)
    .eq("direction", "out")
    .neq("status", "ignored")
    .gt("created_at", since)
    .gte("occurred_on", shiftIsoDate(today, -NEWS_DAYS))
    .order("created_at", { ascending: true });
  if (!rows || rows.length === 0) {
    return null;
  }

  // What the sync filed as money put by is left out. A row still in the
  // inbox has no category yet, and is said: it left the account.
  const filed = rows
    .map((row) => row.transaction_id)
    .filter((id): id is string => id !== null);
  const putBy = new Set<string>();
  if (filed.length > 0) {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, categories(type)")
      .eq("user_id", userId)
      .in("id", filed);
    for (const transaction of transactions ?? []) {
      if (NOT_SPENDING.has(transaction.categories?.type ?? "")) {
        putBy.add(transaction.id);
      }
    }
  }
  const spending: NewSpending[] = rows
    .filter((row) => !row.transaction_id || !putBy.has(row.transaction_id))
    .map((row) => ({
      amount: Math.abs(Number(row.amount)),
      counterparty: row.counterparty,
      note: row.note,
    }));

  let toSort = 0;
  if (review) {
    const { count } = await supabase
      .from("bank_feed_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    toSort = count ?? 0;
  }

  return newSpendingNotification({
    rows: spending,
    toSort,
    key: `spending:${rows.at(-1)!.created_at}`,
    covers: review?.key,
    ...voice,
  });
}
