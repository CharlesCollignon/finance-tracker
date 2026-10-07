import { recurringOccurrenceKey, templateSetUpOn } from "./apply-recurring";
import { isPurchaseInsideWallet } from "./categories";
import { isCryptoCategoryName } from "./crypto-holdings";
import { formatEuro, shiftIsoDate } from "./constants";
import { monthLong } from "./i18n/calendar-names";
import type { Locale } from "./i18n/locale";
import type { Translate } from "./i18n/t";
import {
  INVESTMENT_WALLET_LABELS,
  matchWalletId,
  type InvestmentWalletId,
} from "./investments";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import { PAYDAY_LATE_DAYS } from "./recurring-fulfilment";
import { isQuotePriced } from "./recurring-shares";
import type { RecurringTemplateWithCategory } from "./types/database";

/**
 * What a month's DCAs need at the broker, which is what a transfer that
 * follows them (`pricing_type = 'purchases'`, migration 054) stands for.
 *
 * The DCAs are bought at the broker with money sent there once a month from
 * the pay. Sent short, the last purchase of the month is turned down; sent
 * long, the rest waits there. So the figure is what the month's purchases
 * come to, with room for the market on the share-priced ones and rounded up
 * to a figure someone would type into a transfer — always the whole month,
 * never less what may still be at the broker, which nothing here can see.
 *
 * A share-priced template's `amount` is its share count at the last quote,
 * kept fresh by the quote refresh, so nothing here prices anything.
 */

/** Room for the quote to move before the purchase, on share-priced DCAs. */
export const DCA_PRICE_MARGIN = 0.05;

/** What the figure is rounded up to. */
export const DCA_ROUND_TO = 50;

export interface DcaNeed {
  year: number;
  month: number;
  /** What the month's purchases come to, before the margin and rounding. */
  cost: number;
  /** The room left for the market on the share-priced ones. */
  margin: number;
  /** What to send: the cost, the margin, rounded up to `DCA_ROUND_TO`. */
  amount: number;
  /** How many purchases the month holds. */
  count: number;
  /** The cost per wallet, in the order of the first purchase in each. */
  byWallet: {
    wallet: InvestmentWalletId | null;
    cost: number;
    count: number;
  }[];
}

/**
 * The DCAs one month calls for that the transfer pays for — ticked
 * « Payé par le virement au courtier » (`funded_by_transfer`) — and what to
 * send for them. Leaves out the ones skipped ahead of time and the wallets
 * the bank debits straight from the account (Bitstack), which no transfer
 * funds whatever their tick says.
 */
export function dcaNeedForMonth({
  templates,
  debited = new Set(),
  skippedKeys = new Set(),
  year,
  month,
}: {
  templates: readonly RecurringTemplateWithCategory[];
  /** `walletCategoriesTheBankDebits`. */
  debited?: ReadonlySet<string>;
  skippedKeys?: ReadonlySet<string>;
  year: number;
  month: number;
}): DcaNeed {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const wallets = new Map<
    InvestmentWalletId | null,
    { wallet: InvestmentWalletId | null; cost: number; count: number }
  >();
  let cost = 0;
  let margin = 0;
  let count = 0;

  for (const template of templates) {
    if (!isFundedDca(template, debited)) {
      continue;
    }
    const dates = occurrencesIn(template, year, month).filter(
      (date) =>
        date.startsWith(monthPrefix) &&
        !skippedKeys.has(recurringOccurrenceKey(template.id, date)),
    );
    if (dates.length === 0) {
      continue;
    }

    const each = Number(template.amount);
    const total = each * dates.length;
    cost += total;
    count += dates.length;
    if (
      isQuotePriced({
        pricing_type: template.pricing_type,
        share_count: template.share_count,
        instrument_symbol: template.instrument_symbol,
      })
    ) {
      margin += total * DCA_PRICE_MARGIN;
    }

    const wallet = matchWalletId(template.categories.name);
    const entry = wallets.get(wallet) ?? { wallet, cost: 0, count: 0 };
    entry.cost = cents(entry.cost + total);
    entry.count += dates.length;
    wallets.set(wallet, entry);
  }

  return {
    year,
    month,
    cost: cents(cost),
    margin: cents(margin),
    amount: roundUp(cents(cost + margin)),
    count,
    byWallet: [...wallets.values()],
  };
}

