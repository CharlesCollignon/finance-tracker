/**
 * What the app says in a push, for the things worth saying on their day.
 *
 * Each builder decides whether there is anything to say and, if so, says it
 * in the reader's language — pure, so the decisions are testable without a
 * database, a device or a clock. The crons gather the facts and hand them
 * in; `apps/web/lib/push/deliver` decides whether it is wanted, whether it is
 * the night, and whether it was said already.
 *
 * Every one of these describes something that happened or a day that has
 * come, and every one says the mechanism rather than a nudge: what the
 * figure is and where it comes from, never what the reader should do about
 * their money.
 */

import { recurringOccurrenceKey } from "./apply-recurring";
import {
  formatDayMonth,
  formatEuro,
  formatFullDate,
  formatMonthShortYear,
  formatShortDate,
} from "./constants";
import { monthLong } from "./i18n/calendar-names";
import type { Locale } from "./i18n/locale";
import type { Translate } from "./i18n/t";
import type { MonthBalance } from "./month-balance";
import type { CloseableMonth, MonthCloseResult } from "./month-close";
import type { LoanMoment } from "./property-moments";
import type { PurchaseToConfirm } from "./purchases-to-confirm";
import type { PendingNotification } from "./push-digest";
import {
  getRecurringOccurrenceDates,
  occurrenceWithinSchedule,
} from "./recurrence";
import type { RecurringTemplateWithCategory } from "./types/database";
import { weeklyRecapLines, type WeeklyRecap } from "./weekly-recap";

interface Voice {
  t: Translate;
  locale: Locale;
}

/**
 * The reading day has come and the month is not closed yet.
 *
 * Only for someone who has closed a month before: a first close is set up
 * in the app, where the reason for it can be explained, not from a push.
 * Mentions the run when there is one, because a run is something the reader
 * built and would lose by skipping the close.
 */
export function closeReminder({
  next,
  today,
  closesSoFar,
  streak,
  t,
  locale,
}: Voice & {
  next: CloseableMonth | null;
  today: string;
  closesSoFar: number;
  streak: number;
}): PendingNotification | null {
  if (!next || next.isBaseline || closesSoFar === 0) {
    return null;
  }
  if (today < next.observeOn) {
    return null;
  }
  const month = monthLong(next.month, locale);
  return {
    kind: "close",
    key: `close:${next.monthKey}`,
    title: t("push.close.title", { month }),
    body:
      streak > 0
        ? t("push.close.bodyRun", { month, count: streak })
        : t("push.close.body", { month }),
    url: "/bearing",
  };
}

/**
 * A connected bank gave the balance, and the month closed itself.
 *
 * Says what the close found — what the month left, and what left unrecorded
 * — because that is the figure the reader would have opened the app for.
 */
export function monthClosedByBank({
  monthKey,
  result,
  t,
  locale,
}: Voice & {
  monthKey: string;
  result: MonthCloseResult;
}): PendingNotification {
  const month = monthLong(Number(monthKey.slice(5, 7)), locale);
  const base = {
    kind: "close" as const,
    key: `closed:${monthKey}`,
    title: t("push.closed.title", { month }),
    url: "/bearing",
  };

  if (result.status === "baseline" || result.kept === null) {
    return { ...base, body: t("push.closed.baseline") };
  }
  if (result.status === "over-recorded") {
    return { ...base, body: t("push.closed.overRecorded", { month }) };
  }

  const kept = formatEuro(Math.abs(result.kept), locale);
  const body =
    result.kept >= 0
      ? t("push.closed.kept", { month, amount: kept })
      : t("push.closed.spentMore", { month, amount: kept });
  return result.unrecorded && result.unrecorded > 0
    ? {
        ...base,
        body: `${body} ${t("push.closed.unrecorded", {
          amount: formatEuro(result.unrecorded, locale),
        })}`,
      }
    : { ...base, body };
}

/** A charge planned for a day, as the heads-up names it. */
export interface PlannedCharge {
  templateId: string;
  name: string;
  amount: number;
  /** Once a year: worth a word whatever its size. */
  yearly: boolean;
}

/**
 * The money leaving by template on one day: what the charges call for, less
 * any occurrence skipped or already confirmed as arrived. Income is not a
 * charge, and a purchase inside a wallet moves nothing on the bank account
 * (the transfer to the broker did), so neither is counted.
 */
export function plannedChargesOn(
  templates: readonly RecurringTemplateWithCategory[],
  date: string,
  excludedKeys: ReadonlySet<string>,
): PlannedCharge[] {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return templates.flatMap((template) => {
    if (
      !template.active ||
      template.categories.type === "income" ||
      template.categories.counts_toward_summary === false ||
      Number(template.amount) <= 0 ||
      !occurrenceWithinSchedule(date, template.starts_on, template.ends_on) ||
      !getRecurringOccurrenceDates(template, year, month).includes(date) ||
      excludedKeys.has(recurringOccurrenceKey(template.id, date))
    ) {
      return [];
    }
    return [
      {
        templateId: template.id,
        name: template.description?.trim() || template.categories.name,
        amount: Number(template.amount),
        yearly: template.recurrence === "yearly",
      },
    ];
  });
}

