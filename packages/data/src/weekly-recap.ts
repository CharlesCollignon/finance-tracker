import type { ActionResult } from "@finance/core/action-result";
import { getMonthBounds } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import { allRows } from "@finance/core/paging";
import { buildStillToCome } from "@finance/core/still-to-come";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { wantsNotification } from "@finance/core/notification-kinds";
import {
  buildWeeklyRecap,
  mondayOf,
  RECAP_PROMPT,
  recapPrompt,
  showsRecapCard,
  type WeeklyRecap,
} from "@finance/core/weekly-recap";

import { hasBankFeed } from "./bank-feed";
import type { Db } from "./client";
import { getBankForecast, getFulfilledKeys } from "./fulfilment";
import {
  dismissPrompt,
  getNotificationSettings,
  readDismissedPrompts,
} from "./preferences";
import { getRecurringSkipKeys, getRecurringTemplates } from "./templates";

/**
 * The week's recap for one person — the Monday push and the card on Le
 * point read the same facts from here.
 *
 * Reads thirteen months of transactions: a year before this month for each
 * category's normal month, and this one. Paged, since a busy year is past
 * the server's row cap.
 */
export async function getWeeklyRecap(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<WeeklyRecap | null> {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const { start: monthStart, end: monthEnd } = getMonthBounds(year, month);
  // The same month a year ago: twelve months of normal, and this one.
  const { start: from } = getMonthBounds(year - 1, month);

  const [transactions, templates, skipped, fulfilled, waiting, bankFed] =
    await Promise.all([
      allRows((rangeFrom, rangeTo) =>
        db
          .from("transactions")
          .select("*, categories(name, type, icon, counts_toward_summary)")
          .eq("user_id", userId)
          .gte("occurred_on", from)
          // To the month's end rather than today, as the Month page reads it:
          // a charge typed in ahead of its day is not still to come.
          .lte("occurred_on", monthEnd)
          .order("occurred_on", { ascending: true })
          .order("id")
          .range(rangeFrom, rangeTo),
      ),
      getRecurringTemplates(db, userId),
      getRecurringSkipKeys(db, userId, year, month),
      getFulfilledKeys(db, userId),
      db
        .from("bank_feed_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .then(({ count }) => count ?? 0),
      hasBankFeed(db, userId),
    ]);

  const rows = transactions as TransactionWithCategory[];
  const monthKey = monthStart.slice(0, 7);
  const stillToCome = buildStillToCome(
    rows.filter((tx) => tx.occurred_on.startsWith(monthKey)),
    templates.filter((template) => template.active),
    year,
    month,
    today,
    skipped,
    fulfilled,
    bankFed ? await getBankForecast(db, userId, templates, today) : null,
  );

  return buildWeeklyRecap({
    today,
    transactions: rows,
    stillToCome,
    waiting,
    locale,
  });
}

/**
 * The recap as Le point's card: early in the week, until it is put away.
 * The switch that stops the Monday push stops the card too — one choice,
 * "no recap", rather than two places to make it.
 */
export async function getWeeklyRecapCard(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<WeeklyRecap | null> {
  if (!showsRecapCard(today)) {
    return null;
  }
  const [{ prefs }, dismissed] = await Promise.all([
    getNotificationSettings(db, userId),
    readDismissedPrompts(db, userId),
  ]);
  if (
    !wantsNotification(prefs, "recap") ||
    dismissed.includes(recapPrompt(mondayOf(today)))
  ) {
    return null;
  }
  return getWeeklyRecap(db, userId, today, locale);
}

/** Put this week's card away, on every device. */
export function dismissWeeklyRecap(
  db: Db,
  userId: string,
  weekOf: string,
  locale: Locale,
): Promise<ActionResult> {
  return dismissPrompt(db, userId, recapPrompt(weekOf), locale, {
    replacing: RECAP_PROMPT,
  });
}
