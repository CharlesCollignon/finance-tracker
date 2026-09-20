import { describe, expect, it } from "vitest";

import { BEARING_TILE_IDS, type TileId } from "./bearing-tiles";
import {
  CARD_ORDER,
  CARD_FAMILY_BLOCKS,
  buildBearingCards,
  type BearingCard,
} from "./bearing-cards";
import {
  buildBearingFacts,
  type BearingFact,
  type BearingFacts,
} from "./bearing-facts";
import { buildBearing } from "./bearing";
import { buildMonthPulse } from "./month-pulse";
import type { CloseHistorySummary } from "./month-close";
import type { MonthComparison } from "./month-comparison";
import type { ForwardProjection, Runway } from "./projection";
import type { MonthlySummary } from "./types/database";

const euro = (n: number) => `${n.toFixed(2)} €`;

function fact(
  id: TileId,
  family: BearingFact["family"],
  value = 100,
): BearingFact {
  return {
    id,
    family,
    label: id,
    unit: "money",
    value,
    sense: "up-is-good",
  };
}

function pack(facts: BearingFact[]): BearingFacts {
  return { asOf: "2026-09-20", facts, missing: [], thin: false };
}

describe("CARD_ORDER", () => {
  it("is the five families, headline families first", () => {
    expect(CARD_ORDER).toEqual(["month", "now", "run", "ahead", "wallet"]);
  });
});

describe("buildBearingCards", () => {
  it("puts every figure in its own family's card and nowhere else", () => {
    const facts = pack([
      fact("free", "month"),
      fact("committed", "month"),
      fact("on-hand", "now"),
      fact("streak", "run"),
      fact("runway-months", "ahead"),
      fact("wallet-cost", "wallet"),
    ]);

    const cards = buildBearingCards(facts, euro);
    const placed = cards.flatMap((card) => card.figures.map((f) => f.id));

    expect(placed).toHaveLength(6);
    expect(new Set(placed).size).toBe(6);
    expect(
      cards.find((c) => c.id === "month")!.figures.map((f) => f.id),
    ).toEqual(["free", "committed"]);
  });

  it("leads a card with its first figure, and formats it through the caller", () => {
    const cards = buildBearingCards(pack([fact("free", "month", 880.2)]), euro);
    const month = cards.find((c) => c.id === "month")!;

    expect(month.lead?.id).toBe("free");
    expect(month.lead?.display).toBe("880.20 €");
  });

  /**
   * The rule `bearing-tiles.ts` states in prose: a figure with nowhere
   * honest to lead leads nowhere, and a card may only offer destinations
   * its own figures already carry.
   */
  it("offers only destinations its figures actually carry", () => {
    const cards = buildBearingCards(
      pack([
        fact("free", "month"), // href null
        fact("committed", "month"), // /recurring
        fact("unrecorded-so-far", "month"), // /budgets
      ]),
      euro,
    );
    const month = cards.find((c) => c.id === "month")!;

    expect(month.destinations).toEqual(["/recurring", "/budgets"]);
    expect(month.figures.find((f) => f.id === "free")!.href).toBeNull();
  });

  /**
   * The other half of what a client needs to draw a row. It lives on the
   * figure for the same reason `href` does — see `CardFigure.series`.
   */
  it("carries each figure's series, and null for the figures that draw none", () => {
    const cards = buildBearingCards(
      pack([
        fact("net-position", "now"), // series: trend
        fact("on-hand", "now"), // no series
      ]),
      euro,
    );
    const now = cards.find((c) => c.id === "now")!;

    expect(now.figures.find((f) => f.id === "net-position")!.series).toBe(
      "trend",
    );
    expect(now.figures.find((f) => f.id === "on-hand")!.series).toBeNull();
  });

  it("drops a card with no figures rather than drawing an empty one", () => {
    const cards = buildBearingCards(pack([fact("on-hand", "now")]), euro);
    expect(cards.map((c) => c.id)).toEqual(["now"]);
  });
});

/* ----------------------------------------------- the whole vocabulary */