/** Whether the transfer pays for this DCA: ticked, active, bought at the broker. */
export function isFundedDca(
  template: Pick<
    RecurringTemplateWithCategory,
    "active" | "funded_by_transfer" | "category_id" | "categories"
  >,
  debited: ReadonlySet<string> = new Set(),
): boolean {
  return (
    template.active &&
    template.funded_by_transfer &&
    isPurchaseInsideWallet(template.categories) &&
    !debited.has(template.category_id)
  );
}

/** Whether a DCA may carry the tick at all: one bought at the broker. */
export function canBeFundedByTransfer(
  template: Pick<RecurringTemplateWithCategory, "category_id" | "categories">,
  debited: ReadonlySet<string> = new Set(),
): boolean {
  return (
    isPurchaseInsideWallet(template.categories) &&
    !isCryptoCategoryName(template.categories.name) &&
    !debited.has(template.category_id)
  );
}

/** The app's transfer to the broker, if there is one, active or paused. */
export function brokerTransferOf<
  T extends Pick<RecurringTemplateWithCategory, "pricing_type" | "active">,
>(templates: readonly T[]): T | undefined {
  return (
    templates.find(
      (template) => template.pricing_type === "purchases" && template.active,
    ) ?? templates.find((template) => template.pricing_type === "purchases")
  );
}

/**
 * The month a transfer covers: the one that starts nearest its occurrence
 * still in play — on the 1st, the month it opens; on the 28th, the next.
 *
 * In play is the first occurrence from `PAYDAY_LATE_DAYS` ago that nothing
 * has settled yet — confirmed against a bank movement, written, or skipped.
 * A transfer sent a few days late is still the one being sent; once it is
 * settled, or could no longer arrive, the next one is. Never one from before
 * the template was set up. Null when the template has none left, or is not
 * monthly.
 */
export function transferCoversMonth(
  template: Pick<
    RecurringTemplateWithCategory,
    | "id"
    | "created_at"
    | "recurrence"
    | "day_of_month"
    | "day_of_week"
    | "month_of_year"
    | "starts_on"
    | "ends_on"
  >,
  today: string,
  settledKeys: ReadonlySet<string> = new Set(),
): { year: number; month: number; occurredOn: string } | null {
  if ((template.recurrence ?? "monthly") !== "monthly") {
    return null;
  }
  const lateFrom = shiftIsoDate(today, -PAYDAY_LATE_DAYS);
  const setUpOn = templateSetUpOn(template);
  const from = setUpOn > lateFrom ? setUpOn : lateFrom;
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));

  // Three months reach past a settled occurrence to the next of any monthly
  // template.
  for (let step = 0; step < 3; step += 1) {
    const occurredOn = occurrencesIn(template, year, month).find(
      (date) =>
        date >= from &&
        !settledKeys.has(recurringOccurrenceKey(template.id, date)),
    );
    if (occurredOn) {
      return { ...monthStartingNearest(occurredOn), occurredOn };
    }
    ({ year, month } = nextMonth(year, month));
  }
  return null;
}

/** The calendar month whose 1st is nearest `date`: its own up to the 15th. */
function monthStartingNearest(date: string): { year: number; month: number } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return Number(date.slice(8, 10)) <= 15
    ? { year, month }
    : nextMonth(year, month);
}

/** How many days before the transfer's day the card and the push come. */
export const TRANSFER_NOTICE_DAYS = 5;

/** The months of a run looked back over, at most. */
const RUN_MONTHS = 36;

