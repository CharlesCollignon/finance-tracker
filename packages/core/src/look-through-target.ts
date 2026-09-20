/**
 * Turning a shape into weights.
 *
 * The read that gets written over a look-through may propose instruments, and
 * it may say what part each one should play — but it never says what
 * percentage anything should be. That is computed here.
 *
 * ## Why the model does not emit the numbers
 *
 * The house rule is that a model writes no figures: it cites `{{fact:id}}`
 * and the app substitutes its own. `writesAFigure` enforces it on every
 * sentence. A target allocation looks like the one place that rule has to
 * bend, and bending it costs more than it looks:
 *
 *   - The check is on digits, so the moment a model wants to *explain* a
 *     target it writes "about a fifth of the CTO" instead, which passes and
 *     is exactly the smuggled magnitude the rule exists to stop.
 *   - Sum-to-one and in-bounds verify plausibility, not correctness. Half
 *     world and half emerging markets satisfies every check and is wrong for
 *     almost everyone. The verifier would be giving false confidence.
 *   - A model-authored number cannot be cited as a datum, so the prose and
 *     the percentages end up in two disconnected registers.
 *   - And a deployment with no API key would have no target at all, where
 *     `029_bearing.sql` set the precedent: "a deployment with no model key
 *     still has a bearing rather than an empty screen."
 *
 * So the model picks from two closed vocabularies — a role and a weight class
 * — both verified the way `verifyMonthRead` verifies a datum id: an unknown
 * one is fatal. Every percentage on the surface is then this module's
 * arithmetic, which makes it a `Datum` the prose can cite, and makes the
 * whole target testable against a fixture rather than eyeballed.
 */

import {
  shortlistEntry,
  type IndexFamily,
  type ShortlistEntry,
} from "./etf-shortlist";
import type { InvestmentWalletId } from "./investments";
import type { LookThrough } from "./look-through";

/** What part an instrument plays in the portfolio. */
export const SUGGESTION_ROLES = [
  "core-world",
  "us-large",
  "europe",
  "emerging",
  "small-cap",
  "bond",
] as const;

export type SuggestionRole = (typeof SUGGESTION_ROLES)[number];

/**
 * How much of the portfolio a holding should be, said without a number.
 *
 * Five classes rather than a percentage. They are ordinal and their ratios
 * are this module's business, not the model's — which means a change of mind
 * about how big a satellite should be is one constant here, not a re-run.
 */
export const WEIGHT_CLASSES = [
  "lead",
  "support",
  "satellite",
  "trim",
  "exit",
] as const;

export type WeightClass = (typeof WEIGHT_CLASSES)[number];

/** Relative pull of each class, before constraints and normalisation. */
const CLASS_UNITS: Record<WeightClass, number> = {
  lead: 6,
  support: 3,
  satellite: 1,
  trim: 0.5,
  exit: 0,
};

/** No single satellite may quietly become a core holding. */
export const MAX_SATELLITE_WEIGHT = 0.1;

/** A portfolio with a lead is a portfolio that has a centre of gravity. */
export const MIN_LEAD_WEIGHT = 0.4;

/** Below this, a line is not worth the trade that would create it. */
export const MIN_MEANINGFUL_WEIGHT = 0.02;

/** Below this, an arbitrage is noise rather than an instruction. */
export const MIN_MEANINGFUL_MOVE = 50;

/** What the read proposes for one instrument, with no figures in it. */
export interface RoleAssignment {
  isin: string;
  role: SuggestionRole;
  wallet: InvestmentWalletId;
  weightClass: WeightClass;
}

export interface TargetRow {
  isin: string;
  /** From the catalogue, never from the model. */
  name: string;
  symbol: string;
  role: SuggestionRole;
  wallet: InvestmentWalletId;
  weightClass: WeightClass;
  /** Share of the portfolio this should be, 0–1. */
  weight: number;
}

export interface TargetAllocation {
  rows: TargetRow[];
  /** Always 1 when there are rows, 0 when there are none. */
  coverage: number;
  /** Assignments dropped, and why — nothing is silently discarded. */
  dropped: {
    isin: string;
    reason: "not-catalogued" | "wrong-wrapper" | "exit" | "too-small";
  }[];
}

/** One move that takes the portfolio towards its target. */
export interface ArbitrageMove {
  isin: string | null;
  name: string;
  wallet: InvestmentWalletId;
  currentValue: number;
  targetValue: number;
  /** Positive means buy, negative means sell. */
  delta: number;
}

function normalise(units: Map<string, number>): Map<string, number> {
  const total = [...units.values()].reduce((sum, unit) => sum + unit, 0);
  if (total <= 0) {
    return new Map();
  }
  return new Map(
    [...units.entries()].map(([isin, unit]) => [isin, unit / total]),
  );
}

