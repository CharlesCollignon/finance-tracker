/**
 * The instruments the app is willing to name.
 *
 * A look-through that only describes gaps is not much use — "you are thin on
 * emerging markets" leaves the reader exactly where they started. Naming a
 * fund is the useful part, and it is also the dangerous part: a transposed
 * character in an ISIN is a wrong instrument, not a typo, and it would reach
 * the screen looking like a fact.
 *
 * So the names live here, in git, rather than being produced at runtime.
 * Three things follow from that:
 *
 *   - A model cannot invent one. `verifyWalletRead` treats an ISIN outside
 *     this catalogue the way `verifyMonthRead` treats a reference to a datum
 *     that was never sent: fatal, not skipped. A closed vocabulary handed
 *     over in full is the only kind that can be checked.
 *   - Nothing can poison it. There is no table to write to, no policy to get
 *     wrong, and a change shows up in a diff with a person's name on it.
 *   - It costs nothing to read, on either app. `packages/core` is consumed as
 *     source by the phone, so this ships with the bundle.
 *
 * The same reasoning that put `bank-mcc.ts` and `BEARING_TILES` in TypeScript
 * rather than in Postgres.
 *
 * ## What is here, and what is deliberately not
 *
 * Only what does not move: the identifier, the issuer's name, the index it
 * tracks, where it is domiciled, how it replicates, and which wrappers it may
 * sit in. Those are properties of the fund's constitution and they change
 * approximately never.
 *
 * Ongoing charges, country weights, sector weights and constituents are *not*
 * facts of that kind — they drift, and a figure hardcoded in a source file is
 * a figure that is quietly wrong a year later. Those come from an instrument
 * reading, refreshed against the market. What is here is `terHint`: a dated
 * starting point so the surface says something sensible before any reading
 * exists, marked clearly enough that nobody mistakes it for current.
 *
 * ## On adding one
 *
 * Check the ISIN against the issuer's own page, not a comparison site, and
 * put the date in `hintedAt`. An entry with a plausible-looking wrong ISIN is
 * worse than no entry.
 */

import { ISIN_REGEX } from "./market/yahoo";
import type { WalletId } from "./types/database";

/** How a fund gets its exposure. This decides PEA eligibility — see below. */
export type Replication = "physical" | "synthetic";

/** What the fund does with the income it receives. */
export type Distribution = "accumulating" | "distributing";

export type AssetClass = "equity" | "bond" | "commodity" | "mixed";

/**
 * The index a fund tracks, and the family it belongs to.
 *
 * The family is what answers "are these two funds diversifying each other?".
 * Two funds tracking nested indices — the S&P 500 sits inside MSCI World,
 * the Nasdaq-100 sits inside both — overlap heavily no matter what their
 * constituent lists say, and saying so needs no constituent data at all.
 * That makes it the most reliable overlap signal the app has.
 */
export type IndexFamily =
  | "world-developed"
  | "world-all-cap"
  | "us-large"
  | "us-tech"
  | "us-small"
  | "europe"
  | "emerging"
  | "bond-euro";

/**
 * Which families sit inside which.
 *
 * Read as: holding the key alongside any of its values is doubling up rather
 * than diversifying. Not symmetric on purpose — MSCI World contains the
 * S&P 500, and the interesting sentence is the one about the broader fund.
 */
export const INDEX_FAMILY_CONTAINS: Record<IndexFamily, IndexFamily[]> = {
  "world-all-cap": [
    "world-developed",
    "us-large",
    "us-tech",
    "us-small",
    "europe",
    "emerging",
  ],
  "world-developed": ["us-large", "us-tech", "us-small", "europe"],
  "us-large": ["us-tech"],
  "us-tech": [],
  "us-small": [],
  europe: [],
  emerging: [],
  "bond-euro": [],
};

/**
 * What this app knows about an instrument without having read the market.
 *
 * `terHint` is the one soft field: a charge as a fraction (0.002 = 0.20%) and
 * the date it was checked. Treat it as a placeholder, never as the answer —
 * `lib/look-through` prefers a reading's figure whenever one exists.
 */
export interface ShortlistEntry {
  isin: string;
  /** The Euronext Paris ticker where there is one — what a broker shows. */
  symbol: string;
  name: string;
  assetClass: AssetClass;
  index: string;
  indexFamily: IndexFamily;
  /** ISO 3166-1 alpha-2 of the fund's domicile, not of what it holds. */
  domicile: string;
  ucits: boolean;
  replication: Replication;
  distribution: Distribution;
  /** The wrappers this fund may be held in. */
  wrappers: WalletId[];
  terHint: { charge: number; hintedAt: string } | null;
}

/**
 * Checked against the issuer's page on the date in `hintedAt`.
 *
 * Note the two MSCI World funds that look like a contradiction: `WPEA` is
 * Irish and PEA-eligible, while `IE00B4L5Y983` is also Irish and is not.
 * Domicile is not what decides it. A PEA may only hold funds that are at
 * least three-quarters European equity, so a fund tracking a world or US
 * index qualifies only by holding European shares and swapping their return
 * for the index's — which is what `synthetic` means here, and why that field
 * is load-bearing rather than decoration. A physically-replicated world
 * tracker holds American shares and cannot go in a PEA at any price.
 */
