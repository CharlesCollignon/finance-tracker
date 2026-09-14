import { describe, expect, it } from "vitest";

import {
  MAX_WALLET_CLAIM_LENGTH,
  MAX_WALLET_HEADLINE_LENGTH,
  MAX_WALLET_OBSERVATIONS,
  MAX_WALLET_SUGGESTIONS,
  createFakeWalletReadSource,
  renderWalletRead,
  targetFromWalletRead,
  verifyWalletRead,
  walletReadFooting,
} from "./wallet-read";
import { buildWalletReadPrompt } from "./wallet-read-prompt";
import { buildLookThroughFacts } from "./look-through-facts";
import { buildLookThrough } from "./look-through";
import { buildTargetAllocation } from "./look-through-target";
import { READING_VERSION, type InstrumentReading } from "./instrument-reading";

const NOW = new Date("2026-09-14T12:00:00.000Z");
const WORLD = "FR001400U5Q4";
const SP500 = "FR0013412285";
const EMERGING = "FR0013412020";
const SWDA = "IE00B4L5Y983";

const money = (amount: number) => `${amount.toFixed(2)} €`;

/** Proves a figure on screen came from the formatter, not from the model. */
const marked = (amount: number) => `«${amount}»`;

function reading(
  isin: string,
  partial: Partial<InstrumentReading> = {},
): InstrumentReading {
  return {
    isin,
    ongoingCharge: 0.002,
    currency: "EUR",
    countryWeights: { US: 0.65, FR: 0.05, JP: 0.06 },
    sectorWeights: { "information-technology": 0.28, financials: 0.14 },
    topConstituents: [{ name: "Apple Inc.", weight: 0.05 }],
    constituentsCoverage: 0.05,
    sources: ["https://example.com/factsheet"],
    sourcedAt: NOW.toISOString(),
    model: "fake",
    version: READING_VERSION,
    ...partial,
  };
}

function pack(options: { unread?: boolean } = {}) {
  const positions = [
    {
      positionId: "p1",
      name: "World tracker",
      walletId: "pea" as const,
      isin: WORLD,
      marketValue: 8000,
      ongoingCharge: null,
    },
    {
      positionId: "p2",
      name: "S&P 500",
      walletId: "pea" as const,
      isin: SP500,
      marketValue: 4000,
      ongoingCharge: null,
    },
  ];

  const readings = new Map([[WORLD, reading(WORLD)]]);
  if (!options.unread) {
    readings.set(SP500, reading(SP500, { isin: SP500 }));
  }

  const lookThrough = buildLookThrough({ positions, readings, now: NOW });
  const target = buildTargetAllocation([
    { isin: WORLD, role: "core-world", wallet: "pea", weightClass: "lead" },
  ]);
  return {
    lookThrough,
    facts: buildLookThroughFacts(lookThrough, target, ["pea"]),
  };
}

function answer(overrides: Record<string, unknown> = {}) {
  return {
    // No scale words: "twice over" was the first draft and `writesAFigure`
    // rightly refused it, which is the rule working rather than a nuisance.
    headline: "Both funds lean on the same American companies.",
    observations: [
      {
        text: "The United States is {{fact:us-share}} of what could be read.",
        tone: "watch",
        basis: ["us-share"],
      },
      {
        text: "Charges come to {{fact:annual-cost}} a year.",
        tone: "neutral",
        basis: ["annual-cost"],
      },
    ],
    suggestions: [
      {
        text: "A single broad fund would cover both, given {{fact:index-collisions}}.",
        effort: "this-month",
        basis: ["index-collisions"],
        isin: WORLD,
        role: "core-world",
        wallet: "pea",
        weightClass: "lead",
      },
    ],
    ...overrides,
  };
}

