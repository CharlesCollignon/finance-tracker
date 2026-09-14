/**
 * What the wallets are actually made of.
 *
 * A wallet says where invested value sits; a position says what was bought.
 * Neither says what is owned. Two funds can be most of the same twelve
 * American companies and appear as two independent lines, and a portfolio can
 * be five-sixths United States while reading as diversified because it spans
 * three wrappers. Resolving each position through to its constituents is the
 * only way the app can say otherwise.
 *
 * Everything here is arithmetic. No judgement, no thresholds that mean
 * "good", nothing that needs a model — the read that gets written on top of
 * this consumes these figures, and the figures exist whether or not anyone
 * ever asks for a read. That order matters: it is what lets the surface work
 * with no API key at all.
 *
 * ## The two honesty rules
 *
 * Weights are computed over *classified* value only, and the unclassified
 * share is reported beside them. A portfolio where two-fifths of the money
 * sits in instruments nobody has read is not a portfolio that is 0% Japan —
 * it is a portfolio the app cannot see, and saying so is the answer.
 *
 * Constituent overlap is reported as a floor and labelled as one. Published
 * top-ten holdings cannot see a true overlap: a world tracker and an S&P 500
 * tracker are roughly seventy per cent the same bet, and intersecting their
 * top tens scores about twenty. So the leading signal is the index
 * relationship, which needs no weights and is essentially never wrong, and
 * the constituent figure follows it as a footnote rather than a headline.
 */

import { shortlistEntry, indexesOverlap, type AssetClass } from "./etf-shortlist";
import { buildFundCosts, type FundCostSummary, type WrapperFees } from "./fund-costs";
import type { InvestmentWalletId } from "./investments";
import {
  SECTOR_LABELS,
  readingIsStale,
  type InstrumentReading,
  type SectorId,
} from "./instrument-reading";

/**
 * Roughly what each region is worth, as a share of world equity.
 *
 * A reference, not a target. "Over-exposed to your own country" is only a
 * sentence worth writing if there is something to be over-exposed relative
 * to, and the honest comparator is what the market itself weighs — a French
 * saver holding thirty per cent France against a market that weighs it near
 * three is making a choice, whether or not they know it.
 *
 * Approximate and dated on purpose. These move slowly, by a point or two a
 * year, and the claims drawn from them are about factors of ten rather than
 * decimal places. Anything that needs precision should not be using this.
 */
export const WORLD_EQUITY_REFERENCE = {
  hintedAt: "2026-09-14",
  france: 0.03,
  eurozone: 0.09,
  europe: 0.15,
  unitedStates: 0.64,
} as const;

/**
 * Below this, an axis is too incomplete to read as a breakdown.
 *
 * Not a hard cutoff — the rows are still shown, because "25% technology, of
 * the 37% that could be read" is useful and nothing is not. It decides when
 * the surface says out loud that the figures are partial.
 */
export const AXIS_COVERAGE_FLOOR = 0.8;

const EUROZONE = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
]);

const EUROPE_NON_EUROZONE = new Set([
  "BG", "CH", "CZ", "DK", "GB", "HU", "IS", "LI", "NO", "PL",
  "RO", "SE", "UA",
]);

/**
 * One row of a weighting, in both shares and euros.
 *
 * `weight` is a share of the classified value as *reported*, and the rows on
 * an axis therefore need not add up to one. That is deliberate, and it is the
 * second version of this decision.
 *
 * The first normalised each fund's weights to one before scaling them, on the
 * reasoning that a factsheet listing its top eight countries is describing
 * where the fund is rather than where four-fifths of it is. That reasoning
 * holds when a list is nearly complete and fails badly when it is not: a real
 * reading came back with three of the eleven sectors, covering 37% of the
 * fund, and normalising turned a fund that is 25% technology into one
 * reported as 69% technology. Which is not a rounding error — it is the
 * headline finding of the whole surface, wrong by a factor of nearly three,
 * and stated with total confidence.
 *
 * So nothing is normalised. A share is what was published, the coverage of
 * each axis is carried beside it, and an axis that is mostly unreported says
 * so. Understating a concentration is a worse failure than admitting the
 * figures are partial, but inventing one is worse than both.
 */
export interface WeightRow {
  id: string;
  label: string;
  /** Share of classified value, as reported. Rows need not sum to one. */
  weight: number;
  value: number;
}