const ENTRIES: ShortlistEntry[] = [
  {
    isin: "FR001400U5Q4",
    symbol: "DCAM",
    name: "Amundi PEA Monde (MSCI World)",
    assetClass: "equity",
    index: "MSCI World",
    indexFamily: "world-developed",
    domicile: "FR",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.002, hintedAt: "2026-09-14" },
  },
  {
    isin: "IE0002XZSHO1",
    symbol: "WPEA",
    name: "iShares MSCI World Swap PEA",
    assetClass: "equity",
    index: "MSCI World",
    indexFamily: "world-developed",
    domicile: "IE",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.002, hintedAt: "2026-09-14" },
  },
  {
    isin: "LU1681043599",
    symbol: "CW8",
    name: "Amundi MSCI World",
    assetClass: "equity",
    index: "MSCI World",
    indexFamily: "world-developed",
    domicile: "LU",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.0038, hintedAt: "2026-09-14" },
  },
  {
    isin: "FR0013412285",
    symbol: "PE500",
    name: "Amundi PEA S&P 500",
    assetClass: "equity",
    index: "S&P 500",
    indexFamily: "us-large",
    domicile: "FR",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.0015, hintedAt: "2026-09-14" },
  },
  {
    isin: "FR0013412020",
    symbol: "PAEEM",
    name: "Amundi PEA MSCI Emerging Markets",
    assetClass: "equity",
    index: "MSCI Emerging Markets",
    indexFamily: "emerging",
    domicile: "FR",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.003, hintedAt: "2026-09-14" },
  },
  {
    isin: "FR0011550193",
    symbol: "ETZ",
    name: "BNP Paribas Easy STOXX Europe 600",
    assetClass: "equity",
    index: "STOXX Europe 600",
    indexFamily: "europe",
    domicile: "FR",
    ucits: true,
    replication: "physical",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.0019, hintedAt: "2026-09-14" },
  },
  {
    isin: "LU1681038672",
    symbol: "RS2K",
    name: "Amundi Russell 2000",
    assetClass: "equity",
    index: "Russell 2000",
    indexFamily: "us-small",
    domicile: "LU",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    terHint: { charge: 0.0035, hintedAt: "2026-09-14" },
  },
  {
    isin: "LU1681038243",
    symbol: "ANX",
    name: "Amundi Nasdaq-100",
    assetClass: "equity",
    index: "Nasdaq-100",
    indexFamily: "us-tech",
    domicile: "LU",
    ucits: true,
    replication: "synthetic",
    distribution: "accumulating",
    wrappers: ["pea", "cto", "av", "per"],
    // Left null rather than guessed: the ISIN was confirmed, the charge was
    // not. A reading will fill it, and null renders as "not known yet".
    terHint: null,
  },
  {
    isin: "IE00B4L5Y983",
    symbol: "SWDA",
    name: "iShares Core MSCI World",
    assetClass: "equity",
    index: "MSCI World",
    indexFamily: "world-developed",
    domicile: "IE",
    ucits: true,
    // Physical, so it holds American shares — and therefore cannot sit in a
    // PEA however cheap it is. This is the entry that makes the rule visible.
    replication: "physical",
    distribution: "accumulating",
    wrappers: ["cto", "av", "per"],
    terHint: { charge: 0.002, hintedAt: "2026-09-14" },
  },
  {
    isin: "IE00BK5BQT80",
    symbol: "VWRP",
    name: "Vanguard FTSE All-World",
    assetClass: "equity",
    index: "FTSE All-World",
    indexFamily: "world-all-cap",
    domicile: "IE",
    ucits: true,
    replication: "physical",
    distribution: "accumulating",
    wrappers: ["cto", "av", "per"],
    terHint: { charge: 0.0019, hintedAt: "2026-09-14" },
  },
];

export const ETF_SHORTLIST: Record<string, ShortlistEntry> = Object.freeze(
  Object.fromEntries(ENTRIES.map((entry) => [entry.isin, entry])),
);

export const SHORTLIST_ISINS: string[] = ENTRIES.map((entry) => entry.isin);

/** The catalogue entry, or null for an ISIN this app has never heard of. */
export function shortlistEntry(isin: string): ShortlistEntry | null {
  return ETF_SHORTLIST[isin.trim().toUpperCase()] ?? null;
}

/** Everything holdable in one wrapper, cheapest hinted charge first. */
export function shortlistForWrapper(wallet: WalletId): ShortlistEntry[] {
  return ENTRIES.filter((entry) => entry.wrappers.includes(wallet)).sort(
    (left, right) =>
      (left.terHint?.charge ?? Number.POSITIVE_INFINITY) -
      (right.terHint?.charge ?? Number.POSITIVE_INFINITY),
  );
}

/**
 * Whether holding both of these is doubling up rather than diversifying.
 *
 * True when they track the same index, or when one family contains the other.
 * This is the overlap signal to lead with: it needs no constituent weights,
 * it does not drift between factsheet revisions, and it is essentially never
 * wrong — whereas an intersection of published top-ten holdings badly
 * understates two funds that really are the same bet.
 */
export function indexesOverlap(
  left: ShortlistEntry,
  right: ShortlistEntry,
): boolean {
  if (left.isin === right.isin) {
    return false;
  }
  if (left.indexFamily === right.indexFamily) {
    return true;
  }
  return (
    INDEX_FAMILY_CONTAINS[left.indexFamily].includes(right.indexFamily) ||
    INDEX_FAMILY_CONTAINS[right.indexFamily].includes(left.indexFamily)
  );
}

/** Whether a string is shaped like an ISIN. Shape only, not a check digit. */
export function looksLikeIsin(value: string): boolean {
  return ISIN_REGEX.test(value.trim().toUpperCase());
}
