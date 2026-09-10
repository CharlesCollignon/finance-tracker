/**
 * The figures the Bearing is allowed to show, and a model is allowed to name.
 *
 * The same contract `month-facts.ts` sets out, widened from one month to the
 * whole position: a model is handed this pack and refers to figures by id; the
 * app substitutes its own formatted value at render time. The three reasons
 * given there hold here unchanged — the display currency is a client-side
 * preference, amounts are blurred one element at a time, and a figure nobody
 * computed has no business on a screen — so this reuses `MonthFact`,
 * `MissingFact` and the helpers rather than starting a parallel vocabulary.
 *
 * What is different is the envelope. A month read is about a month and says
 * so; a Bearing is about a day, and its pack spans four horizons at once:
 * what is held now, how the current month is going, what a run of months has
 * looked like, and where the standing instructions lead. The `family` on each
 * datum is what lets the surface group them without hard-coding a list of ids
 * in two apps.
 *
 * Everything here is pure and every input is already computed elsewhere. This
 * module does no finance of its own beyond choosing a sense and a label,
 * which is exactly the amount of judgement a fact pack should contain.
 */

import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";

import type { AllocationSummary } from "./allocation";
import type { Bearing } from "./bearing";
import type { FundCostSummary } from "./fund-costs";
import type { InvestmentReturns } from "./investment-returns";
import type { CloseHistorySummary } from "./month-close";
import type { MonthComparison } from "./month-comparison";
import type {
  FactSense,
  MissingFact,
  MissingReason,
  MonthFact,
} from "./month-facts";
import type { MonthPulse } from "./month-pulse";
import type { ForwardProjection, Runway } from "./projection";
import type { MonthlySummary } from "./types/database";

/**
 * Which horizon a figure belongs to.
 *
 * Carried on the datum rather than derived from its id, because the surface
 * groups by it and two apps deriving the same grouping from a naming
 * convention is two places for that convention to rot.
 */
export type FactFamily = "now" | "month" | "run" | "ahead" | "wallet";

export interface BearingFact extends MonthFact {
  family: FactFamily;
}

export interface BearingFacts {
  /** The day the pack describes, ISO. A bearing is taken on a date. */
  asOf: string;
  facts: BearingFact[];
  missing: MissingFact[];
  /**
   * Nothing worth spending a model call on.
   *
   * The same flag `MonthFacts` carries and for the same reason: a confident
   * arrangement of an empty account is the single worst thing this feature
   * could produce. Read by `decideMonthReadWrite`, which is shared.
   */
  thin: boolean;
}