describe("verifyWalletRead", () => {
  it("accepts a clean answer", () => {
    const verdict = verifyWalletRead(answer(), pack().facts);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;

    expect(verdict.read.observations).toHaveLength(2);
    expect(verdict.read.suggestions).toHaveLength(1);
    expect(verdict.dropped).toEqual([]);
  });

  it("refuses an answer that is not the shape asked for", () => {
    const verdict = verifyWalletRead({ nope: true }, pack().facts);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("unreadable");
  });

  /* ------------------------------------------------------- the figure rule */

  it("refuses a headline that writes its own figure", () => {
    const verdict = verifyWalletRead(
      answer({ headline: "You are 65% United States." }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("invented-figure");
  });

  it("refuses a headline that spells its figure out", () => {
    const verdict = verifyWalletRead(
      answer({ headline: "Nearly two thirds of it sits in one country." }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("invented-figure");
  });

  it("drops an observation that writes a figure, and keeps the read", () => {
    const verdict = verifyWalletRead(
      answer({
        observations: [
          {
            text: "The United States is {{fact:us-share}} of it.",
            tone: "watch",
            basis: ["us-share"],
          },
          {
            text: "Your charges are about 0.4% a year.",
            tone: "watch",
            basis: [],
          },
        ],
      }),
      pack().facts,
    );

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.observations).toHaveLength(1);
    expect(verdict.dropped).toEqual([
      {
        kind: "observation",
        text: "Your charges are about 0.4% a year.",
        why: "figure",
      },
    ]);
  });

  /**
   * Half the index names in existence contain a number, and the app is what
   * put those names in front of the model. A digit inside a catalogued name
   * is an identifier, not a figure — observed on a live answer, where two of
   * three suggestions were dropped for the digits in a fund's own name.
   */
  describe("digits that belong to a fund's name", () => {
    it("keeps a suggestion that names an index containing a number", () => {
      const verdict = verifyWalletRead(
        answer({
          suggestions: [
            {
              text: "Trim Amundi PEA S&P 500 to a satellite; the S&P 500 is already inside your world fund.",
              effort: "this-month",
              basis: [],
              isin: SP500,
              role: "us-large",
              wallet: "pea",
              weightClass: "satellite",
            },
          ],
        }),
        pack().facts,
      );

      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.read.suggestions).toHaveLength(1);
      expect(verdict.dropped).toEqual([]);
    });

    it("keeps an observation naming STOXX Europe 600", () => {
      const verdict = verifyWalletRead(
        answer({
          observations: [
            {
              text: "You hold nothing tracking the STOXX Europe 600.",
              tone: "watch",
              basis: [],
            },
          ],
        }),
        pack().facts,
      );
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.read.observations).toHaveLength(1);
    });

    it("still refuses a real quantity in the same sentence", () => {
      // The name is forgiven; the invented share beside it is not.
      const verdict = verifyWalletRead(
        answer({
          observations: [
            {
              text: "The S&P 500 is about 40% of what you hold.",
              tone: "watch",
              basis: [],
            },
            {
              text: "The United States is {{fact:us-share}} of it.",
              tone: "watch",
              basis: ["us-share"],
            },
          ],
        }),
        pack().facts,
      );
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.read.observations).toHaveLength(1);
      expect(verdict.dropped[0]!.why).toBe("figure");
    });

    it("still refuses a spelled-out quantity beside a name", () => {
      const verdict = verifyWalletRead(
        answer({
          headline: "The S&P 500 is nearly two thirds of it.",
        }),
        pack().facts,
      );
      expect(verdict.ok).toBe(false);
      if (verdict.ok) return;
      expect(verdict.reason).toBe("invented-figure");
    });
  });

  /* -------------------------------------------------------- the datum rule */

  it("refuses a claim resting on a datum that was never sent", () => {
    const verdict = verifyWalletRead(
      answer({
        observations: [
          {
            text: "Japan is {{fact:japan-share}} of it.",
            tone: "neutral",
            basis: ["japan-share"],
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("unknown-datum");
  });

  it("forgives a basis entry wrapped in placeholder punctuation", () => {
    // The right datum in the wrong punctuation. Refusing the whole read over
    // it would be the harshest answer to the smallest mistake.
    const verdict = verifyWalletRead(
      answer({
        observations: [
          {
            text: "The United States is {{fact:us-share}} of it.",
            tone: "watch",
            basis: ["{{fact:us-share}}"],
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.observations[0]!.basis).toEqual(["us-share"]);
  });

  it("drops a claim citing a figure it did not declare", () => {
    const verdict = verifyWalletRead(
      answer({
        observations: [
          {
            text: "The United States is {{fact:us-share}} of it.",
            tone: "watch",
            basis: ["annual-cost"],
          },
          {
            text: "Charges come to {{fact:annual-cost}} a year.",
            tone: "neutral",
            basis: ["annual-cost"],
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.dropped[0]!.why).toBe("unbacked-placeholder");
  });

  /* --------------------------------------------------- the instrument rule */

  /**
   * The worst thing this feature could do is put a fabricated identifier on
   * screen looking like a fund. The catalogue was handed over in full, so
   * naming something outside it is fatal for the whole read.
   */
  it("refuses a read that invented an instrument", () => {
    const verdict = verifyWalletRead(
      answer({
        suggestions: [
          {
            text: "Consider a global fund.",
            effort: "this-month",
            basis: [],
            isin: "IE00BOGUS1234",
            role: "core-world",
            wallet: "pea",
            weightClass: "lead",
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("invented-instrument");
  });

  /**
   * A wrapper mistake is a mistake about French tax rules, not a fabricated
   * fact — and `buildTargetAllocation` refuses it independently. So it drops
   * one suggestion rather than the read.
   */
  it("drops a fund placed in a wrapper it cannot sit in", () => {
    const verdict = verifyWalletRead(
      answer({
        suggestions: [
          {
            text: "Consider this instead.",
            effort: "this-month",
            basis: [],
            // Physically replicated: legal in a CTO, never in a PEA.
            isin: SWDA,
            role: "core-world",
            wallet: "pea",
            weightClass: "lead",
          },
        ],
      }),
      pack().facts,
    );

    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.suggestions).toEqual([]);
    expect(verdict.dropped[0]!.why).toBe("wrong-wrapper");
  });

  it("accepts the same fund in a wrapper it may sit in", () => {
    const verdict = verifyWalletRead(
      answer({
        suggestions: [
          {
            text: "Consider this instead.",
            effort: "this-month",
            basis: [],
            isin: SWDA,
            role: "core-world",
            wallet: "cto",
            weightClass: "lead",
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.suggestions).toHaveLength(1);
  });

  it("keeps one suggestion per instrument", () => {
    const suggestion = {
      text: "Lean on this.",
      effort: "this-month",
      basis: [],
      isin: WORLD,
      role: "core-world",
      wallet: "pea",
      weightClass: "lead",
    };
    const verdict = verifyWalletRead(
      answer({ suggestions: [suggestion, { ...suggestion, text: "Again." }] }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.suggestions).toHaveLength(1);
  });

  it("normalises the identifier it was handed", () => {
    const verdict = verifyWalletRead(
      answer({
        suggestions: [
          {
            text: "Lean on this.",
            effort: "now",
            basis: [],
            isin: ` ${WORLD.toLowerCase()} `,
            role: "core-world",
            wallet: "pea",
            weightClass: "lead",
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.suggestions[0]!.isin).toBe(WORLD);
  });

  /* ------------------------------------------------------------- the limits */

  it("refuses a headline longer than a line", () => {
    const verdict = verifyWalletRead(
      answer({ headline: "x".repeat(MAX_WALLET_HEADLINE_LENGTH + 1) }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("unreadable");
  });

  it("drops an over-long claim rather than the read", () => {
    const verdict = verifyWalletRead(
      answer({
        observations: [
          {
            text: "The United States is {{fact:us-share}} of it.",
            tone: "watch",
            basis: ["us-share"],
          },
          {
            text: "x".repeat(MAX_WALLET_CLAIM_LENGTH + 1),
            tone: "neutral",
            basis: [],
          },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.dropped[0]!.why).toBe("too-long");
  });

  it("caps what it keeps", () => {
    const observation = {
      text: "The United States is {{fact:us-share}} of it.",
      tone: "neutral",
      basis: ["us-share"],
    };
    const verdict = verifyWalletRead(
      answer({ observations: Array.from({ length: 8 }, () => observation) }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.observations).toHaveLength(MAX_WALLET_OBSERVATIONS);
  });

  it("caps suggestions too", () => {
    const isins = [WORLD, SP500, EMERGING, "FR0011550193", "LU1681038672"];
    const verdict = verifyWalletRead(
      answer({
        suggestions: isins.map((isin) => ({
          text: "Consider it.",
          effort: "habit",
          basis: [],
          isin,
          role: "core-world",
          wallet: "pea",
          weightClass: "satellite",
        })),
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.read.suggestions).toHaveLength(MAX_WALLET_SUGGESTIONS);
  });

  it("refuses when every observation had to go", () => {
    const verdict = verifyWalletRead(
      answer({
        observations: [
          { text: "You are up 12% this year.", tone: "good", basis: [] },
        ],
      }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("nothing-left");
  });

  it("refuses a field it was not expecting", () => {
    const verdict = verifyWalletRead(
      answer({ verdict: "sell everything" }),
      pack().facts,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("unreadable");
  });
});

describe("renderWalletRead", () => {
  it("fills every figure in from the app's own arithmetic", () => {
    const { facts } = pack();
    const verdict = verifyWalletRead(answer(), facts);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;

    const rendered = renderWalletRead(verdict.read, facts, marked)!;
    expect(rendered).not.toBeNull();

    const figures = rendered.observations
      .flatMap((row) => row.segments)
      .filter((segment) => segment.kind === "figure");
    expect(figures.length).toBe(2);

    // Only money goes through the injected formatter — a percentage is the
    // locale's business, not the caller's. So the money figure is the one
    // that proves the value came from the app rather than from the model.
    const cost = figures.find(
      (segment) => segment.kind === "figure" && segment.factId === "annual-cost",
    );
    expect(cost?.kind).toBe("figure");
    if (cost?.kind !== "figure") return;
    expect(cost.display.startsWith("«")).toBe(true);

    // And none of the figures is text the model typed: every one of them
    // carries the id it was substituted from.
    for (const segment of figures) {
      if (segment.kind !== "figure") continue;
      expect(segment.factId).not.toBe("");
    }
  });

  it("names a fund from the catalogue, never from the read", () => {
    const { facts } = pack();
    const verdict = verifyWalletRead(answer(), facts);
    if (!verdict.ok) return;

    const rendered = renderWalletRead(verdict.read, facts, money)!;
    expect(rendered.suggestions[0]!.name).toBe(
      "Amundi PEA Monde (MSCI World)",
    );
    expect(rendered.suggestions[0]!.symbol).toBe("DCAM");
  });

  it("cannot be rendered once a cited figure has gone", () => {
    const { facts } = pack();
    const verdict = verifyWalletRead(answer(), facts);
    if (!verdict.ok) return;

    const emptied = { ...facts, facts: [] };
    expect(renderWalletRead(verdict.read, emptied, money)).toBeNull();
  });
});

describe("targetFromWalletRead", () => {
  it("turns the read's classes into weights that add up", () => {
    const verdict = verifyWalletRead(answer(), pack().facts);
    if (!verdict.ok) return;

    const target = targetFromWalletRead(verdict.read);
    expect(target.rows).toHaveLength(1);
    expect(target.coverage).toBeCloseTo(1, 6);
  });

  it("yields nothing when the read suggested nothing", () => {
    const verdict = verifyWalletRead(answer({ suggestions: [] }), pack().facts);
    if (!verdict.ok) return;
    expect(targetFromWalletRead(verdict.read).rows).toEqual([]);
  });
});

describe("walletReadFooting", () => {
  it("always says this is not advice", () => {
    const lines = walletReadFooting(pack().facts);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("not investment advice");
  });

  it("says so when part of the portfolio was never read", () => {
    const lines = walletReadFooting(pack({ unread: true }).facts);
    expect(lines.some((line) => line.includes("have not been read"))).toBe(
      true,
    );
  });
});

describe("buildWalletReadPrompt", () => {
  it("hands over the catalogue in full, which is what makes refusal fair", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });

    expect(request.user).toContain(WORLD);
    expect(request.user).toContain("Amundi PEA Monde (MSCI World)");
  });

  it("states the figure rule twice, first and last", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });
    const occurrences = request.system.split("must be written as").length - 1;
    expect(occurrences).toBe(2);
  });

  it("forbids writing a percentage and offers classes instead", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });
    expect(request.system).toContain("never write an allocation percentage");
    expect(request.system).toContain("satellite");
  });

  it("says the overlap figure is a floor", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });
    expect(request.system).toContain("floor");
    expect(request.system).toContain("Never restate it as");
  });

  it("forbids a claim about currency", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });
    expect(request.system).toContain("currency");
  });

  it("names the index collision it found", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });
    expect(request.user).toContain("MSCI World");
    expect(request.user).toContain("S&P 500");
  });

  it("writes the whole thing in French when asked", () => {
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      locale: "fr",
      wallets: ["pea"],
    });
    expect(request.locale).toBe("fr");
    expect(request.system).toContain("Ce n'est pas un conseil");
    expect(request.system).toContain("pourcentage");
  });
});

describe("createFakeWalletReadSource", () => {
  it("answers from its script and records the request", async () => {
    const source = createFakeWalletReadSource([answer()]);
    const { facts, lookThrough } = pack();
    const request = buildWalletReadPrompt(facts, lookThrough, {
      money,
      wallets: ["pea"],
    });

    const result = await source.write(request);
    expect(result).not.toBeNull();
    expect(source.calls).toHaveLength(1);
    expect(source.calls[0]!.locale).toBe("en");
  });

  it("answers null once its script runs out", async () => {
    const source = createFakeWalletReadSource([]);
    const { facts, lookThrough } = pack();
    expect(
      await source.write(
        buildWalletReadPrompt(facts, lookThrough, { money, wallets: ["pea"] }),
      ),
    ).toBeNull();
  });
});
