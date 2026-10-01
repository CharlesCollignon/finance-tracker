import type { Translate } from "@finance/core/i18n/t";
import type { PendingNotification } from "@finance/core/push-digest";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * "N bank rows are waiting for a category", for the rows that arrived since
 * the person was last told — or all of them, if they never were.
 *
 * A change rather than a state, so a pile someone has chosen to leave does
 * not buzz them every day; and counted from the last time they were told
 * rather than from this sync, so rows that arrived during the quiet hours,
 * when nothing is sent, are announced the next morning instead of never. At
 * most once a day, by its key.
 */
export async function reviewNotificationFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  t: Translate,
): Promise<PendingNotification | null> {
  const { data: last } = await supabase
    .from("notification_log")
    .select("sent_at")
    .eq("user_id", userId)
    .like("key", "bank-review:%")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (last?.sent_at) {
    query = query.gt("created_at", last.sent_at);
  }
  const { count } = await query;
  if (!count) {
    return null;
  }

  return {
    kind: "review",
    key: `bank-review:${today}`,
    title: t("push.review.title"),
    body: t("push.review.body", { count }),
    // Straight into the review, not onto the Ledger with it shut. A push
    // tapped at breakfast should put the decision in front of the person who
    // tapped it.
    url: "/transactions?review=inbox",
  };
}