/** A position resolved as far as the app can resolve it. */
export interface LookThroughPosition {
  positionId: string;
  name: string;
  walletId: InvestmentWalletId;
  isin: string | null;
  marketValue: number;
  /** The charge recorded on the position. Outranks a reading's. */
  ongoingCharge: number | null;
}

export interface LookThroughInput {
  positions: LookThroughPosition[];
  readings: Map<string, InstrumentReading>;
  envelopeFees?: WrapperFees;
  now: Date;
}

/** Two positions tracking the same or nested indices. */
export interface IndexCollision {
  positionIds: [string, string];
  names: [string, string];
  indexes: [string, string];
  /** Their combined share of classified value. */
  combinedWeight: number;
  /** True when both track the very same index. */
  identical: boolean;
}

/**
 * Two positions whose published constituents intersect.
 *
 * `floor` is the sum of the smaller weight of each shared name — a genuine
 * lower bound on how much of the two funds is the same companies, and
 * nothing more than that. `coverage` says how much of each fund the compared
 * lists reached, which is what tells a reader how loose the floor is.
 */
export interface ConstituentOverlap {
  positionIds: [string, string];
  names: [string, string];
  floor: number;
  sharedNames: string[];
  comparedCount: [number, number];
  coverage: [number, number];
}

/** A position held somewhere its instrument may not legally sit. */
export interface EligibilityIssue {
  positionId: string;
  name: string;
  walletId: InvestmentWalletId;
  isin: string;
  /** Where it could be held instead. */
  allowedIn: InvestmentWalletId[];
}

/** Something the reader must know to read the rest correctly. */
export type LookThroughCaveat =
  | { kind: "unclassified"; share: number; positionCount: number }
  | { kind: "overlap-is-a-floor" }
  | { kind: "stale-readings"; positionCount: number; oldestDays: number }
  | { kind: "no-market-value" }
  | { kind: "geography-is-not-currency" }
  | { kind: "partial-axis"; axis: "country" | "sector"; coverage: number };

export interface LookThrough {
  /** Market value the app could resolve through to constituents. */
  classifiedValue: number;
  /** Market value with no usable reading behind it. */
  unclassifiedValue: number;
  totalValue: number;
  /** Share of value the weights below are computed over, 0–1. */
  classifiedShare: number;
  /** Positions worth something. A position worth nothing is not held. */
  positionCount: number;
  /** Of those, how many resolved through to a composition. */
  classifiedPositionCount: number;
  unclassifiedPositions: { positionId: string; name: string; value: number }[];

  countries: WeightRow[];
  sectors: WeightRow[];
  assetClasses: WeightRow[];

  /**
   * How much of the classified value each axis accounts for, 0–1.
   *
   * Below `AXIS_COVERAGE_FLOOR` the axis is reported with a caveat rather
   * than silently presented as complete.
   */
  countryCoverage: number;
  sectorCoverage: number;

  /** Regional shares of classified value, against the market reference. */
  regions: {
    france: number;
    eurozone: number;
    europe: number;
    unitedStates: number;
  };
  /**
   * How many times the market's own weight each region is held at.
   *
   * Null when the reference weight is zero or nothing is classified. A value
   * of 10 means ten times the market's weight, which is the shape of claim
   * this data can actually support.
   */
  regionBias: {
    france: number | null;
    europe: number | null;
    unitedStates: number | null;
  };

  charges: FundCostSummary;
  indexCollisions: IndexCollision[];
  constituentOverlaps: ConstituentOverlap[];
  eligibility: EligibilityIssue[];
  caveats: LookThroughCaveat[];

  /** Positions whose reading is older than the app treats as current. */
  staleReadingCount: number;
  /** Positions with an ISIN but no reading at all. */
  unreadCount: number;
  /** Positions with no ISIN, so nothing can be read. */
  unidentifiedCount: number;
}

const COMPANY_SUFFIXES = [
  "incorporated", "inc", "corporation", "corp", "company", "co",
  "limited", "ltd", "plc", "nv", "sa", "se", "ag", "spa", "as",
  "holdings", "holding", "group", "the",
];