/** Percentages are carried as points, the way `month-facts` carries them. */
function points(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface BuildBearingFactsInput {
  /** Today, ISO. */
  asOf: string;
  bearing: Bearing;
  /** The month in progress, live. Null when it could not be worked out. */
  pulse: MonthPulse | null;
  /** The month in progress, recorded. */
  summary: MonthlySummary;
  comparison: MonthComparison | null;
  closeSummary: CloseHistorySummary | null;
  /** The user's cap on unrecorded spending, when they have set one. */
  unrecordedCap: number | null;
  /** Twelve months of standing instructions, and what they are made of. */
  projection: ForwardProjection | null;
  runway: Runway | null;
  /**
   * What recent months actually netted, newest last.
   *
   * Kept as bare numbers rather than the trend rows: this pack needs the
   * average and nothing else, and passing the rows would invite a second
   * consumer to start reading dates off them.
   */
  trend: readonly number[];
  returns: InvestmentReturns | null;
  allocation: AllocationSummary | null;
  costs: FundCostSummary | null;
  /** What a typical month puts into the wallets. */
  contributionPace: number;
  /** Bank rows still waiting for a category. */
  inboxPending: number;
  locale?: Locale;
}

export function buildBearingFacts(
  input: BuildBearingFactsInput,
): BearingFacts {
  const {
    asOf,
    bearing,
    pulse,
    summary,
    comparison,
    closeSummary,
    unrecordedCap,
    projection,
    runway,
    trend,
    returns,
    allocation,
    costs,
    contributionPace,
    inboxPending,
  } = input;

  const t = translator(input.locale ?? DEFAULT_LOCALE);
  const facts: BearingFact[] = [];
  const missing: MissingFact[] = [];

  const push = (
    family: FactFamily,
    id: string,
    label: string,
    unit: MonthFact["unit"],
    value: number,
    sense: FactSense,
    note?: string,
  ) => {
    facts.push({ family, id, label, unit, value: round(value), sense, note });
  };

  const money = (
    family: FactFamily,
    id: string,
    label: string,
    value: number,
    sense: FactSense,
    note?: string,
  ) => push(family, id, label, "money", value, sense, note);

  const absent = (id: string, label: string, why: MissingReason) => {
    missing.push({ id, label, why });
  };

  /* ------------------------------------------------ what is held now */

  if (bearing.netPosition !== null) {
    money(
      "now",
      "net-position",
      t("bearingFacts.netPosition"),
      bearing.netPosition,
      "up-is-good",
      // Not decoration. A figure presented as someone's worth, in an app that
      // records no debts, is wrong by exactly their mortgage — and the note
      // rides on the datum so the caveat reaches the model and the screen
      // together, rather than living in a comment that protects nobody.
      t("bearingFacts.netPositionNote"),
    );
  } else {
    absent("net-position", t("bearingFacts.netPosition"), "no-bank");
  }

  if (pulse?.onHand != null) {
    money("now", "on-hand", t("bearingFacts.onHand"), pulse.onHand, "up-is-good");
  } else {
    absent("on-hand", t("bearingFacts.onHand"), "no-bank");
  }

  if (bearing.invested > 0) {
    money(
      "now",
      "invested",
      t("bearingFacts.invested"),
      bearing.invested,
      "up-is-good",
    );
  }

  if (bearing.investedShare !== null && bearing.invested > 0) {
    push(
      "now",
      "invested-share",
      t("bearingFacts.investedShare"),
      "percent",
      points(bearing.investedShare),
      // Neither good nor bad on purpose. More invested is more growth and less
      // reachable, and which of those someone needs is not a thing this app
      // knows. A sense of `up-is-good` here would have a model congratulating
      // somebody for having no accessible cash.
      "neutral",
    );
  }

  /* -------------------------------------------- how the month is going */

  if (pulse) {
    if (pulse.free !== null) {
      money("month", "free", t("bearingFacts.free"), pulse.free, "up-is-good");
    }
    if (pulse.committed > 0) {
      money(
        "month",
        "committed",
        t("bearingFacts.committed"),
        pulse.committed,
        "neutral",
      );
    }
    if (pulse.arriving > 0) {
      money(
        "month",
        "arriving",
        t("bearingFacts.arriving"),
        pulse.arriving,
        "up-is-good",
      );
    }
    if (pulse.unrecordedSoFar !== null) {
      money(
        "month",
        "unrecorded-so-far",
        t("bearingFacts.unrecordedSoFar"),
        pulse.unrecordedSoFar,
        "up-is-bad",
        t("bearingFacts.unrecordedSoFarNote"),
      );
    } else {
      absent(
        "unrecorded-so-far",
        t("bearingFacts.unrecordedSoFar"),
        pulse.onHand === null ? "no-bank" : "no-close",
      );
    }
  }

  if (summary.income > 0) {
    push(
      "month",
      "savings-rate",
      t("bearingFacts.savingsRate"),
      "percent",
      ((summary.savings + summary.investments) / summary.income) * 100,
      "up-is-good",
    );
  }

  if (comparison && comparison.comparable) {
    money(
      "month",
      "expenses-vs-previous",
      t("bearingFacts.expensesVsPrevious", { month: comparison.previousLabel }),
      comparison.delta,
      "up-is-bad",
      comparison.partial
        ? t("bearingFacts.expensesVsPreviousNote")
        : undefined,
    );
  }

  if (unrecordedCap !== null) {
    money(
      "month",
      "unrecorded-allowance",
      t("bearingFacts.unrecordedAllowance"),
      unrecordedCap,
      "neutral",
      t("bearingFacts.unrecordedAllowanceNote"),
    );
    // The overshoot as a figure of its own, for the reason `month-facts.ts`
    // records at length: a model that wants "over by" and has only the
    // allowance will point at the allowance and call it the overshoot. The
    // fix is arithmetic on this side of the line, where it is tested.
    const measured = pulse?.unrecordedSoFar ?? null;
    if (measured !== null && measured > unrecordedCap) {
      money(
        "month",
        "unrecorded-over",
        t("bearingFacts.unrecordedOver"),
        measured - unrecordedCap,
        "up-is-bad",
      );
    }
  } else {
    absent(
      "unrecorded-allowance",
      t("bearingFacts.unrecordedAllowance"),
      "no-cap",
    );
  }

  /* ------------------------------------------------- across the months */

  if (closeSummary) {
    if (closeSummary.baseline !== null) {
      money(
        "run",
        "unrecorded-baseline",
        t("bearingFacts.unrecordedBaseline"),
        closeSummary.baseline,
        "up-is-bad",
        t("bearingFacts.unrecordedBaselineNote"),
      );
    }
    if (closeSummary.streak > 0) {
      push(
        "run",
        "streak",
        t("bearingFacts.streak"),
        "count",
        closeSummary.streak,
        "up-is-good",
      );
    }
    if (closeSummary.bestStreak > 0) {
      push(
        "run",
        "best-streak",
        t("bearingFacts.bestStreak"),
        "count",
        closeSummary.bestStreak,
        "up-is-good",
      );
    }
  }

  if (trend.length > 0) {
    money(
      "run",
      "monthly-net-average",
      t("bearingFacts.monthlyNetAverage", { count: trend.length }),
      trend.reduce((sum, net) => sum + net, 0) / trend.length,
      "up-is-good",
    );
  }

  /* ------------------------------------------------------ where it leads */

  const ahead = projection?.summary ?? null;

  if (ahead && projection && !projection.makeup.noIncomeScheduled) {
    // The word matters. `projection.ts` refuses to call this a forecast
    // because it is arithmetic on instructions the user already gave, and the
    // note is what stops a model reaching for the other word. Which note
    // depends on whether a normal month's unseen spending was measurable —
    // claiming it was taken off when it was not is the one thing worse than
    // not taking it off.
    const aheadNote = ahead.unrecordedCounted
      ? t("bearingFacts.projectedBalanceNote")
      : t("bearingFacts.projectedBalanceNoteUnmeasured");

    money(
      "ahead",
      "projected-balance",
      ahead.grounded
        ? t("bearingFacts.projectedBalance", { month: ahead.endLabel })
        : t("bearingFacts.projectedAdded", { count: projection.points.length }),
      ahead.grounded ? ahead.endingOnHand : ahead.addedToAccounts,
      "up-is-good",
      aheadNote,
    );

    // The one the accounts line cannot say. Money moved into savings or a
    // wallet leaves the account and stays the user's; a figure that counts
    // only the account has a diligent saver going backwards.
    money(
      "ahead",
      "projected-kept",
      ahead.grounded
        ? t("bearingFacts.projectedKept", { month: ahead.endLabel })
        : t("bearingFacts.projectedKeptAdded", {
            count: projection.points.length,
          }),
      ahead.grounded ? ahead.endingKept : ahead.addedAltogether,
      "up-is-good",
      t("bearingFacts.projectedKeptNote"),
    );

    money(
      "ahead",
      "projected-monthly-net",
      t("bearingFacts.projectedMonthlyNet"),
      ahead.monthlyToAccounts,
      "up-is-good",
    );
  } else if (projection) {
    /* Withheld rather than stated. Without an income charge every one of
       these is arithmetic on outflow alone, and a model handed the result
       writes a warning about a catastrophe that is really a missing
       template. */
    for (const [id, label] of [
      ["projected-balance", t("bearingFacts.projectedBalanceBare")],
      ["projected-kept", t("bearingFacts.projectedKeptBare")],
      ["projected-monthly-net", t("bearingFacts.projectedMonthlyNet")],
    ] as const) {
      absent(id, label, "no-income");
    }
  }

  if (runway) {
    if (runway.monthlyCommitted > 0) {
      money(
        "ahead",
        "committed-monthly",
        t("bearingFacts.committedMonthly"),
        runway.monthlyCommitted,
        "up-is-bad",
      );
    }
    if (runway.months !== null && runway.reserve > 0) {
      push(
        "ahead",
        "runway-months",
        t("bearingFacts.runwayMonths"),
        "months",
        runway.months,
        "up-is-good",
      );
    }
  }

  /* ------------------------------------------------------- the wallets */

  if (returns && returns.total.invested > 0) {
    money(
      "wallet",
      "wallet-cost",
      t("bearingFacts.walletCost"),
      returns.total.invested,
      "neutral",
    );
    money(
      "wallet",
      "wallet-gain",
      t("bearingFacts.walletGain"),
      returns.total.absoluteGain,
      "up-is-good",
    );

    if (returns.total.rate !== null) {
      push(
        "wallet",
        "wallet-return",
        t("bearingFacts.walletReturn"),
        "percent",
        points(returns.total.rate),
        "up-is-good",
        t("bearingFacts.walletReturnNote"),
      );
    } else {
      absent(
        "wallet-return",
        t("bearingFacts.walletReturn"),
        returns.total.unavailableReason === "too-short"
          ? "too-short"
          : "not-recorded",
      );
    }
  } else {
    absent("wallet-return", t("bearingFacts.walletReturn"), "nothing-invested");
  }

  if (costs && costs.totalAnnualCost > 0) {
    money(
      "wallet",
      "wallet-drag",
      t("bearingFacts.walletDrag"),
      costs.totalAnnualCost,
      "up-is-bad",
      costs.missingCount > 0
        ? t("bearingFacts.walletDragPartial", { count: costs.missingCount })
        : t("bearingFacts.walletDragNote"),
    );
  }

  // The furthest a wallet has drifted, as a positive number of points, and
  // only when the targets cover enough of the portfolio to mean anything —
  // `buildAllocation` already declines to report drift against a
  // half-specified target set, and this respects that rather than reading
  // the rows behind its back.
  const drift = largestDrift(allocation);
  if (drift !== null) {
    push(
      "wallet",
      "wallet-drift",
      t("bearingFacts.walletDrift"),
      "percent",
      drift,
      "up-is-bad",
      t("bearingFacts.walletDriftNote"),
    );
  } else {
    absent("wallet-drift", t("bearingFacts.walletDrift"), "no-target");
  }

  if (bearing.concentration) {
    push(
      "wallet",
      "wallet-concentration",
      t("bearingFacts.walletConcentration", {
        name: bearing.concentration.name,
      }),
      "percent",
      points(bearing.concentration.weight),
      "up-is-bad",
      t("bearingFacts.walletConcentrationNote"),
    );
  }

  if (contributionPace > 0) {
    money(
      "wallet",
      "contribution-pace",
      t("bearingFacts.contributionPace"),
      contributionPace,
      "up-is-good",
    );
  }

  /* -------------------------------------------------- what is unfinished */

  if (inboxPending > 0) {
    push(
      "now",
      "inbox-pending",
      t("bearingFacts.inboxPending"),
      "count",
      inboxPending,
      "up-is-bad",
    );
  }

  return {
    asOf,
    facts,
    missing,
    // Thin is about the position, not the pack. A pack can carry half a dozen
    // datums that are all zero — a new account with a cap set and nothing in
    // it — and arranging those is still an expensive way to show somebody
    // nothing.
    thin:
      bearing.netPosition === null &&
      bearing.invested === 0 &&
      summary.income === 0 &&
      summary.expenses === 0 &&
      summary.savings === 0,
  };
}

/**
 * How far the worst-placed wallet is from its target, in points.
 *
 * Positive whichever way it has drifted: "eight points out" is the fact, and
 * whether that is over or under is the tile's business rather than the pack's.
 * Null when `buildAllocation` says the targets are not worth measuring
 * against, which is its judgement to make and not this module's to second-
 * guess.
 */
function largestDrift(allocation: AllocationSummary | null): number | null {
  if (!allocation || !allocation.needsRebalance) {
    return null;
  }

  let worst: number | null = null;
  for (const row of allocation.rows) {
    if (row.driftPoints === null) {
      continue;
    }
    const size = Math.abs(row.driftPoints);
    if (worst === null || size > worst) {
      worst = size;
    }
  }

  return worst === null ? null : Math.round(worst * 10) / 10;
}

/** Every id in the pack, for verifying what a model claims to rest on. */
export function bearingFactIds(facts: BearingFacts): Set<string> {
  return new Set(facts.facts.map((fact) => fact.id));
}

/** The datums of one horizon, in the order they were built. */
export function factsOfFamily(
  facts: BearingFacts,
  family: FactFamily,
): BearingFact[] {
  return facts.facts.filter((fact) => fact.family === family);
}
