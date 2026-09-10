/**
 * Looking forward.
 *
 * Because standing instructions are modelled properly, twelve months ahead is
 * not a forecast in the guessy sense — it is arithmetic on what the user has
 * already told the app repeats, plus one figure the app has measured rather
 * than guessed. Each month is computed with the same engine the rest of the
 * app uses, so a projected month and a lived month are produced by the same
 * rules and cannot drift apart.
 *
 * ## Two tracks, because one was lying
 *
 * A single line answered "what will the account hold", and counted every euro
 * moved into savings or a wallet as money gone. Someone putting half their pay
 * aside watched the line sink while their wealth grew, which is the opposite
 * of what was happening. So there are two:
 *
 *   `onHand` — what the spending accounts hold.
 *   `kept`   — that, plus everything set aside along the way. The app's own
 *              word for it (see CONTEXT.md): the cash a month leaves in the
 *              account plus everything deliberately put by.
 *
 * The gap between them is exactly what has been set aside over the window.
 *
 * `kept` deliberately stops short of what is *already* invested and of what
 * the market might do to it. Both are real, and both are somebody else's job:
 * the Bearing's net position states the first and Wallets states the second.
 * Putting a live market value on this card would make it a quote that moves
 * on its own, and the one thing this card promises is arithmetic.
 *
 * ## Everyday spending is now subtracted, and that is not an estimate
 *
 * This module used to leave discretionary spending out entirely, on the
 * grounds that a projection the user can reconcile line by line beats one
 * that invents a grocery bill. That was right while there was nothing to put
 * there. There is now: closing a month measures what left the account that no
 * transaction accounts for, and the median across closed months is a
 * description of a normal month rather than a guess about one. Below
 * `MIN_CLOSES_FOR_CAP` closes it is one month wearing a median's clothes, so
 * nothing is subtracted and the caller is told why.
 */

import {
  computeMonthlyBudgetWithProjection,
  computeScheduledSoFar,
  templateOccurrenceDates,
} from "./budget";
import { formatMonthLabel, lastDayIsoOfMonth } from "./constants";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { MIN_CLOSES_FOR_CAP, type CloseHistorySummary } from "./month-close";
import type { RecurringTemplateWithCategory } from "./types/database";

/** Sub-cent differences are rounding, not findings. Same as a close uses. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ProjectionPoint {
  /** YYYY-MM. */
  monthKey: string;
  /** "October 2026", in the caller's language. */
  label: string;
  year: number;
  month: number;
  /** Everything the schedule brings in. */
  income: number;
  /** Committed costs. Yearly charges amortised, as everywhere else. */
  expense: number;
  /** Fresh money into savings and wallets: leaves the account, stays yours. */
  setAside: number;
  /**
   * Investment movement inside a wallet, whose money left the account when it
   * was transferred in. On neither track — carried so a card can say why a
   * €300 monthly purchase moves nothing here.
   */
  deployed: number;
  /** What closed months measure a month costs unseen. Zero until measured. */
  unrecorded: number;
  /** What the spending accounts hold at the end of this month. */
  onHand: number;
  /** That, plus everything set aside since the window opened. */
  kept: number;
}

