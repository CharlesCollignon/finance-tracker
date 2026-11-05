/**
 * Finding the standing charges hiding in a statement.
 *
 * A year of transactions already contains every subscription, every
 * insurance premium and every direct debit the user has. Making them type
 * those in again, from a list the app is looking straight at, is work the
 * app should be doing.
 *
 * Nothing here creates anything. A template that was never agreed to is
 * worse than a missing one: it silently joins every projection, every runway
 * figure and every month-end view, and it is invisible once it is there. So
 * this proposes, and someone says yes.
 */

import { bankMerchantKey } from "./bank-merchant";
import { type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import {
  formatMonthSet,
  monthsEvery,
  normaliseMonths,
  rhythmOfMonths,
  timesPerYear,
  type Recurrence,
} from "./recurrence";
import type { CategoryType } from "./types/database";

export interface DetectionInput {
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
}

export interface RecurringProposal {
  /** The coarse merchant key the occurrences agree on. */
  key: string;
  /** The clearest spelling seen, for showing the user. */
  label: string;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  recurrence: Recurrence;
  /**
   * For a monthly one, the months it falls in (`recurring_templates.months`):
   * every quarter, every two or six months, or a run that skips the same
   * months each year. Null for every month, and for weekly and yearly.
   */
  months: number[] | null;
  /** Day of the month for monthly and yearly, weekday for weekly. */
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  /** The amount to propose: the most recent, not the average. */
  amount: number;
  /** How many occurrences back it. */
  count: number;
  /** Most recent occurrence, so a lapsed charge can be told apart. */
  lastSeenOn: string;
  /** How much the amounts move, as a fraction of the typical one. */
  variability: number;
}

/**
 * A name to show for a suggestion.
 *
 * The raw statement line is unreadable in a column this narrow — "PRELEVEMENT
 * Navigo Annuel - COMUTITRES SAS" truncates to "PRELEVEMENT Navi…", which
 * says nothing about what is being accepted. The merchant key is what the
 * detector grouped on and is already stripped of the bank's noise, so it
 * makes the better label; the full line can be edited once the template
 * exists.
 */
export function proposalDisplayName(key: string): string {
  return key
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * How often a proposal comes round, in words: « chaque mois », « chaque
 * trimestre », « chaque mois sauf nov., déc. ».
 */
export function proposalCadence(
  proposal: Pick<RecurringProposal, "recurrence" | "months">,
  locale: Locale,
): string {
  const t = translator(locale);
  if (proposal.recurrence === "weekly") {
    return t("recurringProposals.everyWeek");
  }
  if (proposal.recurrence === "yearly") {
    return t("recurringProposals.everyYear");
  }
  const months = proposal.months;
  if (!months) {
    return t("recurringProposals.everyMonth");
  }
  const { rhythm } = rhythmOfMonths(months);
  if (rhythm === 2) {
    return t("recurringProposals.everyTwoMonths");
  }
  if (rhythm === 3) {
    return t("recurringProposals.everyQuarter");
  }
  if (rhythm === 6) {
    return t("recurringProposals.everySixMonths");
  }
  const skipped = Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (month) => !months.includes(month),
  );
  return months.length > 6
    ? t("recurringProposals.monthsExcept", {
        months: formatMonthSet(skipped, locale),
      })
    : t("recurringProposals.inMonths", {
        months: formatMonthSet(months, locale),
      });
}

/** Below this many sightings it is a coincidence, not a habit. */
const MIN_OCCURRENCES = 3;

/**
 * How far the gaps may wander and still count as a cadence. A monthly charge
 * lands anywhere from 28 to 31 days apart, and a weekend pushes it further.
 */
const MONTHLY_RANGE: readonly [number, number] = [25, 36];
const WEEKLY_RANGE: readonly [number, number] = [6, 8];
const YEARLY_RANGE: readonly [number, number] = [350, 380];

/**
 * Every 2, 3 and 6 months: a bill every other month, a quarterly water bill
 * or premium, a half-yearly one. The same slack as a month's, a few days
 * either side of the step.
 */
const MONTH_STEP_RANGES: readonly (readonly [
  number,
  readonly [number, number],
])[] = [
  [2, [55, 67]],
  [3, [85, 97]],
  [6, [175, 190]],
];

/**
 * How much the amount may move. A subscription is fixed; an energy bill is
 * not, and proposing a fixed template for something that varies by half
 * would put a wrong number into every projection.
 */
const MAX_VARIABILITY = 0.15;

function daysBetween(earlier: string, later: string): number {
  return (
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
    86_400_000
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function within(
  value: number,
  [low, high]: readonly [number, number],
): boolean {
  return value >= low && value <= high;
}

/** ISO weekday, Monday = 1. */
function isoWeekday(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

/**
 * The cadence a run of gaps agrees on, if any, and for a monthly one how many
 * months apart it comes.
 */
function cadenceOf(
  gaps: readonly number[],
): { recurrence: Recurrence; step: number } | null {
  if (gaps.length === 0) {
    return null;
  }
  const typical = median(gaps);
  if (within(typical, WEEKLY_RANGE)) {
    return { recurrence: "weekly", step: 0 };
  }
  if (within(typical, MONTHLY_RANGE)) {
    return { recurrence: "monthly", step: 1 };
  }
  for (const [step, range] of MONTH_STEP_RANGES) {
    if (within(typical, range)) {
      return { recurrence: "monthly", step };
    }
  }
  if (within(typical, YEARLY_RANGE)) {
    return { recurrence: "yearly", step: 12 };
  }
  return null;
}

function monthOf(isoDate: string): number {
  return Number(isoDate.slice(5, 7));
}

/** Every `YYYY-MM` from the first date's month to the last's, both included. */
function monthKeysBetween(first: string, last: string): string[] {
  const keys: string[] = [];
  let year = Number(first.slice(0, 4));
  let month = monthOf(first);
  const end = last.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    keys.push(key);
    if (key >= end) {
      return keys;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/**
 * The months a run falls in. Every `step` months from its latest one; for a
 * monthly run, every month but those it skipped each time they came round —
 * the tax taken from January to October, a grant paid from September to
 * June. A month counts as skipped only when every month the run keeps was
 * seen in two different years: that is what tells a habit from a payment
 * that happened to be missed once. Null for every month.
 */
function monthsOfRun(dates: readonly string[], step: number): number[] | null {
  const latest = dates[dates.length - 1]!;
  if (step > 1) {
    return monthsEvery(step, monthOf(latest));
  }
  const first = dates[0]!;
  const seen = new Set(dates.map((date) => date.slice(0, 7)));
  const passed = new Map<number, { times: number; empty: number }>();
  for (const key of monthKeysBetween(first, latest)) {
    const month = Number(key.slice(5, 7));
    const tally = passed.get(month) ?? { times: 0, empty: 0 };
    tally.times += 1;
    if (!seen.has(key)) {
      tally.empty += 1;
    }
    passed.set(month, tally);
  }
  // Every month of the year has to have come round at least once.
  if (passed.size < 12) {
    return null;
  }
  const skipped = [...passed]
    .filter(([, tally]) => tally.empty === tally.times)
    .map(([month]) => month);
  if (skipped.length === 0) {
    return null;
  }
  const keptTwice = [...passed]
    .filter(([month]) => !skipped.includes(month))
    .every(([, tally]) => tally.times - tally.empty >= 2);
  if (!keptTwice) {
    return null;
  }
  return normaliseMonths(
    Array.from({ length: 12 }, (_, i) => i + 1).filter(
      (month) => !skipped.includes(month),
    ),
  );
}

/**
 * Standing charges the statement implies.
 *
 * Grouped on the coarse bank key rather than the exact note, because a
 * terminal spells the same shop differently every visit — the same reason
 * the feed matches that way.
 */
export function detectRecurring(
  transactions: readonly DetectionInput[],
): RecurringProposal[] {
  const groups = new Map<string, DetectionInput[]>();

  for (const tx of transactions) {
    // Income arrives on someone else's schedule and a salary is not a
    // standing instruction the user issues; proposing one would put an
    // employer's payroll run into their own forecast.
    if (tx.categoryType === "income") {
      continue;
    }
    const key = bankMerchantKey(tx.note);
    if (key === "") {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }

  const proposals: RecurringProposal[] = [];

  for (const [key, rows] of groups) {
    if (rows.length < MIN_OCCURRENCES) {
      continue;
    }

    const ordered = [...rows].sort((a, b) =>
      a.occurredOn.localeCompare(b.occurredOn),
    );

    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      gaps.push(
        daysBetween(ordered[i - 1]!.occurredOn, ordered[i]!.occurredOn),
      );
    }

    const cadence = cadenceOf(gaps);
    if (!cadence) {
      continue;
    }
    const { recurrence } = cadence;

    const amounts = ordered.map((row) => row.amount);
    const typical = median(amounts);
    if (typical <= 0) {
      continue;
    }
    const spread = (Math.max(...amounts) - Math.min(...amounts)) / typical;
    if (spread > MAX_VARIABILITY) {
      continue;
    }

    // The category the run mostly agreed on. A split verdict means the group
    // is really two things, and it should not become one template.
    const counts = new Map<string, number>();
    for (const row of ordered) {
      counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    }
    const [dominantId, dominantCount] = [...counts].sort(
      (a, b) => b[1] - a[1],
    )[0]!;
    if (dominantCount / ordered.length < 0.75) {
      continue;
    }

    const latest = ordered[ordered.length - 1]!;
    const dominant =
      ordered.find((row) => row.categoryId === dominantId) ?? latest;

    proposals.push({
      key,
      label: latest.note?.trim() || key,
      categoryId: dominant.categoryId,
      categoryName: dominant.categoryName,
      categoryType: dominant.categoryType,
      recurrence,
      months:
        recurrence === "monthly"
          ? monthsOfRun(
              ordered.map((row) => row.occurredOn),
              cadence.step,
            )
          : null,
      dayOfMonth:
        recurrence === "weekly"
          ? null
          : Math.round(median(ordered.map((r) => dayOfMonth(r.occurredOn)))),
      dayOfWeek:
        recurrence === "weekly"
          ? Math.round(median(ordered.map((r) => isoWeekday(r.occurredOn))))
          : null,
      // The most recent, not the average: a price rise should carry forward
      // rather than be averaged away with the year before it.
      amount: latest.amount,
      count: ordered.length,
      lastSeenOn: latest.occurredOn,
      variability: Math.round(spread * 100) / 100,
    });
  }

  // Biggest commitment first, which is the order they matter in.
  return proposals.sort(
    (left, right) =>
      right.amount * timesPerYear(right) - left.amount * timesPerYear(left),
  );
}

/**
 * How long after its last sighting a proposal has lapsed: a little over the
 * longest wait between two of its payments.
 */
function staleAfterDays(proposal: RecurringProposal): number {
  if (proposal.recurrence === "yearly") {
    return 400;
  }
  const months = proposal.months;
  if (!months || months.length < 2) {
    return months?.length === 1 ? 400 : 70;
  }
  let longest = 12 - months[months.length - 1]! + months[0]!;
  for (let i = 1; i < months.length; i += 1) {
    longest = Math.max(longest, months[i]! - months[i - 1]!);
  }
  return longest * 30 + 40;
}

/**
 * Proposals worth showing: still live, and not already covered by a template
 * the user has. A charge last seen six months ago has lapsed.
 */
export function filterLiveProposals(
  proposals: readonly RecurringProposal[],
  today: string,
  existingKeys: ReadonlySet<string>,
): RecurringProposal[] {
  return proposals.filter((proposal) => {
    if (existingKeys.has(proposal.key)) {
      return false;
    }
    return daysBetween(proposal.lastSeenOn, today) <= staleAfterDays(proposal);
  });
}
