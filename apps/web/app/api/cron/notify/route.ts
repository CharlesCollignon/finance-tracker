import type { NextRequest } from "next/server";
import { countFulfilmentProposals } from "@/lib/queries/fulfilment";
import {
  buildDueNotifications,
  type PendingNotification,
} from "@finance/core/push-digest";
import { configureWebPush, readDevices } from "@/lib/push/send";
import { deliver } from "@/lib/push/deliver";
import {
  bankAttention,
  bankAttentionNotification,
} from "@finance/core/bank-attention";
import {
  formatShortDate,
  getCurrentMonth,
  shiftIsoDate,
  todayIsoLocal,
} from "@finance/core/constants";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultRecipient,
  readRecipients,
  type Recipient,
} from "@finance/data/preferences";
import { milestoneToAnnounce } from "@finance/core/future-plan";
import { wantsNotification } from "@finance/core/notification-kinds";
import { getWealthToday } from "@finance/data/plan-wealth";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  cents,
  loanSchedule,
  monthlyOutlay,
  outstandingOn,
} from "@finance/core/loan-schedule";
import { loanTermsFromRow, propertyPosition } from "@finance/core/property";
import { equityMoment, loanMoment } from "@finance/core/property-moments";
import { getProperties } from "@finance/data/properties";
import {
  bigChargeHeadsUp,
  bigCharges,
  closeReminder,
  equityMomentNotification,
  loanMomentNotification,
  milestoneNotification,
  overdraftWarning,
  plannedChargesOn,
  purchasesToConfirmNotification,
  transferReminderNotification,
  usualChargeAmount,
  weeklyRecapNotification,
} from "@finance/core/push-messages";
import { mondayOf } from "@finance/core/weekly-recap";
import { readCurrentMonthBalance } from "@finance/data/month-balance";
import { getWeeklyRecap } from "@finance/data/weekly-recap";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { getFulfilledKeys } from "@finance/data/fulfilment";
import { getMonthCloseOverview } from "@finance/data/month-close";
import {
  hasBankFeed,
  walletCategoriesTheBankDebits,
} from "@finance/data/bank-feed";
import { getPurchasesToConfirm } from "@finance/data/purchases-to-confirm";
import { getTransferReminder } from "@finance/data/dca-transfer";

/**
 * The daily notification run.
 *
 * What counts as worth saying lives in `@finance/core/push-digest`, which is
 * tested; how to reach a device lives in `lib/push/send`. This file is what
 * is left: who to ask about, and what to log.
 *
 * It used to say, here, that "mobile schedules its reminders on the device;
 * the web cannot" — and so only browsers were sent to. Half right. The phone
 * can schedule a reminder, because a reminder is something it already knows;
 * it cannot know that the bank delivered the salary overnight or that a
 * connection is about to stop. Those are the things this run says, and the
 * phone was the one place they were never said. It now gets them too.
 *
 * Runs under the service role, so it sees every user. It is reachable only
 * with the cron secret.
 */