function summary(): MonthlySummary {
  return {
    income: 3200,
    expenses: 1800,
    savings: 400,
    investments: 300,
    investmentDeployments: 0,
    remaining: 700,
    budgetView: "current",
    expenseBreakdown: [],
    savingsBreakdown: [],
    investmentBreakdown: [],
    investmentDeploymentBreakdown: [],
  };
}

const comparison: MonthComparison = {
  current: 1800,
  previous: 2100,
  delta: -300,
  ratio: -0.1429,
  direction: "down",
  throughDay: 20,
  partial: true,
  comparable: true,
  previousLabel: "August",
};

const closeSummary: CloseHistorySummary = {
  baseline: 180,
  sample: 4,
  streak: 3,
  bestStreak: 5,
};

const projection: ForwardProjection = {
  points: [],
  opening: {
    onHand: 4000,
    elapsed: { income: 0, expense: 0, setAside: 0 },
    startOnHand: 4000,
    startKept: 4000,
  },
  // An income charge is scheduled, which is what lets the three `ahead`
  // figures be stated at all rather than withheld.
  makeup: { ingredients: [], noIncomeScheduled: false },
  summary: {
    endingOnHand: 9000,
    endingKept: 12000,
    addedToAccounts: 5000,
    addedAltogether: 8000,
    monthlyToAccounts: 420,
    monthlyAltogether: 660,
    endLabel: "September 2027",
    shrinking: false,
    accountsFalling: false,
    grounded: true,
    unrecordedCounted: true,
  },
};

const runway: Runway = { monthlyCommitted: 1400, reserve: 8000, months: 5.7 };

/**
 * A pack carrying every figure the vocabulary has, each in the family
 * `bearing-facts.ts` itself puts it in.
 *
 * Built by `buildBearingFacts` from a position where every condition it
 * guards a datum with happens to hold, rather than hand-written. That is the
 * point: the tests below are about no figure the app can produce falling out
 * of the card model, and a hand-written family map would only prove the map
 * agrees with itself. If a datum is added, moved between families or gated
 * differently, this fixture stops carrying twenty-nine and says so.
 */
function wholeVocabulary(): BearingFacts {
  return buildBearingFacts({
    asOf: "2026-09-20",
    bearing: buildBearing({
      onHand: 4000,
      positions: [
        { name: "World ETF", marketValue: 8000 },
        { name: "Bitcoin", marketValue: 4000 },
      ],
    }),
    pulse: buildMonthPulse({
      onHand: 4000,
      committed: 600,
      arriving: 100,
      flows: { income: 3200, expenses: 1800, savings: 400, transfers: 0 },
      // A close behind it makes unrecorded spending measurable — 200 here,
      // which is past the 150 cap below and so states the overshoot too.
      openingBalance: 3200,
      cap: 150,
    }),
    summary: summary(),
    comparison,
    closeSummary,
    unrecordedCap: 150,
    projection,
    runway,
    trend: [420, -80, 610],
    returns: {
      wallets: [],
      total: {
        rate: 0.074,
        invested: 10000,
        currentValue: 12000,
        absoluteGain: 2000,
        daysHeld: 800,
        unavailableReason: null,
      },
    },
    allocation: {
      rows: [
        {
          walletId: "pea",
          value: 8000,
          currentWeight: 0.66,
          targetWeight: 0.6,
          driftPoints: 6.2,
          gap: 800,
          status: "over",
        },
      ],
      total: 12000,
      needsRebalance: true,
      targetCoverage: 1,
    },
    costs: {
      rows: [],
      totalAnnualCost: 96,
      coveredValue: 12000,
      uncoveredValue: 0,
      weightedAverage: 0.008,
      envelopeAnnualCost: 0,
      envelopeCoveredValue: 0,
      weightedEnvelopeFee: null,
      allInAnnualCost: 96,
      weightedAllIn: 0.008,
      cheapest: null,
      costAtCheapest: null,
      missingCount: 0,
    },
    contributionPace: 500,
    inboxPending: 3,
  });
}

