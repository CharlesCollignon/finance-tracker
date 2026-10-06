import { monthLong } from "./i18n/calendar-names";
import { type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
/**
 * Which bank movement looks like the occurrence a template called for.
 *
 * Two records describe the same rent: the template that says €780 leaves on
 * the 5th, and the bank row that says €780 left on the 4th. Nothing connected
 * them, so every recurring charge the bank delivers was counted twice — once
 * as money that moved and once as money still forecast to move. On a salary
 * that is a whole month's income added to a figure the user is about to spend
 * against.
 *
 * This proposes the pairings. It does not make them. An earlier version of
 * this app matched bank rows to templates on amount and a five-day window,
 * which "turned out to prove nothing on a statement full of small round
 * figures" — and had to grow a recovery action to reopen the ones it swallowed.
 * So the output here is a list of questions, every one of which waits for a
 * press, and the thresholds are set to make the questions few rather than to
 * make the matching clever.
 *
 * Kept free of database concerns so the rules are testable on their own.
 */

import { recurringOccurrenceKey, templateSetUpOn } from "./apply-recurring";
import { isPurchaseInsideWallet } from "./categories";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
} from "./types/database";

/**
 * How far the amount may differ, as a fraction of what was expected.
 *
 * A salary moves with overtime and a subscription with VAT, so an exact match
 * would offer almost nothing. Five per cent is wide enough for both and
 * narrow enough that two different charges of a similar size are not
 * confused.
 */
export const MAX_AMOUNT_DRIFT = 0.05;

/**
 * The floor under that, in currency units.
 *
 * Five per cent of €4 is 20 cents, which no real charge respects. Below this
 * the absolute tolerance is what applies.
 */
export const MIN_AMOUNT_TOLERANCE = 1.5;

/**
 * How many days either side of the occurrence to look.
 *
 * A charge due on the 5th lands on the 3rd when the 5th is a Sunday, and a
 * salary due on the last day of the month arrives on the 1st. Four days
 * covers a weekend and a bank holiday; much more and a monthly charge starts
 * being a candidate for two consecutive occurrences at once.
 */
export const MAX_DAYS_APART = 4;

/**
 * How far from its day money moved on payday may be: a salary, the savings
 * put by out of it, the transfer to a broker. These follow the pay, and the
 * pay moves — an employer paying on the 22nd before a holiday, or a few days
 * late — so they get this much room, and the savings and the broker transfer
 * move with the salary they came out of. Anything else, a rent or a
 * subscription, keeps `MAX_DAYS_APART` either way. Monthly and yearly
 * templates only: a weekly one would have two occurrences inside the room.
 *
 * Fifteen plus ten is under the 28 days between two monthly occurrences, so
 * a movement can never sit inside the room of two of them.
 */
export const PAYDAY_EARLY_DAYS = 15;
export const PAYDAY_LATE_DAYS = 10;

/** The kinds of money that move on payday. */
const PAYDAY_TYPES: ReadonlySet<CategoryType> = new Set([
  "income",
  "savings",
  "investment",
]);

export interface FulfilmentOccurrence {
  templateId: string;
  /** The date the template calls for. */
  occurredOn: string;
  /** What the template says the amount is. */
  amount: number;
  categoryId: string;
  categoryType: CategoryType;
  /** What to call it on screen. */
  label: string;
  /** The template's rhythm; a weekly one never gets the early window. */
  recurrence?: "monthly" | "weekly" | "yearly";
}

export interface FulfilmentMovement {
  transactionId: string;
  occurredOn: string;
  amount: number;
  categoryId: string;
  /** The bank's own words, for a row the user has to recognise. */
  note: string | null;
}