// Sending is sequential and network-bound; the default 10s is not enough.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // A missing secret fails closed: an unprotected endpoint that notifies
  // every user is worse than one that never runs.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Not a reason to stop. Web Push needs VAPID keys this deployment may not
  // have; Expo needs none, so a run with no keys can still reach every phone
  // and only skips the browsers.
  const webPushReady = configureWebPush();

  const supabase = createAdminClient();
  if (!supabase) {
    // Without the service role key the run cannot see other users' data, and
    // silently notifying nobody would look identical to a healthy run.
    return Response.json(
      { skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." },
      { status: 200 },
    );
  }

  const today = todayIsoLocal();
  const { year, month } = getCurrentMonth();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  // Only users who asked to hear from us are worth querying for — a browser
  // that granted permission, a phone that registered a token, or both.
  const byUser = await readDevices(supabase);

  // One read for everybody's language and choices, rather than one per user
  // inside the loop below. There is no browser in a cron request and no
  // session either, so the preferences row is the only place either can come
  // from.
  const recipients = await readRecipients(supabase, [...byUser.keys()]);

  let sent = 0;
  let held = 0;

  for (const [userId, devices] of byUser) {
    const recipient = recipients.get(userId) ?? defaultRecipient();
    const due = await notificationsFor(
      supabase,
      userId,
      today,
      monthKey,
      recipient,
    );
    const delivery = await deliver(supabase, userId, recipient, due, {
      devices,
      webPushReady,
    });
    sent += delivery.sent;
    held += delivery.held;
  }

  return Response.json({
    users: byUser.size,
    sent,
    held,
    ...(webPushReady
      ? {}
      : { note: "Web Push is not configured; phones only." }),
  });
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** What this one user should hear about today. */
async function notificationsFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  monthKey: string,
  recipient: Recipient,
): Promise<PendingNotification[]> {
  const { locale } = recipient;
  const [year, month] = monthKey.split("-").map(Number);

  const [categories, templates] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", userId),
    supabase
      .from("recurring_templates")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("active", true),
  ]);

  const categoryRows = (categories.data ?? []) as Category[];
  const templateRows = (templates.data ??
    []) as RecurringTemplateWithCategory[];

  // Ahead of the digest: an account about to go below zero and a feed about
  // to stop are the things here that get worse by waiting, and neither needs
  // a template. Nor does the reading day, which belongs to anyone who closes
  // their months, or the Monday recap, which belongs to anyone with a ledger.
  const [overdraft, bank, close, recap, milestone] = await Promise.all([
    overdraftFor(supabase, userId, today, locale),
    bankNotificationFor(supabase, userId, today, locale),
    closeReminderFor(supabase, userId, today, locale),
    recapFor(supabase, userId, today, locale),
    milestoneFor(supabase, userId, today, recipient),
  ]);
  const lead = [overdraft, bank, close, recap, milestone]
    .filter(
      (notification): notification is PendingNotification =>
        notification !== null,
    )
    .concat(await propertyMomentsFor(supabase, userId, today, recipient));

  // Nothing else to say to someone with no templates.
  if (templateRows.length === 0) {
    return lead;
  }

  // Asked here rather than in `buildDueNotifications`, which is deliberately
  // free of database concerns. A failure is not worth losing the rest of the
  // digest over: the Month page asks the same question on every visit.
  let arrivedCharges = 0;
  try {
    arrivedCharges = await countFulfilmentProposals(
      userId,
      templateRows,
      categoryRows,
      year!,
      month!,
      supabase,
    );
  } catch {
    arrivedCharges = 0;
  }

  const digest = buildDueNotifications({
    today,
    arrivedCharges,
    // What was already said is `deliver`'s to filter, by exact key.
    alreadySent: new Set(),
    pendingRecurring: templateRows.length,
    // Stored per user precisely so that this line can be right: there is no
    // browser in a cron request to ask.
    t: translator(locale),
  });

  const [heads, purchases, transfer] = await Promise.all([
    bigChargeFor(supabase, userId, today, templateRows, locale),
    purchasesFor(supabase, userId, today, templateRows, recipient),
    transferFor(supabase, userId, today, recipient),
  ]);
  return [
    ...lead,
    ...digest,
    ...(heads ? [heads] : []),
    ...(purchases ? [purchases] : []),
    ...(transfer ? [transfer] : []),
  ];
}

/**
 * How much to send to the broker for next month's DCAs, from two days
 * before the 1st — once for each month it covers, by its key.
 */
async function transferFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  { locale, prefs }: Recipient,
): Promise<PendingNotification | null> {
  if (!wantsNotification(prefs, "dca")) {
    return null;
  }
  const reminder = await getTransferReminder(supabase, userId, today);
  return reminder
    ? transferReminderNotification({
        reminder,
        t: translator(locale),
        locale,
      })
    : null;
}

/**
 * The DCAs still waiting for a yes or a no, the morning after their day.
 * Only with a bank feeding the ledger, the one case where nothing writes
 * them on its own, and only for someone who wants to hear it: telling which
 * wallets the bank debits is a look per category.
 */
async function purchasesFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  templates: readonly RecurringTemplateWithCategory[],
  { locale, prefs }: Recipient,
): Promise<PendingNotification | null> {
  if (!wantsNotification(prefs, "dca")) {
    return null;
  }
  try {
    if (!(await hasBankFeed(supabase, userId))) {
      return null;
    }
    const [fulfilledKeys, debited] = await Promise.all([
      getFulfilledKeys(supabase, userId),
      walletCategoriesTheBankDebits(supabase, userId),
    ]);
    return purchasesToConfirmNotification({
      purchases: await getPurchasesToConfirm(supabase, userId, {
        templates,
        fulfilledKeys,
        debited,
        today,
      }),
      today,
      t: translator(locale),
      locale,
    });
  } catch {
    return null;
  }
}

/**
 * Tomorrow's large or yearly charges, the morning before. Leaves out an
 * occurrence skipped, or one the bank has already been confirmed to have
 * paid, so nobody is warned about money that already left.
 */
async function bigChargeFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  templates: readonly RecurringTemplateWithCategory[],
  locale: Locale,
): Promise<PendingNotification | null> {
  const tomorrow = shiftIsoDate(today, 1);
  try {
    const [{ data: skips }, fulfilled] = await Promise.all([
      supabase
        .from("recurring_skips")
        .select("template_id, occurred_on")
        .eq("user_id", userId)
        .eq("occurred_on", tomorrow),
      getFulfilledKeys(supabase, userId),
    ]);
    const excluded = new Set([
      ...fulfilled,
      ...(skips ?? []).map((row) =>
        recurringOccurrenceKey(row.template_id, row.occurred_on),
      ),
    ]);
    return bigChargeHeadsUp({
      charges: bigCharges(
        plannedChargesOn(templates, tomorrow, excluded),
        usualChargeAmount(templates),
      ),
      tomorrow,
      t: translator(locale),
      locale,
    });
  } catch {
    return null;
  }
}

