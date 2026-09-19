/**
 * What a category's run of months has been doing.
 *
 * `category-history.ts` draws the series; this reads it. They are different
 * jobs: a screen that states twelve figures and draws no conclusion leaves
 * the reader to do the one thing a computer is better at, which is noticing
 * that a number has been going the same way for five months.
 *
 * Carries no rendered text, only a key and its parameters — the precedent is
 * `attention.ts`, and the reason is the same: a client handed a key cannot
 * introduce a fourth wording, because there is no string here to improvise
 * from.
 *
 * Pure. Testable without a database, a network or a model.
 */

import { categorySense } from "./category-facts";
import type { CategoryHistory, CategoryMonthPoint } from "./category-history";
import type { Key, Vars } from "./i18n/t";
import type { CategoryType } from "./types/database";

export type FindingKind = "drift" | "odd-month" | "gone-quiet" | "every-year";

export interface CategoryFinding {
  /** Stable across a render, and what the model names when it re-ranks. */
  id: string;
  kind: FindingKind;
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  /**
   * What it is worth, in currency units a month. Always positive: which way
   * it went is `direction`, and whether that is good news depends on the
   * category type — `findingIsGoodNews` below is the one place that decides,
   * because a client reading `direction` on its own paints a salary that
   * stopped arriving green.
   */
  severity: number;
  direction: "up" | "down";
  /** The months it points at, as `YYYY-MM`, oldest first. */
  months: string[];
  messageKey: Key;
  params: Vars;
}

/**
 * Whether a finding is welcome news, which its direction alone cannot say.
 *
 * A rise in income is not a rise in spending — the design says so, and
 * `categorySense` is where that judgement already lives: it is what tells a
 * model, through `category-selection-prompt.ts`, which way is good. Asked
 * here on behalf of a screen so that the model and the reader are told the
 * same thing, and so that two components colouring an arrow by hand cannot
 * come to two answers.
 */
export function findingIsGoodNews(
  finding: Pick<CategoryFinding, "type" | "direction">,
): boolean {
  return categorySense(finding.type) === "up-is-good"
    ? finding.direction === "up"
    : finding.direction === "down";
}

/**
 * How many months back a normal is taken over.
 *
 * Twelve, not the whole read window. A category that genuinely stepped up a
 * year ago has settled at its new level, and a normal dragged back towards
 * the old one would report a drift that finished twelve months ago as though
 * it were news. The deeper history is for `every-year` and nothing else.
 */
export const NORMAL_WINDOW = 12;

/** The recent side of a drift, and the side it is measured against. */
export const DRIFT_RECENT = 3;
export const DRIFT_BASELINE = 6;

/**
 * Both floors, and why there are two.
 *
 * A relative floor alone lets a four-euro category shout. An absolute floor
 * alone lets a category with a large normal hide a real change inside it.
 */
export const DRIFT_RELATIVE_FLOOR = 0.15;
export const DRIFT_ABSOLUTE_FLOOR = 25;

/**
 * How many spreads from the normal a month has to be before it is worth a
 * sentence, and how many currency units at the least.
 *
 * Three spreads is not an appeal to statistical convention — with a median
 * absolute deviation over twelve points it is simply the width at which the
 * months a person would call unusual start being caught and the ones they
 * would not, stop.
 */
export const ODD_MONTH_SPREADS = 3;
export const ODD_MONTH_ABSOLUTE_FLOOR = 40;

/**
 * What counts as a run, and what counts as a silence.
 *
 * Four of the six preceding months rather than all six, because a genuinely
 * monthly charge still misses one when a bank holiday moves it. Three silent
 * months rather than one, because a charge that lands on the 2nd has not
 * stopped on the 1st.
 */
export const QUIET_ACTIVE_OF_SIX = 4;
export const QUIET_SILENT_MONTHS = 3;

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What a category costs in an ordinary month, and how much it usually varies.
 *
 * The spread is the median absolute deviation rather than a standard
 * deviation, for the same reason the centre is a median: one monstrous month
 * inflates a standard deviation enough to hide itself inside it.
 */
export function categoryNormal(
  points: readonly CategoryMonthPoint[],
  window: number = NORMAL_WINDOW,
): { normal: number; spread: number } {
  const recent = points.slice(-window).filter((point) => !point.empty);
  const totals = recent.map((point) => point.total);
  const normal = median(totals);
  const spread = median(totals.map((total) => Math.abs(total - normal)));
  return { normal: round(normal), spread: round(spread) };
}