export interface FulfilmentProposal {
  /** Stable across renders: the occurrence this would fulfil. */
  key: string;
  templateId: string;
  label: string;
  /** The occurrence, as the template describes it. */
  occurredOn: string;
  expectedAmount: number;
  categoryType: CategoryType;
  /** The movement that looks like it. */
  transactionId: string;
  actualAmount: number;
  actualOn: string;
  actualNote: string | null;
  /** Signed: positive when more moved than expected. */
  difference: number;
  /** Whole days between the occurrence and the movement, unsigned. */
  daysApart: number;
  /**
   * The month the movement will count for once confirmed, as YYYY-MM, when
   * its money moved in another month than the occurrence's — early or late.
   * Confirming moves the row there and keeps the day the money moved as its
   * cash date (`cash_on`). Null when both are in the same month.
   */
  countsForMonth: string | null;
}

/**
 * How far from its occurrence a movement may be: four days either way, and
 * for money that moves on payday `PAYDAY_EARLY_DAYS` before and
 * `PAYDAY_LATE_DAYS` after.
 */
export function windowFor(
  occurrence: Pick<
    FulfilmentOccurrence,
    "categoryType" | "recurrence" | "occurredOn"
  >,
  movementOn: string,
): number {
  if (
    !PAYDAY_TYPES.has(occurrence.categoryType) ||
    occurrence.recurrence === "weekly"
  ) {
    return MAX_DAYS_APART;
  }
  return movementOn < occurrence.occurredOn
    ? PAYDAY_EARLY_DAYS
    : PAYDAY_LATE_DAYS;
}

/**
 * The month a confirmed pairing moves its movement to, or null when the two
 * are in the same month.
 *
 * A planned item counts in the month it was planned for, whenever its money
 * moved: the October salary paid on 22 September, the savings put by the
 * same day, the rent taken on 29 September for 1 October, the October salary
 * that only arrived on 2 November. Confirming one moves the row to its
 * occurrence's day and keeps the day the money moved as its cash date, so the
 * balance and the month close still see it where the bank did.
 */
export function countsForMonthOf(
  occurrence: Pick<FulfilmentOccurrence, "occurredOn">,
  movementOn: string,
): string | null {
  const occurrenceMonth = occurrence.occurredOn.slice(0, 7);
  return movementOn.slice(0, 7) !== occurrenceMonth ? occurrenceMonth : null;
}

/**
 * The months a month's questions are drawn from, and the days to read
 * movements over.
 *
 * Asked in the month the money moved as well as the month it was planned
 * for: the October salary paid on 22 September is a question in September,
 * not something to wait a week for; the October one paid on 2 November is a
 * question in November. So a month's occurrences are taken with its
 * neighbours', and `proposalsForMonth` keeps the pairings that touch it.
 */
export function fulfilmentScope(
  year: number,
  month: number,
): { months: { year: number; month: number }[]; from: string; to: string } {
  const shift = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  };
  const previous = shift(-1);
  const next = shift(1);
  return {
    months: [previous, { year, month }, next],
    from: shiftIso(firstOf(previous), -PAYDAY_EARLY_DAYS),
    to: shiftIso(lastOf(next), PAYDAY_LATE_DAYS),
  };
}

/** The pairings a month has to ask about: planned in it, or moved in it. */
export function proposalsForMonth(
  proposals: readonly FulfilmentProposal[],
  year: number,
  month: number,
): FulfilmentProposal[] {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return proposals.filter(
    (proposal) =>
      proposal.occurredOn.startsWith(key) || proposal.actualOn.startsWith(key),
  );
}