function shift(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/**
 * What a month costs that nothing records — when the history is long enough
 * to say so.
 *
 * The same bar `suggestUnrecordedCap` uses, for the same reason. Zero rather
 * than null, because as far as the arithmetic is concerned an unmeasured
 * month costs nothing extra; whether it was measured at all is
 * `unrecordedCounted`'s to report, and the card says so out loud rather than
 * quietly showing a rosier line.
 */
export function measuredUnrecorded(closes: CloseHistorySummary | null): number {
  if (
    !closes ||
    closes.baseline === null ||
    closes.sample < MIN_CLOSES_FOR_CAP
  ) {
    return 0;
  }
  return closes.baseline;
}

/* ------------------------------------------------------------ ingredients */

/**
 * One thing the months ahead are made of.
 *
 * A figure nobody can take apart is a figure nobody believes, and this card's
 * whole failure mode was arriving at a number with no way to see that a
 * salary was missing from it. `monthly` is always positive; `kind` says which
 * way it pulls.
 */
export type ProjectionIngredient =
  | {
      kind: "income" | "committed" | "set-aside" | "deployed";
      /** Per month, averaged across the window. */
      monthly: number;
      /** How many charges produce it. Zero is a finding, not a blank. */
      charges: number;
    }
  | {
      kind: "unrecorded";
      monthly: number;
      /** How many closed months the median rests on. */
      closes: number;
      /** False when there are too few closes to subtract anything yet. */
      counted: boolean;
    };

export interface ProjectionMakeup {
  /** In reading order. `deployed` appears only when there is any. */
  ingredients: ProjectionIngredient[];
  /**
   * Nothing scheduled brings money in, anywhere in the window.
   *
   * Its own flag rather than something a caller infers from a zero, because
   * it is the one condition that makes every other figure here meaningless.
   * Someone whose pay is not a charge watches a line fall for twelve months
   * and is told no reason; this is the reason.
   */
  noIncomeScheduled: boolean;
}

/* ---------------------------------------------------------------- opening */

export interface ProjectionOpening {
  /**
   * What the counted accounts hold, or null when no bank is connected and
   * when the reading could not be trusted. Null is ordinary.
   */
  onHand: number | null;
  /**
   * What this month's charges have already done, which the balance above
   * already reflects. Taken off the opening so the first projected month can
   * stay a whole month — otherwise a balance read on the 20th is added to a
   * month that still contains the rent it already paid.
   */
  elapsed: { income: number; expense: number; setAside: number };
  /** Where the two tracks actually start. */
  startOnHand: number;
  startKept: number;
}

/* ---------------------------------------------------------------- summary */

export interface ProjectionSummary {
  endingOnHand: number;
  endingKept: number;
  addedToAccounts: number;
  addedAltogether: number;
  monthlyToAccounts: number;
  monthlyAltogether: number;
  /** Label of the last month in the window. */
  endLabel: string;
  /**
   * Everything kept is smaller at the end than at the start. The one figure
   * worth alarming about — and deliberately not the accounts, which fall
   * perfectly happily while someone invests.
   */
  shrinking: boolean;
  /** The accounts fall. Often set-aside rather than loss, so said separately. */
  accountsFalling: boolean;
  /**
   * There was a balance to start from. False means these are what the months
   * add rather than where they land, and the copy has to say so.
   */
  grounded: boolean;
  /** The measured baseline was subtracted. False when too few closes yet. */
  unrecordedCounted: boolean;
}

/* ------------------------------------------------------------- the window */

export interface ForwardProjectionInput {
  templates: RecurringTemplateWithCategory[];
  /** The month in progress. The window opens here. */
  year: number;
  month: number;
  /** Today, ISO. What this month has already spent comes off the opening. */
  today: string;
  /** How many months to project, including the starting one. */
  months?: number;
  /**
   * What the counted accounts hold, or null.
   *
   * Required rather than defaulted, and that is the lesson of the option it
   * replaces: `startingBalance` was optional, defaulted to zero, and stayed
   * unpassed in every call site for its whole life while the card went on
   * calling the result a balance.
   *
   * Callers pass `cash?.ok ? cash.total : null` and never a partial sum — a
   * reading missing one account is short by whatever that account holds, so
   * it is not a balance.
   */
  onHand: number | null;
  /** The closed-month history. Its median is what a month costs unseen. */
  closes: CloseHistorySummary | null;
  locale?: Locale;
}

export interface ForwardProjection {
  points: ProjectionPoint[];
  opening: ProjectionOpening;
  makeup: ProjectionMakeup;
  /** Null only when no months were asked for. */
  summary: ProjectionSummary | null;
}

/**
 * A month-by-month projection from the active recurring templates.
 *
 * Transactions are deliberately not passed in: this answers "what will the
 * months ahead contain if nothing changes", and a month that has already had
 * one-off spending in it is not that question. What the month has already
 * *scheduled* is a different matter, and comes off the opening balance below.
 *
 * One object in, one object out. The pair this replaces took the opening
 * balance twice — once to build the points and once to summarise them — with
 * no way to notice when the two disagreed.
 */
export function buildForwardProjection(
  input: ForwardProjectionInput,
): ForwardProjection {
  const {
    templates,
    year: fromYear,
    month: fromMonth,
    today,
    months = 12,
    onHand,
    closes,
    locale = DEFAULT_LOCALE,
  } = input;

  const unrecorded = measuredUnrecorded(closes);
  const unrecordedCounted = unrecorded > 0;

  /* What the month in progress has already put through the account. Only
     meaningful with a balance to correct; without one both tracks start at
     zero and there is nothing to double count. */
  const scheduled = computeScheduledSoFar(
    templates,
    fromYear,
    fromMonth,
    today,
  );
  const elapsed = {
    income: scheduled.income,
    expense: scheduled.expense,
    setAside: scheduled.savings + scheduled.investment,
  };

  const grounded = onHand !== null;
  const startOnHand = grounded
    ? roundMoney(onHand - (elapsed.income - elapsed.expense - elapsed.setAside))
    : 0;
  const startKept = grounded
    ? roundMoney(onHand - (elapsed.income - elapsed.expense))
    : 0;

  const points: ProjectionPoint[] = [];
  let runningOnHand = startOnHand;
  let runningKept = startKept;
  const incomeCharges = new Set<string>();
  const committedCharges = new Set<string>();
  const setAsideCharges = new Set<string>();
  const deployedCharges = new Set<string>();

  for (let index = 0; index < months; index += 1) {
    const { year, month } = shift(fromYear, fromMonth, index);

    // month_end so a partially-elapsed starting month still projects whole;
    // the part of it that has already happened came off the opening instead.
    const totals = computeMonthlyBudgetWithProjection(
      [],
      templates,
      year,
      month,
      "month_end",
    );

    const setAside = totals.savings + totals.investment;

    /* Deployments touch neither track. `month-close.ts` is explicit about
       why: money moved inside a wallet already left the current account when
       it was transferred in, so counting it again invents an outflow the bank
       never saw. The old single line subtracted it, and disagreed with the
       close on every month containing one. */
    runningOnHand = roundMoney(
      runningOnHand + totals.income - totals.expense - setAside - unrecorded,
    );
    runningKept = roundMoney(
      runningKept + totals.income - totals.expense - unrecorded,
    );

    points.push({
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      label: formatMonthLabel(year, month, locale),
      year,
      month,
      income: totals.income,
      expense: totals.expense,
      setAside,
      deployed: totals.deployed,
      unrecorded,
      onHand: runningOnHand,
      kept: runningKept,
    });

    collectCharges(templates, year, month, {
      incomeCharges,
      committedCharges,
      setAsideCharges,
      deployedCharges,
    });
  }

  const makeup = buildMakeup(points, {
    unrecorded,
    unrecordedCounted,
    closes,
    incomeCharges: incomeCharges.size,
    committedCharges: committedCharges.size,
    setAsideCharges: setAsideCharges.size,
    deployedCharges: deployedCharges.size,
  });

  return {
    points,
    opening: { onHand, elapsed, startOnHand, startKept },
    makeup,
    summary: summarize(points, {
      startOnHand,
      startKept,
      grounded,
      unrecordedCounted,
    }),
  };
}

/**
 * Which charges feed a month, by kind.
 *
 * Sets of template ids rather than counts, because a weekly charge produces
 * four or five occurrences a month and twelve months of them is one charge,
 * not fifty. Membership is decided by the engine's own occurrence rule, so
 * this cannot drift from what the totals above actually added up.
 */
function collectCharges(
  templates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  into: {
    incomeCharges: Set<string>;
    committedCharges: Set<string>;
    setAsideCharges: Set<string>;
    deployedCharges: Set<string>;
  },
): void {
  const monthEnd = lastDayIsoOfMonth(year, month);

  for (const template of templates) {
    if (!template.active) {
      continue;
    }

    const type = template.categories.type;
    const counts = template.categories.counts_toward_summary !== false;

    /* A yearly expense is amortised rather than dated, so it contributes to
       every month of the window regardless of which month it falls in — the
       same rule `computeMonthlyBudget` applies. Everything else has to
       actually land. */
    const contributes =
      type === "expense" && template.recurrence === "yearly"
        ? true
        : templateOccurrenceDates(template, year, month, monthEnd).length > 0;

    if (!contributes) {
      continue;
    }

    if (type === "income") {
      into.incomeCharges.add(template.id);
      continue;
    }
    if (type === "expense") {
      into.committedCharges.add(template.id);
      continue;
    }
    if (type === "investment" && !counts) {
      into.deployedCharges.add(template.id);
      continue;
    }
    if (counts) {
      into.setAsideCharges.add(template.id);
    }
  }
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return roundMoney(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function buildMakeup(
  points: ProjectionPoint[],
  context: {
    unrecorded: number;
    unrecordedCounted: boolean;
    closes: CloseHistorySummary | null;
    incomeCharges: number;
    committedCharges: number;
    setAsideCharges: number;
    deployedCharges: number;
  },
): ProjectionMakeup {
  const income = mean(points.map((point) => point.income));
  const committed = mean(points.map((point) => point.expense));
  const setAside = mean(points.map((point) => point.setAside));
  const deployed = mean(points.map((point) => point.deployed));

  const ingredients: ProjectionIngredient[] = [
    { kind: "income", monthly: income, charges: context.incomeCharges },
    {
      kind: "committed",
      monthly: committed,
      charges: context.committedCharges,
    },
    { kind: "set-aside", monthly: setAside, charges: context.setAsideCharges },
  ];

  // Only when there is any. A row explaining a zero is a row nobody needs.
  if (deployed > 0) {
    ingredients.push({
      kind: "deployed",
      monthly: deployed,
      charges: context.deployedCharges,
    });
  }

  ingredients.push({
    kind: "unrecorded",
    monthly: context.unrecorded,
    closes: context.closes?.sample ?? 0,
    counted: context.unrecordedCounted,
  });

  return { ingredients, noIncomeScheduled: context.incomeCharges === 0 };
}

function summarize(
  points: ProjectionPoint[],
  context: {
    startOnHand: number;
    startKept: number;
    grounded: boolean;
    unrecordedCounted: boolean;
  },
): ProjectionSummary | null {
  const last = points[points.length - 1];
  if (!last) {
    return null;
  }

  const addedToAccounts = roundMoney(last.onHand - context.startOnHand);
  const addedAltogether = roundMoney(last.kept - context.startKept);

  return {
    endingOnHand: last.onHand,
    endingKept: last.kept,
    addedToAccounts,
    addedAltogether,
    monthlyToAccounts: roundMoney(addedToAccounts / points.length),
    monthlyAltogether: roundMoney(addedAltogether / points.length),
    endLabel: last.label,
    shrinking: addedAltogether < 0,
    accountsFalling: addedToAccounts < 0,
    grounded: context.grounded,
    unrecordedCounted: context.unrecordedCounted,
  };
}

/* ---------------------------------------------------------------- runway */

export interface Runway {
  /** What one month of committed outgoings costs. */
  monthlyCommitted: number;
  /** What the user has set aside, as supplied by the caller. */
  reserve: number;
  /** Months the reserve covers, or null when nothing is committed. */
  months: number | null;
}

/**
 * How long what has been set aside would cover the committed outgoings.
 *
 * "Committed" means the recurring expenses only — not savings or investment
 * contributions, which a person under pressure would stop making. The reserve
 * is the caller's to define, because the app tracks flows rather than balances
 * and only the caller knows which of them it wants to count.
 */
export function buildRunway(
  reserve: number,
  templates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
): Runway {
  const totals = computeMonthlyBudgetWithProjection(
    [],
    templates,
    year,
    month,
    "month_end",
  );

  const monthlyCommitted = totals.expense;

  return {
    monthlyCommitted,
    reserve,
    months:
      monthlyCommitted > 0
        ? Math.round((reserve / monthlyCommitted) * 10) / 10
        : null,
  };
}

/** "4.2 months of committed costs", or null when there is nothing to say. */
export function formatRunway(
  runway: Runway,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (runway.months === null || runway.reserve <= 0) {
    return null;
  }
  const t = translator(locale);
  if (runway.months < 1) {
    return t("runway.underAMonth");
  }
  return t("runway.months", { count: runway.months });
}