/** Non-empty totals from a slice, for a median that ignores holes. */
function activeTotals(points: readonly CategoryMonthPoint[]): number[] {
  return points.filter((point) => !point.empty).map((point) => point.total);
}

function driftFinding(history: CategoryHistory): CategoryFinding | null {
  const points = history.points;
  const recent = points.slice(-DRIFT_RECENT);
  const baseline = points.slice(
    -(DRIFT_RECENT + DRIFT_BASELINE),
    -DRIFT_RECENT,
  );

  const recentTotals = activeTotals(recent);
  const baselineTotals = activeTotals(baseline);

  // "Normal" needs something to be normal against. Three months either side
  // is the least that can distinguish a run from two coincidences.
  if (recentTotals.length < 3 || baselineTotals.length < 3) {
    return null;
  }

  const before = median(baselineTotals);
  const after = median(recentTotals);
  const gap = after - before;
  const size = Math.abs(gap);

  if (before <= 0) {
    return null;
  }
  if (size < DRIFT_ABSOLUTE_FLOOR || size / before < DRIFT_RELATIVE_FLOOR) {
    return null;
  }

  const direction = gap > 0 ? "up" : "down";
  const months = recent.map((point) => point.monthKey);

  return {
    id: `drift:${history.categoryId}`,
    kind: "drift",
    categoryId: history.categoryId,
    categoryName: history.name,
    type: history.type,
    severity: round(size),
    direction,
    months,
    messageKey:
      direction === "up"
        ? "categoryFindings.driftUp"
        : "categoryFindings.driftDown",
    params: { months: DRIFT_RECENT },
  };
}

function oddMonthFinding(history: CategoryHistory): CategoryFinding | null {
  const { normal, spread } = categoryNormal(history.points);
  if (normal <= 0) {
    return null;
  }

  const window = history.points.slice(-NORMAL_WINDOW).filter((p) => !p.empty);
  if (window.length < 6) {
    return null;
  }

  // A spread of zero means a perfectly flat run, where any departure at all
  // is the odd month. The absolute floor is what keeps that honest.
  const bar = Math.max(spread * ODD_MONTH_SPREADS, ODD_MONTH_ABSOLUTE_FLOOR);

  let worst: CategoryMonthPoint | null = null;
  let worstDistance = 0;
  for (const point of window) {
    const distance = Math.abs(point.total - normal);
    if (distance >= bar && distance > worstDistance) {
      worst = point;
      worstDistance = distance;
    }
  }

  if (!worst) {
    return null;
  }

  const direction = worst.total > normal ? "up" : "down";

  return {
    id: `odd-month:${history.categoryId}:${worst.monthKey}`,
    kind: "odd-month",
    categoryId: history.categoryId,
    categoryName: history.name,
    type: history.type,
    severity: round(worstDistance),
    direction,
    months: [worst.monthKey],
    messageKey:
      direction === "up"
        ? "categoryFindings.oddMonthHigh"
        : "categoryFindings.oddMonthLow",
    params: { month: worst.label },
  };
}

function goneQuietFinding(history: CategoryHistory): CategoryFinding | null {
  const points = history.points;
  const recent = points.slice(-QUIET_SILENT_MONTHS);
  const before = points.slice(
    -(QUIET_SILENT_MONTHS + 6),
    -QUIET_SILENT_MONTHS,
  );

  const recentActive = recent.filter((point) => !point.empty);
  const beforeActive = before.filter((point) => !point.empty);

  // Stopped: a run, then nothing.
  if (
    recentActive.length === 0 &&
    beforeActive.length >= QUIET_ACTIVE_OF_SIX
  ) {
    return {
      id: `gone-quiet:${history.categoryId}`,
      kind: "gone-quiet",
      categoryId: history.categoryId,
      categoryName: history.name,
      type: history.type,
      severity: round(
        Math.abs(median(beforeActive.map((point) => point.total))),
      ),
      direction: "down",
      months: recent.map((point) => point.monthKey),
      messageKey: "categoryFindings.goneQuiet",
      params: { months: QUIET_SILENT_MONTHS },
    };
  }

  // Appeared: nothing, then a run. The same shape read backwards.
  if (
    beforeActive.length === 0 &&
    recentActive.length === QUIET_SILENT_MONTHS
  ) {
    const first = recent[0]!;
    return {
      id: `gone-quiet:${history.categoryId}`,
      kind: "gone-quiet",
      categoryId: history.categoryId,
      categoryName: history.name,
      type: history.type,
      severity: round(
        Math.abs(median(recentActive.map((point) => point.total))),
      ),
      direction: "up",
      months: recent.map((point) => point.monthKey),
      messageKey: "categoryFindings.appeared",
      params: { month: first.label },
    };
  }

  return null;
}