/** Never "large" below this, whatever the reader's usual charge is. */
const BIG_CHARGE_FLOOR = 100;

/** How many times the usual charge a charge has to be to count as large. */
const BIG_CHARGE_FACTOR = 2;

/**
 * What one of the reader's recurring charges usually comes to: the median of
 * the money that leaves the account by template. The median rather than the
 * mean, so one large insurance premium does not raise the bar for everything.
 */
export function usualChargeAmount(
  templates: readonly {
    amount: number | string;
    categories: { type: string; counts_toward_summary: boolean };
  }[],
): number | null {
  const amounts = templates
    .filter(
      (template) =>
        template.categories.type !== "income" &&
        template.categories.counts_toward_summary !== false,
    )
    .map((template) => Number(template.amount))
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  if (amounts.length === 0) {
    return null;
  }
  const middle = Math.floor(amounts.length / 2);
  return amounts.length % 2 === 1
    ? amounts[middle]!
    : (amounts[middle - 1]! + amounts[middle]!) / 2;
}

/**
 * Which of a day's charges are worth a heads-up: the yearly ones, and the
 * ones at least twice the reader's usual charge (never under 100 €).
 * Everything else is the ordinary month, and saying so the evening before
 * every time is how a reminder becomes noise.
 */
export function bigCharges(
  charges: readonly PlannedCharge[],
  usual: number | null,
): PlannedCharge[] {
  const bar = Math.max(BIG_CHARGE_FLOOR, (usual ?? 0) * BIG_CHARGE_FACTOR);
  return charges.filter((charge) => charge.yearly || charge.amount >= bar);
}

/**
 * Tomorrow, a charge larger than usual — or one that comes once a year, the
 * kind a month forgets is coming. Sent the morning before, so there is a day
 * to make sure the money is there.
 */
export function bigChargeHeadsUp({
  charges,
  tomorrow,
  t,
  locale,
}: Voice & {
  charges: readonly PlannedCharge[];
  tomorrow: string;
}): PendingNotification | null {
  if (charges.length === 0) {
    return null;
  }
  const base = {
    kind: "bigCharge" as const,
    key: `big-charge:${tomorrow}`,
    url: "/bearing",
  };
  if (charges.length === 1) {
    const [charge] = charges;
    return {
      ...base,
      title: t("push.bigCharge.title", { name: charge!.name }),
      body: t(
        charge!.yearly ? "push.bigCharge.yearly" : "push.bigCharge.body",
        {
          amount: formatEuro(charge!.amount, locale),
        },
      ),
    };
  }
  return {
    ...base,
    title: t("push.bigCharge.titleSeveral", { count: charges.length }),
    body: charges
      .map((charge) => `${charge.name} ${formatEuro(charge.amount, locale)}`)
      .join(" · "),
  };
}

/**
 * The purchases inside a wallet still waiting for a yes or a no
 * (`purchasesToConfirm`), the morning after their day.
 *
 * Not on the day itself: the broker buys during market hours, and asked
 * before it has, the honest answer is "not yet". The morning after, it is in
 * the broker's app. A change rather than a state, so keyed by the latest day
 * a waiting purchase fell on: Monday's DCA is asked about on Tuesday and not
 * again on Wednesday, and next Monday's brings any still unanswered along.
 */
export function purchasesToConfirmNotification({
  purchases,
  today,
  t,
  locale,
}: Voice & {
  purchases: readonly PurchaseToConfirm[];
  today: string;
}): PendingNotification | null {
  const due = purchases.filter((purchase) => purchase.occurredOn < today);
  if (due.length === 0) {
    return null;
  }
  const latest = due.reduce(
    (day, purchase) => (purchase.occurredOn > day ? purchase.occurredOn : day),
    due[0]!.occurredOn,
  );
  const base = { kind: "dca" as const, key: `dca:${latest}`, url: "/bearing" };
  if (due.length === 1) {
    const [purchase] = due;
    return {
      ...base,
      title: t("push.dca.title", { name: purchase!.label }),
      body: t("push.dca.body", {
        amount: formatEuro(purchase!.amount, locale),
        date: formatShortDate(purchase!.occurredOn, locale),
      }),
    };
  }
  return {
    ...base,
    title: t("push.dca.titleSeveral", { count: due.length }),
    body: t("push.dca.bodySeveral", {
      names: [...new Set(due.map((purchase) => purchase.label))].join(", "),
    }),
  };
}

/** The Monday recap, as one push: the card's lines, joined. */
export function weeklyRecapNotification({
  recap,
  t,
  locale,
}: Voice & { recap: WeeklyRecap }): PendingNotification {
  return {
    kind: "recap",
    key: `recap:${recap.weekOf}`,
    title: t("recap.title"),
    body: weeklyRecapLines(recap, {
      t,
      formatMoney: (amount) => formatEuro(amount, locale),
      previousMonthName: monthLong(recap.monthSoFar.previousMonth, locale),
    }).join(" "),
    url: "/bearing",
  };
}

