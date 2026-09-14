/**
 * The look-through, as a list of figures a read may cite.
 *
 * Same envelope as `month-facts.ts` and `bearing-facts.ts`, and deliberately
 * the same `MonthFact` type, so this pack reuses `factIds`, `findFact`,
 * `formatFact` and `factsDigest` rather than growing a parallel copy that
 * would drift. `FactPack` was widened for exactly this.
 *
 * ## Why a catalogue rather than a prompt full of numbers
 *
 * A model handed figures writes figures, and a figure a model wrote is a
 * figure nobody can trace. So it is handed ids: it writes
 * `{{fact:us-share}}` and the app substitutes what it computed. Two things
 * fall out of that — a claim can be checked against a closed list of ids, and
 * a stored read stays true when the portfolio's value moves under it,
 * because the sentence never contained the number in the first place.
 *
 * Absent figures are stated rather than zeroed. A portfolio whose instruments
 * have never been read is not a portfolio with no Japan in it, and the
 * `no-reading` reason exists so the prompt can say which of the two it is.
 */

import type { MissingFact, MonthFact } from "./month-facts";
import { INVESTMENT_WALLET_LABELS } from "./investments";
import { costOverYears } from "./fund-costs";
import { WORLD_EQUITY_REFERENCE, type LookThrough } from "./look-through";
import type { TargetAllocation } from "./look-through-target";

/** How many years the cost projection reaches. Matches `FundCostCard`. */
export const COST_HORIZON_YEARS = 10;

/** At most this many country rows reach the prompt. */
export const MAX_COUNTRY_FACTS = 5;

/** At most this many sector rows reach the prompt. */
export const MAX_SECTOR_FACTS = 4;

export interface LookThroughFacts {
  facts: MonthFact[];
  missing: MissingFact[];
  /**
   * True when there is not enough here to be worth reading out loud.
   *
   * Checked before anything is asked of a model, for the reason
   * `decideMonthReadWrite` checks its own: a confident verdict on a portfolio
   * the app cannot see is the worst output this feature could produce.
   */
  thin: boolean;
  /** Wrappers that hold something, for naming them in prose. */
  walletsInUse: string[];
}

function percent(value: number): number {
  return value * 100;
}