/**
 * How many years the same calendar month has to behave the same way.
 *
 * Two, which is the least that can be a pattern rather than a coincidence,
 * and the reason the read window is thirty-six months rather than twelve.
 */
export const SEASON_YEARS = 2;

/**
 * The calendar months this category reliably runs away from its normal in.
 *
 * Returned as the set of `YYYY-MM` keys inside the window that belong to
 * those calendar months, because that is the form the demotion needs.
 */
function seasonalMonths(history: CategoryHistory): {
  keys: Set<string>;
  latest: CategoryMonthPoint | null;
  direction: "up" | "down";
} {
  const { normal, spread } = categoryNormal(history.points);
  const bar = Math.max(spread * ODD_MONTH_SPREADS, ODD_MONTH_ABSOLUTE_FLOOR);
  const keys = new Set<string>();
  let latest: CategoryMonthPoint | null = null;
  let direction: "up" | "down" = "up";

  if (normal <= 0) {
    return { keys, latest, direction };
  }

  const byCalendarMonth = new Map<string, CategoryMonthPoint[]>();
  for (const point of history.points) {
    if (point.empty) {
      continue;
    }
    const calendar = point.monthKey.slice(5);
    byCalendarMonth.set(calendar, [
      ...(byCalendarMonth.get(calendar) ?? []),
      point,
    ]);
  }

  for (const [, points] of byCalendarMonth) {
    if (points.length < SEASON_YEARS) {
      continue;
    }
    const up = points.every((point) => point.total - normal >= bar);
    const down = points.every((point) => normal - point.total >= bar);
    if (!up && !down) {
      continue;
    }
    for (const point of points) {
      keys.add(point.monthKey);
    }
    const last = points[points.length - 1]!;
    if (!latest || last.monthKey > latest.monthKey) {
      latest = last;
      direction = up ? "up" : "down";
    }
  }

  return { keys, latest, direction };
}

/**
 * Every finding across every category, heaviest first.
 *
 * Heaviest in currency units a month, never as a percentage and never as a
 * composite score. Currency units are comparable between categories and
 * percentages are not, and this is the ordering the screen falls back to when
 * no model answers — so it has to stand on its own rather than be a stopgap.
 */
export function buildCategoryFindings(
  histories: readonly CategoryHistory[],
): CategoryFinding[] {
  const findings: CategoryFinding[] = [];

  for (const history of histories) {
    const season = seasonalMonths(history);

    // A finding every one of whose months is a month this category always
    // behaves this way in is not news. Demoted rather than listed — see the
    // design note: a screen that cries wolf on schedule is one nobody reads.
    //
    // Routing goneQuietFinding through here is a no-op for its "stopped"
    // half: those months are the empty ones, and seasonalMonths skips empty
    // points, so a charge that goes quiet every summer will still be
    // reported as gone quiet — that is within what the design asked for,
    // since it named only drift and odd-month. Its "appeared" half is
    // genuinely demotable: a category that appears every September has
    // non-empty months to check against, and that is the case this earns
    // its place for.
    const survives = (finding: CategoryFinding | null) =>
      finding && !finding.months.every((key) => season.keys.has(key))
        ? finding
        : null;

    const kept = [
      survives(driftFinding(history)),
      survives(oddMonthFinding(history)),
      survives(goneQuietFinding(history)),
    ].filter((finding): finding is CategoryFinding => finding !== null);

    // The seasonal note appears only when nothing else survived, and only
    // about the month on screen now. Said on its own it answers the
    // question the demotion raises: why is this high month not a finding?
    const currentIsSeasonal =
      season.latest !== null &&
      season.latest.monthKey ===
        history.points[history.points.length - 1]?.monthKey;

    if (kept.length === 0 && currentIsSeasonal && season.latest) {
      const { normal } = categoryNormal(history.points);
      findings.push({
        id: `every-year:${history.categoryId}:${season.latest.monthKey}`,
        kind: "every-year",
        categoryId: history.categoryId,
        categoryName: history.name,
        type: history.type,
        severity: round(Math.abs(season.latest.total - normal)),
        direction: season.direction,
        months: [season.latest.monthKey],
        messageKey: "categoryFindings.everyYear",
        params: { month: season.latest.label },
      });
      continue;
    }

    findings.push(...kept);
  }

  return findings.sort((a, b) => b.severity - a.severity);
}
