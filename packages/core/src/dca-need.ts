import { recurringOccurrenceKey, templateSetUpOn } from "./apply-recurring";
import { isPurchaseInsideWallet } from "./categories";
import { shiftIsoDate } from "./constants";
import { matchWalletId, type InvestmentWalletId } from "./investments";
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
 * The purchases inside a wallet one month calls for, and what to send for
 * them. Leaves out the ones skipped ahead of time and the wallets the bank
 * debits straight from the account (Bitstack), which no transfer funds.
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
    if (
      !template.active ||
      !isPurchaseInsideWallet(template.categories) ||
      debited.has(template.category_id)
    ) {
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
    amount: roundUp(cents(cost + margin)),
    count,
    byWallet: [...wallets.values()],
  };
}

/**
 * The month a transfer that follows the DCAs covers: the month after its
 * occurrence still in play.
 *
 * That is the first one from `PAYDAY_LATE_DAYS` ago that nothing has
 * settled yet — confirmed against a bank movement, written, or skipped. A
 * transfer is payday money: until the bank brings the one on the 28th, or
 * could no longer bring it, that is the transfer being sent, for next month.
 * Once it has, the next one is. Never one from before the template was set
 * up, which was never going to be sent. Null when the template has none
 * left, or is not monthly.
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
      const covered = nextMonth(year, month);
      return { ...covered, occurredOn };
    }
    ({ year, month } = nextMonth(year, month));
  }
  return null;
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