/**
 * Two constituent names reduced to the same key when they are the same
 * company.
 *
 * Factsheets disagree about the same holding constantly — "Apple Inc.",
 * "APPLE INC", "Apple" — and an intersection that treats those as three
 * companies finds no overlap anywhere, which is a silent and total failure
 * rather than a visible one. Deliberately conservative: it strips
 * punctuation, case, share-class markers and the common corporate suffixes,
 * and stops there. Nothing here tries to know that Alphabet and Google are
 * the same issuer; that belongs in data, not in a regex.
 */
export function constituentKey(name: string): string {
  const cleaned = name
    // Accents folded rather than stripped. This is a French app reading
    // European factsheets: "Nestlé" and "Nestle" are one company, and
    // dropping the accented letter instead of folding it turns the first
    // into "nestl" and loses the match.
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Periods and apostrophes are deleted, not spaced: "S.A." has to become
    // one token to be recognised as a suffix, and spacing it gives "s a",
    // which matches nothing. Same for "L'Oreal".
    .replace(/[.'’]/g, "")
    .replace(/[,"()&/]/g, " ")
    .replace(/\bclass\s+[a-z]\b/g, " ")
    .replace(/\breg(istered)?\s+s(hs|hares)?\b/g, " ")
    .replace(/\b(shs|shares)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  while (
    cleaned.length > 1 &&
    COMPANY_SUFFIXES.includes(cleaned[cleaned.length - 1]!)
  ) {
    cleaned.pop();
  }

  return cleaned.filter((word) => word !== "the").join(" ");
}

function weightRows(
  weights: Map<string, number>,
  classifiedValue: number,
  label: (id: string) => string,
): WeightRow[] {
  return [...weights.entries()]
    .map(([id, value]) => ({
      id,
      label: label(id),
      value,
      weight: classifiedValue > 0 ? value / classifiedValue : 0,
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
}

function add(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function ratio(held: number, reference: number): number | null {
  if (reference <= 0 || held <= 0) {
    return held <= 0 ? 0 : null;
  }
  return held / reference;
}

/**
 * A reading is usable for weighting only if it says where the money is.
 *
 * A reading that found a charge but no countries still improves the fee
 * figures, so it is not discarded — it just cannot contribute to a
 * geography, which is why classification is decided per-question rather than
 * once per position.
 */
function classifies(reading: InstrumentReading | undefined): boolean {
  return (
    reading !== undefined &&
    (Object.keys(reading.countryWeights).length > 0 ||
      Object.keys(reading.sectorWeights).length > 0)
  );
}

export function buildLookThrough(input: LookThroughInput): LookThrough {
  const { positions, readings, now } = input;
  const held = positions.filter((position) => position.marketValue > 0);

  const totalValue = held.reduce(
    (sum, position) => sum + position.marketValue,
    0,
  );

  const classified = held.filter((position) =>
    classifies(position.isin ? readings.get(position.isin) : undefined),
  );
  const unclassified = held.filter(
    (position) => !classified.includes(position),
  );

  const classifiedValue = classified.reduce(
    (sum, position) => sum + position.marketValue,
    0,
  );
  const unclassifiedValue = totalValue - classifiedValue;

  const countries = new Map<string, number>();
  const sectors = new Map<string, number>();
  const assetClasses = new Map<string, number>();

  // How much of the classified value each axis actually accounts for.
  // Carried rather than normalised away — see the note above `WeightRow`.
  let countryReported = 0;
  let sectorReported = 0;

  for (const position of classified) {
    const reading = readings.get(position.isin!)!;
    const value = position.marketValue;

    const countryTotal = Object.values(reading.countryWeights).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    for (const [code, weight] of Object.entries(reading.countryWeights)) {
      add(countries, code, weight * value);
    }
    countryReported += Math.min(1, countryTotal) * value;

    const sectorTotal = Object.values(reading.sectorWeights).reduce(
      (sum, weight) => sum + (weight ?? 0),
      0,
    );
    for (const [sector, weight] of Object.entries(reading.sectorWeights)) {
      add(sectors, sector, (weight ?? 0) * value);
    }
    sectorReported += Math.min(1, sectorTotal) * value;

    const entry = position.isin ? shortlistEntry(position.isin) : null;
    add(assetClasses, entry?.assetClass ?? "unknown", value);
  }

  const countryRows = weightRows(countries, classifiedValue, (id) => id);
  const sectorRows = weightRows(
    sectors,
    classifiedValue,
    (id) => SECTOR_LABELS[id as SectorId] ?? id,
  );
  const assetClassRows = weightRows(
    assetClasses,
    classifiedValue,
    (id) => id as AssetClass | "unknown",
  );

  const shareOf = (predicate: (code: string) => boolean): number => {
    if (classifiedValue <= 0) {
      return 0;
    }
    let sum = 0;
    for (const [code, value] of countries.entries()) {
      if (predicate(code)) {
        sum += value;
      }
    }
    return sum / classifiedValue;
  };

  const regions = {
    france: shareOf((code) => code === "FR"),
    eurozone: shareOf((code) => EUROZONE.has(code)),
    europe: shareOf((code) => EUROZONE.has(code) || EUROPE_NON_EUROZONE.has(code)),
    unitedStates: shareOf((code) => code === "US"),
  };

  const regionBias = {
    france: ratio(regions.france, WORLD_EQUITY_REFERENCE.france),
    europe: ratio(regions.europe, WORLD_EQUITY_REFERENCE.europe),
    unitedStates: ratio(
      regions.unitedStates,
      WORLD_EQUITY_REFERENCE.unitedStates,
    ),
  };

  // The charge someone typed beats the one a reading found.
  //
  // This was the other way round at first, on the reasoning that a reading is
  // newer and came from the fund's own page. But a figure a person read off a
  // KID and typed in is better evidence than one a web search inferred, and
  // silently overriding deliberate input is the same mistake as reading a
  // typed 0 as "worth nothing". A reading fills the gaps; it does not correct
  // the owner.
  const charges = buildFundCosts(
    held.map((position) => {
      const reading = position.isin ? readings.get(position.isin) : undefined;
      const hinted = position.isin
        ? shortlistEntry(position.isin)?.terHint?.charge ?? null
        : null;
      return {
        positionId: position.positionId,
        name: position.name,
        walletId: position.walletId,
        marketValue: position.marketValue,
        ongoingCharge:
          position.ongoingCharge ?? reading?.ongoingCharge ?? hinted,
      };
    }),
    input.envelopeFees ?? {},
  );

  const indexCollisions: IndexCollision[] = [];
  const constituentOverlaps: ConstituentOverlap[] = [];

  for (let i = 0; i < held.length; i += 1) {
    for (let j = i + 1; j < held.length; j += 1) {
      const left = held[i]!;
      const right = held[j]!;
      if (!left.isin || !right.isin) {
        continue;
      }

      const leftEntry = shortlistEntry(left.isin);
      const rightEntry = shortlistEntry(right.isin);

      if (leftEntry && rightEntry && indexesOverlap(leftEntry, rightEntry)) {
        indexCollisions.push({
          positionIds: [left.positionId, right.positionId],
          names: [left.name, right.name],
          indexes: [leftEntry.index, rightEntry.index],
          combinedWeight:
            classifiedValue > 0
              ? (left.marketValue + right.marketValue) / classifiedValue
              : 0,
          identical: leftEntry.index === rightEntry.index,
        });
      }

      const leftReading = readings.get(left.isin);
      const rightReading = readings.get(right.isin);
      if (
        !leftReading?.topConstituents.length ||
        !rightReading?.topConstituents.length
      ) {
        continue;
      }

      const rightByKey = new Map(
        rightReading.topConstituents.map((entry) => [
          constituentKey(entry.name),
          entry,
        ]),
      );

      let floor = 0;
      const sharedNames: string[] = [];
      for (const entry of leftReading.topConstituents) {
        const match = rightByKey.get(constituentKey(entry.name));
        if (match) {
          floor += Math.min(entry.weight, match.weight);
          sharedNames.push(entry.name);
        }
      }

      if (sharedNames.length > 0) {
        constituentOverlaps.push({
          positionIds: [left.positionId, right.positionId],
          names: [left.name, right.name],
          floor,
          sharedNames,
          comparedCount: [
            leftReading.topConstituents.length,
            rightReading.topConstituents.length,
          ],
          coverage: [
            leftReading.constituentsCoverage,
            rightReading.constituentsCoverage,
          ],
        });
      }
    }
  }

  indexCollisions.sort(
    (left, right) => right.combinedWeight - left.combinedWeight,
  );
  constituentOverlaps.sort((left, right) => right.floor - left.floor);

  const eligibility: EligibilityIssue[] = [];
  for (const position of held) {
    if (!position.isin) {
      continue;
    }
    const entry = shortlistEntry(position.isin);
    if (entry && !entry.wrappers.includes(position.walletId)) {
      eligibility.push({
        positionId: position.positionId,
        name: position.name,
        walletId: position.walletId,
        isin: position.isin,
        allowedIn: entry.wrappers,
      });
    }
  }

  const withIsin = held.filter((position) => position.isin !== null);
  const staleReadings = withIsin.filter((position) => {
    const reading = readings.get(position.isin!);
    return reading !== undefined && readingIsStale(reading, now);
  });
  const unread = withIsin.filter(
    (position) => readings.get(position.isin!) === undefined,
  );

  const caveats: LookThroughCaveat[] = [];
  if (totalValue <= 0) {
    caveats.push({ kind: "no-market-value" });
  }
  if (unclassifiedValue > 0 && totalValue > 0) {
    caveats.push({
      kind: "unclassified",
      share: unclassifiedValue / totalValue,
      positionCount: unclassified.length,
    });
  }
  if (constituentOverlaps.length > 0) {
    caveats.push({ kind: "overlap-is-a-floor" });
  }
  if (staleReadings.length > 0) {
    caveats.push({
      kind: "stale-readings",
      positionCount: staleReadings.length,
      oldestDays: Math.max(
        ...staleReadings.map((position) => {
          const reading = readings.get(position.isin!)!;
          const taken = new Date(reading.sourcedAt).getTime();
          return Number.isFinite(taken)
            ? Math.floor((now.getTime() - taken) / 86_400_000)
            : 0;
        }),
      ),
    });
  }
  // An axis that is mostly unreported is still shown, but never as though it
  // were the whole picture.
  const countryCoverage =
    classifiedValue > 0 ? countryReported / classifiedValue : 0;
  const sectorCoverage =
    classifiedValue > 0 ? sectorReported / classifiedValue : 0;

  if (countryRows.length > 0 && countryCoverage < AXIS_COVERAGE_FLOOR) {
    caveats.push({
      kind: "partial-axis",
      axis: "country",
      coverage: countryCoverage,
    });
  }
  if (sectorRows.length > 0 && sectorCoverage < AXIS_COVERAGE_FLOOR) {
    caveats.push({
      kind: "partial-axis",
      axis: "sector",
      coverage: sectorCoverage,
    });
  }

  // Stated whenever a geography is shown at all: the app knows where the
  // companies are, not what currency anyone is paid in, and a reader — or a
  // model — will otherwise volunteer the second from the first.
  if (countryRows.length > 0) {
    caveats.push({ kind: "geography-is-not-currency" });
  }

  return {
    classifiedValue,
    unclassifiedValue,
    totalValue,
    classifiedShare: totalValue > 0 ? classifiedValue / totalValue : 0,
    positionCount: held.length,
    classifiedPositionCount: classified.length,
    unclassifiedPositions: unclassified.map((position) => ({
      positionId: position.positionId,
      name: position.name,
      value: position.marketValue,
    })),
    countries: countryRows,
    sectors: sectorRows,
    assetClasses: assetClassRows,
    countryCoverage: classifiedValue > 0 ? countryReported / classifiedValue : 0,
    sectorCoverage: classifiedValue > 0 ? sectorReported / classifiedValue : 0,
    regions,
    regionBias,
    charges,
    indexCollisions,
    constituentOverlaps,
    eligibility,
    caveats,
    staleReadingCount: staleReadings.length,
    unreadCount: unread.length,
    unidentifiedCount: held.length - withIsin.length,
  };
}

/**
 * Whether there is enough here to be worth reading out loud.
 *
 * The equivalent of `month-read`'s thin check, and it exists for the same
 * reason: a confident verdict on a portfolio the app cannot see is the worst
 * output this feature could produce. One position is not a diversification
 * question, and nothing classified means every number below would be zero.
 */
export function lookThroughIsThin(lookThrough: LookThrough): boolean {
  return (
    lookThrough.totalValue <= 0 ||
    lookThrough.classifiedValue <= 0 ||
    lookThrough.countries.length + lookThrough.sectors.length === 0
  );
}