/**
 * Push weights back inside their bounds, then re-normalise.
 *
 * Capping a satellite frees weight that has to land somewhere, and handing it
 * to whatever happens to be first would make the result depend on map order.
 * It goes to the lead, or is spread across the uncapped rows when there is no
 * lead — either way the total is one when this returns.
 */
function applyConstraints(
  weights: Map<string, number>,
  classes: Map<string, WeightClass>,
): Map<string, number> {
  const capped = new Map(weights);
  let freed = 0;

  for (const [isin, weight] of capped.entries()) {
    if (classes.get(isin) === "satellite" && weight > MAX_SATELLITE_WEIGHT) {
      freed += weight - MAX_SATELLITE_WEIGHT;
      capped.set(isin, MAX_SATELLITE_WEIGHT);
    }
  }

  if (freed > 0) {
    const leads = [...capped.keys()].filter(
      (isin) => classes.get(isin) === "lead",
    );
    const receivers =
      leads.length > 0
        ? leads
        : [...capped.keys()].filter(
            (isin) => classes.get(isin) !== "satellite",
          );

    if (receivers.length > 0) {
      const each = freed / receivers.length;
      for (const isin of receivers) {
        capped.set(isin, (capped.get(isin) ?? 0) + each);
      }
    } else {
      // Every row is a capped satellite. Rather than invent a home for the
      // remainder, spread it evenly and accept that the caps were the
      // binding constraint — the alternative is a total below one.
      const each = freed / capped.size;
      for (const isin of capped.keys()) {
        capped.set(isin, (capped.get(isin) ?? 0) + each);
      }
    }
  }

  const leads = [...capped.keys()].filter(
    (isin) => classes.get(isin) === "lead",
  );
  if (leads.length > 0) {
    const leadWeight = leads.reduce(
      (sum, isin) => sum + (capped.get(isin) ?? 0),
      0,
    );
    if (leadWeight < MIN_LEAD_WEIGHT) {
      const shortfall = MIN_LEAD_WEIGHT - leadWeight;
      const others = [...capped.keys()].filter((isin) => !leads.includes(isin));
      const othersWeight = others.reduce(
        (sum, isin) => sum + (capped.get(isin) ?? 0),
        0,
      );

      if (othersWeight > 0) {
        // Taken proportionally, so the ordering among the non-leads survives.
        const scale = Math.max(0, (othersWeight - shortfall) / othersWeight);
        for (const isin of others) {
          capped.set(isin, (capped.get(isin) ?? 0) * scale);
        }
        for (const isin of leads) {
          capped.set(
            isin,
            (capped.get(isin) ?? 0) + shortfall / leads.length,
          );
        }
      }
    }
  }

  return normalise(capped);
}

/**
 * Weights for a set of assignments.
 *
 * Anything the catalogue does not know, or that was placed in a wrapper it
 * cannot sit in, is dropped with a reason rather than silently corrected —
 * a suggestion the app had to fix is a suggestion the reader should see was
 * wrong.
 */
export function buildTargetAllocation(
  assignments: RoleAssignment[],
): TargetAllocation {
  const dropped: TargetAllocation["dropped"] = [];
  const kept: { assignment: RoleAssignment; entry: ShortlistEntry }[] = [];
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const isin = assignment.isin.trim().toUpperCase();
    if (seen.has(isin)) {
      continue;
    }
    seen.add(isin);

    const entry = shortlistEntry(isin);
    if (entry === null) {
      dropped.push({ isin, reason: "not-catalogued" });
      continue;
    }
    if (!entry.wrappers.includes(assignment.wallet)) {
      dropped.push({ isin, reason: "wrong-wrapper" });
      continue;
    }
    if (assignment.weightClass === "exit") {
      dropped.push({ isin, reason: "exit" });
      continue;
    }
    kept.push({ assignment: { ...assignment, isin }, entry });
  }

  const units = new Map(
    kept.map(({ assignment }) => [
      assignment.isin,
      CLASS_UNITS[assignment.weightClass],
    ]),
  );
  const classes = new Map(
    kept.map(({ assignment }) => [assignment.isin, assignment.weightClass]),
  );

  let weights = applyConstraints(normalise(units), classes);

  // A line too small to be worth holding is dropped and its weight
  // redistributed, rather than shown as a trade nobody would place.
  const tooSmall = [...weights.entries()].filter(
    ([, weight]) => weight > 0 && weight < MIN_MEANINGFUL_WEIGHT,
  );
  if (tooSmall.length > 0 && tooSmall.length < weights.size) {
    for (const [isin] of tooSmall) {
      dropped.push({ isin, reason: "too-small" });
      weights.delete(isin);
    }
    weights = applyConstraints(normalise(weights), classes);
  }

  const rows: TargetRow[] = kept
    .filter(({ assignment }) => weights.has(assignment.isin))
    .map(({ assignment, entry }) => ({
      isin: assignment.isin,
      // Rendered from the catalogue, never from what the model wrote. A
      // transposed identifier reaching the screen as a fund name is the worst
      // thing this feature could produce.
      name: entry.name,
      symbol: entry.symbol,
      role: assignment.role,
      wallet: assignment.wallet,
      weightClass: assignment.weightClass,
      weight: weights.get(assignment.isin)!,
    }))
    .sort((left, right) => right.weight - left.weight);

  return {
    rows,
    coverage: rows.reduce((sum, row) => sum + row.weight, 0),
    dropped,
  };
}