export interface DcaMonth {
  templateId: string;
  label: string;
  /** The transfer's day: the 1st of the month it pays for. */
  occurredOn: string;
  /**
   * Where the transfer stands: to send, from `TRANSFER_NOTICE_DAYS` before
   * its day until it is settled; sent, once confirmed or written; unseen,
   * when its day is past and nothing ever showed it.
   */
  state: "to-send" | "sent" | "unseen";
  /** The month's DCAs it pays for, and what to send for them. */
  need: DcaNeed;
  /** The month's DCAs that have gone through, of those still due in it. */
  progress: { done: number; total: number };
  /** Months in a row the transfer was sent, this one included once it is. */
  run: number;
}

/**
 * What Le point's DCA card says today, for the transfer's own dates: the next
 * one, from `TRANSFER_NOTICE_DAYS` before its day; otherwise the latest —
 * still to send for `PAYDAY_LATE_DAYS` after its day, since a transfer a few
 * days late still counts, then unseen. Sent as soon as it is settled, even
 * early. With it, the month it pays for — its DCAs going through one by one —
 * and the months funded in a row. Null without the app's transfer, before
 * its first, or with nothing ticked to pay for.
 */
export function dcaMonth({
  templates,
  today,
  settledKeys = new Set(),
  skippedKeys = new Set(),
  writtenKeys = new Set(),
  debited = new Set(),
}: {
  templates: readonly RecurringTemplateWithCategory[];
  today: string;
  /** Transfer occurrences confirmed against the bank or written, any month. */
  settledKeys?: ReadonlySet<string>;
  skippedKeys?: ReadonlySet<string>;
  /** DCA occurrences a row records — confirmed, or written by the fill. */
  writtenKeys?: ReadonlySet<string>;
  /** `walletCategoriesTheBankDebits`. */
  debited?: ReadonlySet<string>;
}): DcaMonth | null {
  const transfer = brokerTransferOf(templates);
  if (!transfer?.active) {
    return null;
  }
  const setUpOn = templateSetUpOn(transfer);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const dates = [
    previousMonth(year, month),
    { year, month },
    nextMonth(year, month),
  ]
    .flatMap((at) => occurrencesIn(transfer, at.year, at.month))
    .filter((date) => date >= setUpOn)
    .sort();
  const upcoming = dates.find((date) => date > today);
  const latest = dates.filter((date) => date <= today).at(-1);
  const occurredOn =
    upcoming && today >= shiftIsoDate(upcoming, -TRANSFER_NOTICE_DAYS)
      ? upcoming
      : latest;
  if (!occurredOn) {
    return null;
  }

  const covered = monthStartingNearest(occurredOn);
  const need = dcaNeedForMonth({ templates, debited, skippedKeys, ...covered });
  if (need.count === 0) {
    return null;
  }
  const key = recurringOccurrenceKey(transfer.id, occurredOn);
  const sent = settledKeys.has(key);
  const stillDue =
    !skippedKeys.has(key) &&
    occurredOn >= shiftIsoDate(today, -PAYDAY_LATE_DAYS);

  return {
    templateId: transfer.id,
    label: transfer.description?.trim() || transfer.categories.name,
    occurredOn,
    state: sent ? "sent" : stillDue ? "to-send" : "unseen",
    need,
    progress: dcaProgress({
      templates,
      debited,
      skippedKeys,
      writtenKeys,
      ...covered,
    }),
    run: transferRun(transfer, settledKeys, today, sent ? occurredOn : null),
  };
}

/**
 * How far a month's funded DCAs have got: those a row records, of those it
 * calls for — skipped ones are not owed, so they are counted in neither.
 */
export function dcaProgress({
  templates,
  debited = new Set(),
  skippedKeys = new Set(),
  writtenKeys = new Set(),
  year,
  month,
}: {
  templates: readonly RecurringTemplateWithCategory[];
  debited?: ReadonlySet<string>;
  skippedKeys?: ReadonlySet<string>;
  writtenKeys?: ReadonlySet<string>;
  year: number;
  month: number;
}): { done: number; total: number } {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  let done = 0;
  let total = 0;
  for (const template of templates) {
    if (!isFundedDca(template, debited)) {
      continue;
    }
    for (const date of occurrencesIn(template, year, month)) {
      const key = recurringOccurrenceKey(template.id, date);
      if (!date.startsWith(monthPrefix) || skippedKeys.has(key)) {
        continue;
      }
      total += 1;
      if (writtenKeys.has(key)) {
        done += 1;
      }
    }
  }
  return { done, total };
}