/**
 * Which surface a destination is named after, in both clients' words.
 *
 * Neither client's naming lives here — the web reads `activeNavHref` and the
 * sidebar's labels, the phone a four-entry table of tab names — so this is a
 * third statement of the same thing, and it is a test's to make. What it
 * captures is the one property core can be held to: `/history` and
 * `/transactions?review=inbox` are both *the Ledger*, so a card carrying both
 * would render two footer links reading the same word.
 */
const SURFACE_OF: Record<string, string> = {
  "/transactions": "ledger",
  "/transactions?review=inbox": "ledger",
  "/history": "ledger",
  "/recurring": "charges",
  "/budgets": "plan",
  "/investments": "wallets",
};

describe("the card model covers the whole vocabulary", () => {
  it("gives every family a block list", () => {
    for (const id of CARD_ORDER) {
      expect(CARD_FAMILY_BLOCKS[id].length).toBeGreaterThan(0);
    }
  });

  /**
   * The expensive blocks cost a fetch when a card opens. Each must appear on
   * exactly one card, or opening two cards pays twice for one answer.
   *
   * `review-inbox` is the third of them and was missing from this list: it is
   * four more reads and the whole category list on the web, two on the phone.
   */
  it("puts each expensive block on exactly one card", () => {
    for (const block of [
      "month-read",
      "arrived-charges",
      "review-inbox",
    ] as const) {
      const carrying = CARD_ORDER.filter((id) =>
        CARD_FAMILY_BLOCKS[id].includes(block),
      );
      expect(carrying).toHaveLength(1);
    }
  });

  /**
   * The promise the five cards replaced the bento to make: every figure has
   * a home, and exactly one.
   *
   * `buildBearingCards` drops a fact whose id is not in `BEARING_TILES` —
   * `continue`, with no error anywhere — so a figure added to the pack and
   * forgotten in the tile table vanishes off the screen silently. What stood
   * here before was `BEARING_TILES[id]` being defined for every `TileId`,
   * which `Record<TileId, TileMeta>` already makes a compile error, so it
   * could never have caught that.
   */
  it("lands every one of the vocabulary\u2019s figures on exactly one card", () => {
    const facts = wholeVocabulary();
    // The fixture is only worth what it carries: if this fails, the pack has
    // stopped producing the whole vocabulary and the coverage below is a
    // weaker claim than it reads as.
    expect(new Set(facts.facts.map((fact) => fact.id))).toEqual(
      new Set(BEARING_TILE_IDS),
    );

    const cards: BearingCard[] = buildBearingCards(facts, euro);
    const placed = cards.flatMap((card) => card.figures.map((f) => f.id));

    expect(placed).toHaveLength(BEARING_TILE_IDS.length);
    expect(new Set(placed)).toEqual(new Set(BEARING_TILE_IDS));
  });

  /**
   * Two footer links reading the same word.
   *
   * Both clients name a destination themselves — the web off the sidebar,
   * the phone off a table of tab names — and nothing holds the two
   * vocabularies to each other or to this list. They agree today by
   * coincidence of which figures sit in which family: add a figure with href
   * `/transactions` to `now`, beside `inbox-pending`'s
   * `/transactions?review=inbox`, and the web footer renders "Ledger" twice.
   * This is the cheap durable guard against that; naming the destinations in
   * core is the expensive one, and is ledgered.
   */
  it("never offers one card two destinations with the same name", () => {
    const cards = buildBearingCards(wholeVocabulary(), euro);

    for (const card of cards) {
      const surfaces = card.destinations.map((href) => {
        // An unmapped destination is not a pass — it is a href neither
        // client has been taught to name, which the footer would render as
        // the old "see the full surface" wording.
        expect(SURFACE_OF[href], `${href} names no surface`).toBeDefined();
        return SURFACE_OF[href];
      });

      expect(new Set(surfaces).size, `${card.id} names one surface twice`).toBe(
        surfaces.length,
      );
    }
  });
});