function firstOf({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function lastOf({ year, month }: { year: number; month: number }): string {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/**
 * Every occurrence some months' active templates call for, as the matcher
 * takes them. The whole of each month rather than only the past: a charge
 * due on the 5th that the bank paid on the 3rd is still a future occurrence
 * on the 4th, and it is exactly the one worth asking about.
 *
 * Never a purchase inside a wallet. Bought with money already at the broker,
 * no bank movement can be one, and the user is asked whether it went through
 * instead (`purchasesToConfirm`); bought from the account, its debits are
 * taken at whatever they cost and never asked about (`debitedPurchaseForecast`).
 */
export function fulfilmentOccurrences(
  templates: readonly RecurringTemplateWithCategory[],
  categories: readonly Pick<Category, "id" | "type" | "name">[],
  months: readonly { year: number; month: number }[],
): FulfilmentOccurrence[] {
  const byId = new Map(categories.map((c) => [c.id, c] as const));
  return templates.flatMap((template) => {
    const category = byId.get(template.category_id);
    return !template.active ||
      !category ||
      isPurchaseInsideWallet(template.categories)
      ? []
      : occurrencesOf(template, category, months);
  });
}

/** One template's occurrences over some months, as the matcher takes them. */
function occurrencesOf(
  template: RecurringTemplateWithCategory,
  category: Pick<Category, "type" | "name">,
  months: readonly { year: number; month: number }[],
): FulfilmentOccurrence[] {
  const out: FulfilmentOccurrence[] = [];
  for (const { year, month } of months) {
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const dates = filterDatesBySchedule(
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
    ).filter((date) => date.startsWith(monthPrefix));

    for (const date of dates) {
      out.push({
        templateId: template.id,
        occurredOn: date,
        amount: Number(template.amount),
        categoryId: template.category_id,
        categoryType: category.type,
        label: template.description?.trim() || category.name,
        recurrence: template.recurrence ?? "monthly",
      });
    }
  }
  return out;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    Math.abs(Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) /
      86_400_000,
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether an amount is close enough to have been the same charge. */
export function amountsMatch(expected: number, actual: number): boolean {
  const tolerance = Math.max(
    MIN_AMOUNT_TOLERANCE,
    Math.abs(expected) * MAX_AMOUNT_DRIFT,
  );
  return Math.abs(expected - actual) <= tolerance + 1e-9;
}

/**
 * How poor a pairing is, for choosing between two candidates.
 *
 * Days first and amount second, deliberately. Two charges of the same size in
 * one month are usually the same standing charge paid twice; two charges on
 * the same day are usually unrelated. So the nearer date wins, and the amount
 * only breaks a tie.
 */
function cost(occurrence: FulfilmentOccurrence, movement: FulfilmentMovement) {
  const days = daysBetween(occurrence.occurredOn, movement.occurredOn);
  const drift = Math.abs(occurrence.amount - movement.amount);
  return days * 1000 + drift;
}

export interface ProposeOptions {
  /**
   * Today, ISO. Required, because the question this asks is "did this
   * arrive", and a movement dated after today has not.
   *
   * The occurrence may still be in the future — a charge due on the 5th and
   * paid by the bank on the 3rd is the case this whole feature exists for.
   * It is the *movement* that has to have happened. Without this the app
   * offered to reconcile a forecast against a forecast: an EDF charge dated
   * the 17th against an EDF occurrence dated the 17th, "the same to the
   * cent", thirteen days before either had happened.
   */
  today: string;
  /** Occurrences already fulfilled, as `recurringOccurrenceKey` values. */
  fulfilledKeys?: ReadonlySet<string>;
  /**
   * Pairings the user has already refused, as `${templateId}:${date}:${txId}`.
   * A refusal names the pair rather than the occurrence, so a better
   * candidate arriving later is still offered.
   */
  refusedPairs?: ReadonlySet<string>;
  /** Transactions already standing in for some occurrence. */
  claimedTransactionIds?: ReadonlySet<string>;
}

/** The key a refusal is recorded under. */
export function refusalKey(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): string {
  return `${templateId}:${occurredOn}:${transactionId}`;
}

/**
 * Pair up what a template expects with what the bank actually reported.
 *
 * One movement may fulfil at most one occurrence and one occurrence at most
 * one movement — otherwise a single rent payment could cancel two months of
 * forecast, which halves the month's expected outgoings on the strength of
 * one debit. Resolved greedily by closeness, best pairings first, which is
 * enough: the candidate sets here are a handful of rows, not a matching
 * problem.
 */
export function proposeFulfilments(
  occurrences: readonly FulfilmentOccurrence[],
  movements: readonly FulfilmentMovement[],
  {
    today,
    fulfilledKeys = new Set(),
    refusedPairs = new Set(),
    claimedTransactionIds = new Set(),
  }: ProposeOptions,
): FulfilmentProposal[] {
  const pairs: {
    occurrence: FulfilmentOccurrence;
    movement: FulfilmentMovement;
    score: number;
  }[] = [];

  for (const occurrence of occurrences) {
    if (
      fulfilledKeys.has(
        recurringOccurrenceKey(occurrence.templateId, occurrence.occurredOn),
      )
    ) {
      continue;
    }

    for (const movement of movements) {
      // Nothing dated after today has arrived. This is the first check
      // because it is the only one that is about the question rather than
      // about the closeness of the match.
      if (movement.occurredOn > today) {
        continue;
      }
      if (claimedTransactionIds.has(movement.transactionId)) {
        continue;
      }
      // The category is the one signal that is a fact rather than a
      // coincidence: the user put this movement in this category, and a
      // salary template can only ever be fulfilled by income filed as salary.
      if (movement.categoryId !== occurrence.categoryId) {
        continue;
      }
      if (
        daysBetween(occurrence.occurredOn, movement.occurredOn) >
        windowFor(occurrence, movement.occurredOn)
      ) {
        continue;
      }
      if (!amountsMatch(occurrence.amount, movement.amount)) {
        continue;
      }
      if (
        refusedPairs.has(
          refusalKey(
            occurrence.templateId,
            occurrence.occurredOn,
            movement.transactionId,
          ),
        )
      ) {
        continue;
      }

      pairs.push({
        occurrence,
        movement,
        score: cost(occurrence, movement),
      });
    }
  }

  pairs.sort((left, right) => left.score - right.score);

  const usedOccurrences = new Set<string>();
  const usedMovements = new Set<string>();
  const proposals: FulfilmentProposal[] = [];

  for (const { occurrence, movement } of pairs) {
    const key = recurringOccurrenceKey(
      occurrence.templateId,
      occurrence.occurredOn,
    );
    if (usedOccurrences.has(key) || usedMovements.has(movement.transactionId)) {
      continue;
    }
    usedOccurrences.add(key);
    usedMovements.add(movement.transactionId);

    proposals.push({
      key,
      templateId: occurrence.templateId,
      label: occurrence.label,
      occurredOn: occurrence.occurredOn,
      expectedAmount: occurrence.amount,
      categoryType: occurrence.categoryType,
      transactionId: movement.transactionId,
      actualAmount: movement.amount,
      actualOn: movement.occurredOn,
      actualNote: movement.note,
      difference: roundMoney(movement.amount - occurrence.amount),
      daysApart: daysBetween(occurrence.occurredOn, movement.occurredOn),
      countsForMonth: countsForMonthOf(occurrence, movement.occurredOn),
    });
  }

  // Soonest first, so the list reads in the order the month happened.
  proposals.sort(
    (left, right) =>
      left.actualOn.localeCompare(right.actualOn) ||
      right.actualAmount - left.actualAmount,
  );

  return proposals;
}

/* ------------------------------------------------- what the bank still owes */

/**
 * What a ledger a bank feeds still forecasts, as occurrence keys.
 *
 * Nothing writes an occurrence there on its day: the bank is the record, and
 * it brings the debit when it brings it — a loan taken on the 5th shows up
 * that morning, the next day, or after a weekend. Going by the day alone, a
 * charge stopped being forecast at midnight and was not yet anywhere else, so
 * it fell out of the forecast and the ledger both, and the month's end looked
 * a loan payment better off than it was. So it is the bank bringing it that
 * ends an occurrence's forecast, either way round:
 *
 *   - `awaited`: its day has come, and nothing the bank brought looks like it
 *     yet. Still forecast for as long as a movement could still be offered
 *     for it (`windowFor`) — past that, the bank did not take it. Never one
 *     from before its template was set up: nobody was waiting for that one;
 *   - `arrived`: a movement already looks like it, early or late — the
 *     pairing « C'est arrivé ? » asks about. The money is in the actuals, so
 *     it is not forecast a second time while the question waits. Nothing is
 *     confirmed by this: the user is still asked.
 *
 * Whether one has been confirmed, skipped or written is the caller's to
 * check, as it already does for the occurrences ahead.
 */
export interface BankForecast {
  awaited: ReadonlySet<string>;
  arrived: ReadonlySet<string>;
  /**
   * The categories of the wallets bought straight from the account, whose
   * purchases move money like any other debit (`debitedPurchaseForecast`).
   */
  debited?: ReadonlySet<string>;
}

export function bankForecast(
  templates: readonly Pick<
    RecurringTemplateWithCategory,
    "id" | "created_at"
  >[],
  occurrences: readonly FulfilmentOccurrence[],
  proposals: readonly Pick<FulfilmentProposal, "key">[],
  today: string,
): BankForecast {
  const arrived = new Set(proposals.map((proposal) => proposal.key));
  const setUpOn = new Map(
    templates.map((template) => [template.id, templateSetUpOn(template)]),
  );
  const awaited = new Set<string>();

  for (const occurrence of occurrences) {
    const key = recurringOccurrenceKey(
      occurrence.templateId,
      occurrence.occurredOn,
    );
    if (
      occurrence.occurredOn > today ||
      arrived.has(key) ||
      occurrence.occurredOn < (setUpOn.get(occurrence.templateId) ?? today) ||
      daysBetween(occurrence.occurredOn, today) > windowFor(occurrence, today)
    ) {
      continue;
    }
    awaited.add(key);
  }

  return { awaited, arrived };
}

/**
 * What the bank has and has not brought of the purchases inside a wallet it
 * debits — Bitstack, which takes its Monday buys from the account by card.
 *
 * Their cost is not known ahead: the charge says about 18 €, and the bank
 * brings a round-up and the week's buy at whatever they came to. So any debit
 * in the charge's category near its day is it, each to the occurrence it is
 * nearest, and nothing is asked: the debits are already in the ledger at what
 * they really cost. Until one comes it is awaited, like any other charge the
 * bank brings (`bankForecast`).
 */
export function debitedPurchaseForecast(
  templates: readonly RecurringTemplateWithCategory[],
  debited: ReadonlySet<string>,
  months: readonly { year: number; month: number }[],
  movements: readonly Pick<FulfilmentMovement, "occurredOn" | "categoryId">[],
  today: string,
): BankForecast {
  const bought = templates.filter(
    (template) =>
      template.active &&
      isPurchaseInsideWallet(template.categories) &&
      debited.has(template.category_id),
  );
  const occurrences = bought.flatMap((template) =>
    occurrencesOf(template, template.categories, months),
  );

  const arrived = new Set<string>();
  for (const movement of movements) {
    if (movement.occurredOn > today) {
      continue;
    }
    let nearest: FulfilmentOccurrence | null = null;
    for (const occurrence of occurrences) {
      const apart = daysBetween(occurrence.occurredOn, movement.occurredOn);
      if (
        occurrence.categoryId === movement.categoryId &&
        apart <= windowFor(occurrence, movement.occurredOn) &&
        (!nearest ||
          apart < daysBetween(nearest.occurredOn, movement.occurredOn))
      ) {
        nearest = occurrence;
      }
    }
    if (nearest) {
      arrived.add(
        recurringOccurrenceKey(nearest.templateId, nearest.occurredOn),
      );
    }
  }

  return bankForecast(
    bought,
    occurrences,
    [...arrived].map((key) => ({ key })),
    today,
  );
}

/**
 * How to describe a pairing in one line, without repeating the amount.
 *
 * The difference is the part worth saying: "the same to the cent" is
 * reassuring, "€33 more than expected" is the reason to look twice before
 * pressing, and both are more useful than restating a figure already on the
 * row.
 */
export function describeFulfilment(
  proposal: FulfilmentProposal,
  formatMoney: (amount: number) => string,
  locale: Locale,
): string {
  const t = translator(locale);

  // "on the day" beside a date label reads as a second, contradictory date:
  // "Yesterday … on the day". It is the *due* day that was hit.
  //
  // Late and early are two messages rather than one with the word slotted
  // in: French turns them into "de retard" and "d'avance", which sit in a
  // different place in the phrase and elide differently.
  const when =
    proposal.daysApart === 0
      ? t("fulfilment.onTheDay")
      : t(
          proposal.actualOn > proposal.occurredOn
            ? "fulfilment.late"
            : "fulfilment.early",
          { count: proposal.daysApart },
        );

  const line =
    Math.abs(proposal.difference) < 0.005
      ? t("fulfilment.exact", { when })
      : t(proposal.difference > 0 ? "fulfilment.more" : "fulfilment.less", {
          amount: formatMoney(Math.abs(proposal.difference)),
          when,
        });

  // An income paid early for next month says where it will go, because
  // confirming it moves it there: "9 jours d'avance — il comptera pour
  // octobre".
  const month = countsForMonthName(proposal, locale);
  return month ? `${line} — ${t("fulfilment.countsFor", { month })}` : line;
}

/** The month a proposal will count for, named, or null when it stays put. */
export function countsForMonthName(
  proposal: Pick<FulfilmentProposal, "countsForMonth">,
  locale: Locale,
): string | null {
  if (!proposal.countsForMonth) {
    return null;
  }
  return monthLong(Number(proposal.countsForMonth.slice(5, 7)), locale);
}

/**
 * What the confirm button says. "C'est ça" for an ordinary pairing; for an
 * income paid early for next month, what pressing it does: "Compter pour
 * octobre".
 */
export function confirmLabel(
  proposal: Pick<FulfilmentProposal, "countsForMonth">,
  locale: Locale,
): string {
  const t = translator(locale);
  const month = countsForMonthName(proposal, locale);
  return month ? t("fulfilment.countFor", { month }) : t("fulfilment.thatsIt");
}

/* ------------------------------------------------------- why not, though */

/**
 * Why an occurrence was not offered a movement.
 *
 * The thresholds here are deliberately narrow, and a narrow matcher is a
 * silent one: the first report of this feature in use was "there are two
 * identical charges in my ledger and neither was proposed", with no way to
 * find out whether that was the amount, the date, the category or a template
 * with no occurrence this month at all.
 *
 * So the near misses are computed too. Not to loosen the rules — a wrong
 * match hides real spending, which is the failure this design exists to avoid
 * — but so the user can see the rule that excluded a pairing and fix the
 * template, rather than concluding the feature does not work.
 */
export type MissReason =
  /** Nothing in the same category anywhere near it. */
  | "nothing-alike"
  /** Same category and close in time, but the amount is too far off. */
  | "amount"
  /** Same category and amount, but too many days apart. */
  | "date"
  /** A match in every respect except that it has not happened yet. */
  | "not-arrived"
  /** The user said this pairing was wrong. */
  | "refused";

export interface FulfilmentMiss {
  key: string;
  label: string;
  occurredOn: string;
  expectedAmount: number;
  categoryType: CategoryType;
  reason: MissReason;
  /** The closest candidate found, when one was found at all. */
  nearest: {
    amount: number;
    occurredOn: string;
    note: string | null;
    daysApart: number;
    /** The window that applied to it, which an early income widens. */
    window: number;
  } | null;
}

/**
 * What stopped each unmatched occurrence from being offered.
 *
 * Only occurrences with no proposal are considered, so this and
 * `proposeFulfilments` together account for every occurrence exactly once.
 * The reason reported is the *first* rule the nearest candidate broke, in the
 * order a person would ask about them: is there anything like it, has it
 * happened, is it the right size, is it near enough.
 */
export function explainFulfilmentMisses(
  occurrences: readonly FulfilmentOccurrence[],
  movements: readonly FulfilmentMovement[],
  proposals: readonly FulfilmentProposal[],
  {
    today,
    fulfilledKeys = new Set(),
    refusedPairs = new Set(),
  }: ProposeOptions,
): FulfilmentMiss[] {
  const offered = new Set(proposals.map((proposal) => proposal.key));
  const misses: FulfilmentMiss[] = [];

  for (const occurrence of occurrences) {
    const key = recurringOccurrenceKey(
      occurrence.templateId,
      occurrence.occurredOn,
    );
    if (offered.has(key) || fulfilledKeys.has(key)) {
      continue;
    }

    // Only the same category is worth reporting on. A €90.80 transport charge
    // is not "nearly" a €90.80 grocery bill, and saying so would be noise.
    const alike = movements.filter(
      (movement) => movement.categoryId === occurrence.categoryId,
    );

    if (alike.length === 0) {
      misses.push({
        key,
        label: occurrence.label,
        occurredOn: occurrence.occurredOn,
        expectedAmount: occurrence.amount,
        categoryType: occurrence.categoryType,
        reason: "nothing-alike",
        nearest: null,
      });
      continue;
    }

    // Nearest by the same measure the matcher ranks candidates with, so the
    // row explained is the row that would have been offered.
    const nearest = alike.reduce((best, movement) =>
      cost(occurrence, movement) < cost(occurrence, best) ? movement : best,
    );
    const daysApart = daysBetween(occurrence.occurredOn, nearest.occurredOn);

    const reason: MissReason = refusedPairs.has(
      refusalKey(
        occurrence.templateId,
        occurrence.occurredOn,
        nearest.transactionId,
      ),
    )
      ? "refused"
      : nearest.occurredOn > today
        ? "not-arrived"
        : !amountsMatch(occurrence.amount, nearest.amount)
          ? "amount"
          : daysApart > windowFor(occurrence, nearest.occurredOn)
            ? "date"
            : // Every rule passed, so the only thing left is that some other
              // occurrence claimed this movement first.
              "nothing-alike";

    misses.push({
      key,
      label: occurrence.label,
      occurredOn: occurrence.occurredOn,
      expectedAmount: occurrence.amount,
      categoryType: occurrence.categoryType,
      reason,
      nearest: {
        amount: nearest.amount,
        occurredOn: nearest.occurredOn,
        note: nearest.note,
        daysApart,
        window: windowFor(occurrence, nearest.occurredOn),
      },
    });
  }

  return misses.sort((left, right) =>
    left.occurredOn.localeCompare(right.occurredOn),
  );
}

/**
 * The reason in one line, for a screen that has room for it.
 *
 * Takes a locale for the same reason `describeFulfilment` does: this is prose
 * a reader sees, and it was the last string in this module still answering in
 * English whatever the app was set to. The `date` case is plural because
 * "1 days away" is how a matcher loses somebody's trust in its arithmetic.
 */
export function describeMiss(
  miss: FulfilmentMiss,
  formatMoney: (amount: number) => string,
  locale: Locale,
): string {
  const t = translator(locale);

  switch (miss.reason) {
    case "nothing-alike":
      return t("fulfilment.misses.nothingAlike");
    case "refused":
      return t("fulfilment.misses.refused");
    case "not-arrived":
      return t("fulfilment.misses.notArrived");
    case "amount":
      return miss.nearest
        ? t("fulfilment.misses.amountNear", {
            amount: formatMoney(miss.nearest.amount),
            expected: formatMoney(miss.expectedAmount),
          })
        : t("fulfilment.misses.amountNone");
    case "date":
      return miss.nearest
        ? t("fulfilment.misses.dateNear", {
            count: miss.nearest.daysApart,
            window: miss.nearest.window,
          })
        : t("fulfilment.misses.dateNone");
  }
}