/**
 * Months in a row the transfer was sent, counted back from `from` — the
 * occurrence just sent — or else from the last one before today, so a run is
 * not broken by a month whose transfer is still on its way. Stops at the
 * first month it was not, or before the template was set up.
 */
export function transferRun(
  transfer: Pick<
    RecurringTemplateWithCategory,
    | "id"
    | "created_at"
    | "recurrence"
    | "day_of_month"
    | "day_of_week"
    | "month_of_year"
    | "starts_on"
    | "ends_on"
  >,
  settledKeys: ReadonlySet<string>,
  today: string,
  from: string | null = null,
): number {
  const setUpOn = templateSetUpOn(transfer);
  const start = from ?? today;
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  let run = 0;
  for (let step = 0; step < RUN_MONTHS; step += 1) {
    for (const date of [...occurrencesIn(transfer, year, month)].reverse()) {
      if (date < setUpOn) {
        return run;
      }
      const latest = from ?? today;
      if (date > latest) {
        continue;
      }
      if (!settledKeys.has(recurringOccurrenceKey(transfer.id, date))) {
        // Still on its way, not missed: the run counts from the month before.
        if (
          run === 0 &&
          from === null &&
          date >= shiftIsoDate(today, -PAYDAY_LATE_DAYS)
        ) {
          continue;
        }
        return run;
      }
      run += 1;
    }
    ({ year, month } = previousMonth(year, month));
  }
  return run;
}

/** The push before the 1st: the card's month while it is still to send. */
export interface TransferReminder {
  templateId: string;
  label: string;
  /** The transfer's own day. */
  occurredOn: string;
  /** What it stands for, and the month it covers. */
  need: DcaNeed;
}

/** What the push says, from the card: only while the transfer is to send. */
export function transferReminder(
  month: DcaMonth | null,
): TransferReminder | null {
  return month?.state === "to-send"
    ? {
        templateId: month.templateId,
        label: month.label,
        occurredOn: month.occurredOn,
        need: month.need,
      }
    : null;
}

/**
 * What a transfer's figure is made of, in two sentences: the month and each
 * wallet's share of it, then how it was rounded. Said the same in the push
 * and on Le point, so the two can be checked against each other.
 */
export function describeDcaNeed(
  need: DcaNeed,
  t: Translate,
  locale: Locale,
): string {
  const wallets = need.byWallet
    .map(
      ({ wallet, cost }) =>
        `${wallet ? INVESTMENT_WALLET_LABELS[wallet] : t("dcaTransfer.otherWallet")} ${formatEuro(cost, locale)}`,
    )
    .join(" · ");
  return `${t("dcaTransfer.for", {
    month: monthLong(need.month, locale),
    wallets,
  })} ${t(need.margin > 0 ? "dcaTransfer.margin" : "dcaTransfer.rounded")}`;
}

function occurrencesIn(
  template: Pick<
    RecurringTemplateWithCategory,
    | "recurrence"
    | "day_of_month"
    | "day_of_week"
    | "month_of_year"
    | "starts_on"
    | "ends_on"
  >,
  year: number,
  month: number,
): string[] {
  return filterDatesBySchedule(
    getRecurringOccurrenceDates(
      {
        recurrence: template.recurrence ?? "monthly",
        day_of_month: template.day_of_month,
        day_of_week: template.day_of_week,
        month_of_year: template.month_of_year,
      },
      year,
      month,
    ),
    template.starts_on,
    template.ends_on,
  );
}

function previousMonth(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

function nextMonth(year: number, month: number) {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundUp(value: number): number {
  return Math.ceil(value / DCA_ROUND_TO) * DCA_ROUND_TO;
}