/**
 * The reminder a connected bank earns today. Whether it was already sent is
 * `deliver`'s to decide, by its exact key.
 */
async function bankNotificationFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  locale: Locale,
): Promise<PendingNotification | null> {
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("status, consent_valid_until, last_synced_at, connected_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) {
    return null;
  }
  const notification = bankAttentionNotification(
    bankAttention(connection, today),
    {
      since: connection.last_synced_at ?? connection.connected_at,
      formatDate: (isoDate) => formatShortDate(isoDate, locale),
      t: translator(locale),
    },
  );
  return notification;
}

/**
 * The day this month the account would go below zero, if one is ahead.
 * Only on a balance read from the bank or a close; see `overdraftWarning`.
 */
async function overdraftFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  locale: Locale,
): Promise<PendingNotification | null> {
  try {
    const { balance, source } = await readCurrentMonthBalance(
      supabase,
      userId,
      today,
      locale,
    );
    return overdraftWarning({
      balance,
      source,
      today,
      t: translator(locale),
      locale,
    });
  } catch {
    return null;
  }
}

/**
 * A milestone passed since the last one the Plan celebrated. Asked only of
 * someone who wants to hear it and has had one celebrated already, because
 * the answer prices every wallet they hold.
 */
async function milestoneFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  { locale, prefs, milestoneSeen }: Recipient,
): Promise<PendingNotification | null> {
  if (milestoneSeen === null || !wantsNotification(prefs, "milestone")) {
    return null;
  }
  try {
    const amount = milestoneToAnnounce(
      await getWealthToday(supabase, userId, today, locale),
      milestoneSeen,
    );
    return amount === null
      ? null
      : milestoneNotification({ amount, t: translator(locale), locale });
  } catch {
    return null;
  }
}

/**
 * A property's moments — a loan half repaid, its last payment, half the home
 * the user's — in the month after the day, each said once by its key. Asked
 * only of someone who wants to hear them; nobody without a property has a
 * row to read.
 */
async function propertyMomentsFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  { locale, prefs }: Recipient,
): Promise<PendingNotification[]> {
  if (!wantsNotification(prefs, "property")) {
    return [];
  }
  try {
    const { properties } = await getProperties(supabase, userId);
    const t = translator(locale);
    return properties.flatMap(({ property, loans, market }) => {
      const named = { id: property.id, name: property.name };
      const forLoans = loans.flatMap((loan) => {
        const moment = loanMoment(loan, today);
        if (!moment) {
          return [];
        }
        const terms = loanTermsFromRow(loan);
        const schedule = loanSchedule(terms);
        const share = Number(loan.borrower_share);
        return [
          loanMomentNotification({
            moment,
            loan: { id: loan.id, label: loan.label },
            property: named,
            owed: cents(outstandingOn(terms, schedule, today) * share),
            monthly: cents(monthlyOutlay(terms, schedule) * share),
            endsOn: schedule.at(-1)?.on ?? null,
            t,
            locale,
          }),
        ];
      });
      const half = equityMoment(property, loans, market, today)
        ? [
            equityMomentNotification({
              property: named,
              value: propertyPosition(property, loans, today, market).value,
              t,
              locale,
            }),
          ]
        : [];
      return [...forLoans, ...half];
    });
  } catch {
    return [];
  }
}

/**
 * Monday's recap of the week before. Only on a Monday: the recap is a state
 * rather than a change, and once a week is the whole of the exception.
 */
async function recapFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  locale: Locale,
): Promise<PendingNotification | null> {
  if (mondayOf(today) !== today) {
    return null;
  }
  try {
    const recap = await getWeeklyRecap(supabase, userId, today, locale);
    return recap
      ? weeklyRecapNotification({ recap, t: translator(locale), locale })
      : null;
  } catch {
    return null;
  }
}

/**
 * The reading day's reminder, when the month it asks about is not closed.
 * A failure is not worth the rest of the digest: the Bearing asks the same
 * question on every visit.
 */
async function closeReminderFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  locale: Locale,
): Promise<PendingNotification | null> {
  try {
    const overview = await getMonthCloseOverview(
      supabase,
      userId,
      today,
      locale,
    );
    return closeReminder({
      next: overview.next,
      today,
      closesSoFar: overview.history.length,
      streak: overview.summary.streak,
      t: translator(locale),
      locale,
    });
  } catch {
    return null;
  }
}