const FAMILY_ROLES: Partial<Record<IndexFamily, SuggestionRole>> = {
  "world-developed": "core-world",
  "world-all-cap": "core-world",
  "us-large": "us-large",
  "us-tech": "us-large",
  "us-small": "small-cap",
  europe: "europe",
  emerging: "emerging",
  "bond-euro": "bond",
};

/**
 * A target the app can propose on its own.
 *
 * This is what the surface shows when there is no API key, when the allowance
 * is spent, and before anyone has ever pressed the button. It is deliberately
 * dull: a broad world fund leads, and anything already held that is not a
 * world fund becomes a satellite beside it.
 *
 * Dull is the point. The read's contribution is judgement about *this*
 * portfolio; the floor underneath it only has to be defensible.
 */
export function defaultAssignments(
  lookThrough: LookThrough,
  positions: { isin: string | null; walletId: InvestmentWalletId }[],
): RoleAssignment[] {
  const catalogued = positions
    .map((position) => ({
      position,
      entry: position.isin ? shortlistEntry(position.isin) : null,
    }))
    .filter(
      (row): row is { position: typeof row.position; entry: ShortlistEntry } =>
        row.entry !== null,
    );

  if (catalogued.length === 0) {
    return [];
  }

  const worldAt = catalogued.findIndex(
    ({ entry }) =>
      entry.indexFamily === "world-developed" ||
      entry.indexFamily === "world-all-cap",
  );

  // Whichever world fund is already held leads. If none is, the largest
  // holding leads rather than the app proposing something nobody owns.
  const leadIndex = worldAt >= 0 ? worldAt : 0;

  return catalogued.map(({ position, entry }, index) => ({
    isin: entry.isin,
    role: FAMILY_ROLES[entry.indexFamily] ?? "core-world",
    wallet: entry.wrappers.includes(position.walletId)
      ? position.walletId
      : entry.wrappers[0]!,
    weightClass:
      index === leadIndex
        ? "lead"
        : entry.indexFamily === "emerging" || entry.indexFamily === "europe"
          ? "support"
          : "satellite",
  }));
}

/**
 * What would have to move to reach the target.
 *
 * The moves sum to zero by construction — this is a rebalance, not a
 * contribution plan. `suggestContributionSplit` in `allocation.ts` is the
 * tool for new money, and is the better answer for a PEA holder, where
 * selling realises a tax event that redirecting next month's transfer does
 * not.
 */
export function buildArbitrage(
  target: TargetAllocation,
  positions: {
    isin: string | null;
    name: string;
    walletId: InvestmentWalletId;
    marketValue: number;
  }[],
  totalValue: number,
): ArbitrageMove[] {
  if (totalValue <= 0) {
    return [];
  }

  const heldByIsin = new Map<string, number>();
  for (const position of positions) {
    if (position.isin && position.marketValue > 0) {
      const isin = position.isin.trim().toUpperCase();
      heldByIsin.set(isin, (heldByIsin.get(isin) ?? 0) + position.marketValue);
    }
  }

  const moves: ArbitrageMove[] = [];

  for (const row of target.rows) {
    const currentValue = heldByIsin.get(row.isin) ?? 0;
    const targetValue = row.weight * totalValue;
    moves.push({
      isin: row.isin,
      name: row.name,
      wallet: row.wallet,
      currentValue,
      targetValue,
      delta: targetValue - currentValue,
    });
  }

  // Anything held that the target does not mention goes to zero. Saying so is
  // the whole point of a target — a plan that only ever adds is not a plan.
  const targeted = new Set(target.rows.map((row) => row.isin));
  for (const position of positions) {
    const isin = position.isin?.trim().toUpperCase() ?? null;
    if (position.marketValue <= 0) {
      continue;
    }
    if (isin !== null && targeted.has(isin)) {
      continue;
    }
    moves.push({
      isin,
      name: position.name,
      wallet: position.walletId,
      currentValue: position.marketValue,
      targetValue: 0,
      delta: -position.marketValue,
    });
  }

  return moves
    .filter((move) => Math.abs(move.delta) >= MIN_MEANINGFUL_MOVE)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}