/**
 * The account is set to go below zero before the month ends.
 *
 * Only on a balance someone read — the bank's statement or a close — and
 * never on the net a month counts from zero, which dips below it before
 * every payday. Only for a day still ahead: an account already overdrawn
 * today is something the bank says, and this is the warning that comes in
 * time to move a charge or some money. Once a month, keyed by it.
 */
export function overdraftWarning({
  balance,
  source,
  today,
  t,
  locale,
}: Voice & {
  balance: MonthBalance;
  source: "bank" | "close" | "none";
  today: string;
}): PendingNotification | null {
  if (
    source === "none" ||
    balance.basis !== "balance" ||
    balance.period !== "current"
  ) {
    return null;
  }
  const { lowest } = balance;
  if (!lowest || lowest.value >= 0 || lowest.date <= today) {
    return null;
  }
  const date = formatDayMonth(lowest.date, locale);
  return {
    kind: "overdraft",
    key: `overdraft:${today.slice(0, 7)}`,
    title: t("push.overdraft.title", { date }),
    body: t(
      balance.end < 0 ? "push.overdraft.bodyStays" : "push.overdraft.body",
      {
        amount: formatEuro(lowest.value, locale),
        date,
        end: formatEuro(balance.end, locale),
      },
    ),
    url: "/bearing",
  };
}

/**
 * A new milestone passed. Said once per milestone (keyed by its amount),
 * and only after the Plan has celebrated one — the Plan still shows it as
 * new when it is next opened, since this does not mark it seen.
 */
export function milestoneNotification({
  amount,
  t,
  locale,
}: Voice & { amount: number }): PendingNotification {
  const formatted = formatEuro(amount, locale);
  return {
    kind: "milestone",
    key: `milestone:${amount}`,
    title: t("push.milestone.title", { amount: formatted }),
    body: t("push.milestone.body", { amount: formatted }),
    url: "/plan",
  };
}

/**
 * A loan's moment: half of it repaid, or its last payment made. Keyed by the
 * loan and the moment, so each is said once whichever day it is noticed.
 */
export function loanMomentNotification({
  moment,
  loan,
  property,
  owed,
  monthly,
  endsOn,
  t,
  locale,
}: Voice & {
  moment: LoanMoment;
  loan: { id: string; label: string };
  property: { id: string; name: string };
  /** The user's part still owed today. */
  owed: number;
  /** What it took each month, the user's part. */
  monthly: number;
  /** Its last payment. */
  endsOn: string | null;
}): PendingNotification {
  const url = `/property/${property.id}`;
  if (moment.kind === "last") {
    return {
      kind: "property",
      key: `property:last:${loan.id}`,
      title: t("push.property.lastTitle", { loan: loan.label }),
      body: t("push.property.lastBody", {
        loan: loan.label,
        date: formatFullDate(moment.on, locale),
        amount: formatEuro(monthly, locale),
      }),
      url,
    };
  }
  return {
    kind: "property",
    key: `property:half:${loan.id}`,
    title: t("push.property.halfTitle", { loan: loan.label }),
    body: endsOn
      ? t("push.property.halfBody", {
          owed: formatEuro(owed, locale),
          property: property.name,
          end: formatMonthShortYear(
            Number(endsOn.slice(0, 4)),
            Number(endsOn.slice(5, 7)),
            locale,
          ),
        })
      : t("push.property.halfBodyOpen", {
          owed: formatEuro(owed, locale),
          property: property.name,
        }),
    url,
  };
}

/**
 * A new estimate for a home, when the public record of sales has added a
 * half-year to what its last reading stood on. Keyed by that half-year, so
 * a home hears it at most twice a year.
 */
export function marketMomentNotification({
  property,
  halfYear,
  before,
  after,
  t,
  locale,
}: Voice & {
  property: { id: string; name: string };
  halfYear: string;
  before: number;
  after: number;
}): PendingNotification {
  return {
    kind: "property",
    key: `property:market:${property.id}:${halfYear}`,
    title: t("push.property.marketTitle", { property: property.name }),
    body:
      before === after
        ? t("push.property.marketBodySame", {
            after: formatEuro(after, locale),
          })
        : t("push.property.marketBody", {
            after: formatEuro(after, locale),
            before: formatEuro(before, locale),
          }),
    url: `/property/${property.id}`,
  };
}

/**
 * Half the home the user's, through their payments. Keyed by the property:
 * it happens once.
 */
export function equityMomentNotification({
  property,
  value,
  t,
  locale,
}: Voice & {
  property: { id: string; name: string };
  /** Its estimated value today, the user's part. */
  value: number;
}): PendingNotification {
  return {
    kind: "property",
    key: `property:equity-half:${property.id}`,
    title: t("push.property.equityTitle", { property: property.name }),
    body: t("push.property.equityBody", { value: formatEuro(value, locale) }),
    url: `/property/${property.id}`,
  };
}