export function buildLookThroughFacts(
  lookThrough: LookThrough,
  target: TargetAllocation,
  walletsInUse: string[] = [],
): LookThroughFacts {
  const facts: MonthFact[] = [];
  const missing: MissingFact[] = [];

  facts.push({
    id: "invested-value",
    label: "Total invested value",
    unit: "money",
    value: lookThrough.totalValue,
    sense: "up-is-good",
  });

  facts.push({
    id: "position-count",
    label: "Positions held",
    unit: "count",
    value: lookThrough.positionCount,
    sense: "neutral",
  });

  /* ------------------------------------------------- what is and is not seen */

  if (lookThrough.unclassifiedValue > 0) {
    facts.push({
      id: "unclassified-share",
      label: "Share the app could not see through",
      unit: "percent",
      value: percent(
        lookThrough.totalValue > 0
          ? lookThrough.unclassifiedValue / lookThrough.totalValue
          : 0,
      ),
      sense: "up-is-bad",
      note: "held value whose instrument has not been read",
    });
    facts.push({
      id: "unclassified-value",
      label: "Value not yet read",
      unit: "money",
      value: lookThrough.unclassifiedValue,
      sense: "up-is-bad",
    });
  }

  if (lookThrough.unreadCount > 0) {
    missing.push({
      id: "unread-composition",
      label: "What some instruments hold",
      why: "no-reading",
    });
  }

  if (lookThrough.totalValue <= 0) {
    missing.push({
      id: "invested-value",
      label: "Invested value",
      why: "nothing-invested",
    });
  }

  /* ---------------------------------------------------------- where it sits */

  for (const row of lookThrough.countries.slice(0, MAX_COUNTRY_FACTS)) {
    facts.push({
      id: `country:${row.id}`,
      label: `${row.id} share`,
      unit: "percent",
      value: percent(row.weight),
      sense: "neutral",
      note: "of the value the app could see through",
    });
  }

  if (lookThrough.countries.length > 0) {
    facts.push({
      id: "us-share",
      label: "United States share",
      unit: "percent",
      value: percent(lookThrough.regions.unitedStates),
      sense: "neutral",
    });
    facts.push({
      id: "france-share",
      label: "France share",
      unit: "percent",
      value: percent(lookThrough.regions.france),
      sense: "neutral",
    });
    facts.push({
      id: "europe-share",
      label: "Europe share",
      unit: "percent",
      value: percent(lookThrough.regions.europe),
      sense: "neutral",
    });

    // The reference, so a share can be compared to something rather than
    // asserted to be high or low on the model's own authority.
    facts.push({
      id: "france-market-weight",
      label: "France's weight in world equity",
      unit: "percent",
      value: percent(WORLD_EQUITY_REFERENCE.france),
      sense: "neutral",
      note: "approximate, for comparison only",
    });
    facts.push({
      id: "us-market-weight",
      label: "The United States' weight in world equity",
      unit: "percent",
      value: percent(WORLD_EQUITY_REFERENCE.unitedStates),
      sense: "neutral",
      note: "approximate, for comparison only",
    });

    if (lookThrough.regionBias.france !== null) {
      facts.push({
        id: "france-bias",
        label: "France held, as a multiple of its market weight",
        unit: "count",
        value: lookThrough.regionBias.france,
        sense: "neutral",
        note: "1 means held in line with the market",
      });
    }
  } else {
    missing.push({
      id: "us-share",
      label: "Where the money sits by country",
      why: "no-reading",
    });
  }

  /* -------------------------------------------------------- what it is in */

  for (const row of lookThrough.sectors.slice(0, MAX_SECTOR_FACTS)) {
    facts.push({
      id: `sector:${row.id}`,
      label: `${row.label} share`,
      unit: "percent",
      value: percent(row.weight),
      sense: "neutral",
      note: "of the value the app could see through",
    });
  }

  if (lookThrough.sectors.length === 0) {
    missing.push({
      id: "top-sector",
      label: "Where the money sits by sector",
      why: "no-reading",
    });
  }

  /* ----------------------------------------------------------- what it costs */

  const charges = lookThrough.charges;

  if (charges.weightedAverage !== null) {
    facts.push({
      id: "weighted-ter",
      label: "Weighted ongoing charge",
      unit: "percent",
      value: percent(charges.weightedAverage),
      sense: "up-is-bad",
      note: "the funds' own charges, before any envelope fee",
    });
  } else {
    missing.push({
      id: "weighted-ter",
      label: "Weighted ongoing charge",
      why: "not-recorded",
    });
  }

  if (charges.weightedAllIn !== null) {
    facts.push({
      id: "weighted-all-in",
      label: "Weighted charge, all in",
      unit: "percent",
      value: percent(charges.weightedAllIn),
      sense: "up-is-bad",
      note: "the funds' charges plus the envelope's own fee",
    });
  }

  if (charges.envelopeAnnualCost > 0) {
    facts.push({
      id: "envelope-cost",
      label: "What the envelopes take a year",
      unit: "money",
      value: charges.envelopeAnnualCost,
      sense: "up-is-bad",
    });
  }

  facts.push({
    id: "annual-cost",
    label: "What holding it all costs a year",
    unit: "money",
    value: charges.allInAnnualCost,
    sense: "up-is-bad",
  });

  facts.push({
    id: "cost-over-horizon",
    label: `What that comes to over ${COST_HORIZON_YEARS} years`,
    unit: "money",
    value: costOverYears(charges.allInAnnualCost, COST_HORIZON_YEARS),
    sense: "up-is-bad",
    note: "at today's balance, with no growth assumed",
  });

  if (charges.uncoveredValue > 0) {
    facts.push({
      id: "uncovered-value",
      label: "Value with no charge on record",
      unit: "money",
      value: charges.uncoveredValue,
      sense: "up-is-bad",
    });
  }

  /* ------------------------------------------------------------- doubling up */

  facts.push({
    id: "index-collisions",
    label: "Pairs of holdings tracking the same or a nested index",
    unit: "count",
    value: lookThrough.indexCollisions.length,
    sense: "up-is-bad",
  });

  const worstCollision = lookThrough.indexCollisions[0];
  if (worstCollision) {
    facts.push({
      id: "collision-weight",
      label: "Share of value in the most overlapping pair",
      unit: "percent",
      value: percent(worstCollision.combinedWeight),
      sense: "up-is-bad",
    });
  }

  const worstOverlap = lookThrough.constituentOverlaps[0];
  if (worstOverlap) {
    facts.push({
      id: "overlap-floor",
      label: "Shared companies in the closest pair, at least",
      unit: "percent",
      value: percent(worstOverlap.floor),
      sense: "up-is-bad",
      // The limit travels with the figure. Everything downstream that shows
      // this number shows this clause, because the number on its own invites
      // exactly the wrong reading.
      note:
        "a floor, not a measurement: only published top holdings were " +
        "compared, so the true overlap is higher and may be far higher",
    });
    facts.push({
      id: "overlap-names",
      label: "How many companies the closest pair share",
      unit: "count",
      value: worstOverlap.sharedNames.length,
      sense: "up-is-bad",
    });
  }

  /* ------------------------------------------------------------ the wrappers */

  if (lookThrough.eligibility.length > 0) {
    facts.push({
      id: "wrapper-issues",
      label: "Holdings sitting where they may not",
      unit: "count",
      value: lookThrough.eligibility.length,
      sense: "up-is-bad",
    });
  }

  /* -------------------------------------------------------------- the target */

  for (const row of target.rows) {
    facts.push({
      // The app's arithmetic, offered as a datum so the prose can cite a
      // target weight instead of the model inventing one.
      id: `target:${row.isin}`,
      label: `Target weight for ${row.name}`,
      unit: "percent",
      value: percent(row.weight),
      sense: "neutral",
    });
  }

  if (target.rows.length === 0) {
    missing.push({
      id: "target-allocation",
      label: "A target allocation",
      why: "no-target",
    });
  }

  return {
    facts,
    missing,
    thin:
      lookThrough.totalValue <= 0 ||
      lookThrough.classifiedValue <= 0 ||
      facts.length < 4,
    walletsInUse: walletsInUse.map(
      (wallet) =>
        INVESTMENT_WALLET_LABELS[
          wallet as keyof typeof INVESTMENT_WALLET_LABELS
        ] ?? wallet,
    ),
  };
}
