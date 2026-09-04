import { describe, expect, it } from "vitest";

import {
  amountsMatch,
  describeFulfilment,
  describeMiss,
  explainFulfilmentMisses,
  proposeFulfilments,
  refusalKey,
  type FulfilmentMovement,
  type FulfilmentOccurrence,
} from "./recurring-fulfilment";

const RENT_CATEGORY = "cat-rent";
const SALARY_CATEGORY = "cat-salary";

function occurrence(
  partial: Partial<FulfilmentOccurrence> = {},
): FulfilmentOccurrence {
  return {
    templateId: "tpl-rent",
    occurredOn: "2026-09-05",
    amount: 780,
    categoryId: RENT_CATEGORY,
    categoryType: "expense",
    label: "Rent",
    ...partial,
  };
}

function movement(
  partial: Partial<FulfilmentMovement> = {},
): FulfilmentMovement {
  return {
    transactionId: "tx-1",
    occurredOn: "2026-09-04",
    amount: 780,
    categoryId: RENT_CATEGORY,
    note: "PRELEVEMENT LOYER",
    ...partial,
  };
}

const money = (amount: number) => `${amount.toFixed(2)} €`;

/**
 * Late enough that every fixture movement is in the past.
 *
 * The fixtures are about matching, not about arrival, so they are dated
 * mid-month and asked about from the end of it. The arrival rule has its own
 * block below.
 */
const TODAY = "2026-09-30";

describe("amountsMatch", () => {
  it("accepts a salary that moved with overtime", () => {
    expect(amountsMatch(3400, 3433.14)).toBe(true);
  });

  it("refuses a difference beyond five per cent", () => {
    expect(amountsMatch(3400, 3600)).toBe(false);
  });

  it("uses an absolute floor on small amounts", () => {
    // Five per cent of €4 is 20 cents, which no real charge respects.
    expect(amountsMatch(4, 5)).toBe(true);
    expect(amountsMatch(4, 6.5)).toBe(false);
  });

  it("is symmetric", () => {
    expect(amountsMatch(100, 104)).toBe(amountsMatch(104, 100));
  });
});

describe("proposeFulfilments", () => {
  it("pairs a charge with the bank row that looks like it", () => {
    const [proposal] = proposeFulfilments([occurrence()], [movement()], {
      today: TODAY,
    });

    expect(proposal).toMatchObject({
      key: "tpl-rent:2026-09-05",
      templateId: "tpl-rent",
      transactionId: "tx-1",
      expectedAmount: 780,
      actualAmount: 780,
      difference: 0,
      daysApart: 1,
    });
  });

  it("reports the difference signed", () => {
    const [proposal] = proposeFulfilments(
      [occurrence({ amount: 3400, categoryId: SALARY_CATEGORY })],
      [movement({ amount: 3433.14, categoryId: SALARY_CATEGORY })],
      { today: TODAY },
    );

    expect(proposal!.difference).toBe(33.14);
  });

  it("never pairs across categories", () => {
    // The category is the one signal that is a fact rather than a
    // coincidence: two €780 movements in a month are not the same charge just
    // because they are the same size.
    expect(
      proposeFulfilments(
        [occurrence()],
        [movement({ categoryId: SALARY_CATEGORY })],
        { today: TODAY },
      ),
    ).toEqual([]);
  });

  it("refuses a movement too far from the occurrence", () => {
    expect(
      proposeFulfilments(
        [occurrence()],
        [movement({ occurredOn: "2026-09-11" })],
        { today: TODAY },
      ),
    ).toEqual([]);
  });

  it("refuses a movement of the wrong size", () => {
    expect(
      proposeFulfilments([occurrence()], [movement({ amount: 980 })], {
        today: TODAY,
      }),
    ).toEqual([]);
  });

  describe("one for one", () => {
    it("does not let one payment cancel two occurrences", () => {
      // Otherwise a single rent debit halves the month's expected outgoings.
      const proposals = proposeFulfilments(
        [
          occurrence({ occurredOn: "2026-09-05" }),
          occurrence({ occurredOn: "2026-09-06" }),
        ],
        [movement()],
        { today: TODAY },
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.occurredOn).toBe("2026-09-05");
    });

    it("does not let one occurrence claim two payments", () => {
      const proposals = proposeFulfilments(
        [occurrence()],
        [
          movement({ transactionId: "tx-1", occurredOn: "2026-09-04" }),
          movement({ transactionId: "tx-2", occurredOn: "2026-09-05" }),
        ],
        { today: TODAY },
      );

      expect(proposals).toHaveLength(1);
      // The nearer date wins: two charges of a size are usually the same
      // standing charge twice, two on a day are usually unrelated.
      expect(proposals[0]!.transactionId).toBe("tx-2");
    });

    it("pairs two occurrences with two payments, nearest first", () => {
      const proposals = proposeFulfilments(
        [
          occurrence({ templateId: "tpl-a", occurredOn: "2026-09-05" }),
          occurrence({
            templateId: "tpl-b",
            occurredOn: "2026-09-20",
            categoryId: SALARY_CATEGORY,
            amount: 3400,
          }),
        ],
        [
          movement({ transactionId: "tx-1", occurredOn: "2026-09-05" }),
          movement({
            transactionId: "tx-2",
            occurredOn: "2026-09-21",
            amount: 3400,
            categoryId: SALARY_CATEGORY,
          }),
        ],
        { today: TODAY },
      );

      expect(proposals.map((p) => [p.templateId, p.transactionId])).toEqual([
        ["tpl-a", "tx-1"],
        ["tpl-b", "tx-2"],
      ]);
    });
  });

  describe("what is already decided", () => {
    it("skips an occurrence already fulfilled", () => {
      expect(
        proposeFulfilments([occurrence()], [movement()], {
          today: TODAY,
          fulfilledKeys: new Set(["tpl-rent:2026-09-05"]),
        }),
      ).toEqual([]);
    });

    it("skips a transaction already standing in for something", () => {
      expect(
        proposeFulfilments([occurrence()], [movement()], {
          today: TODAY,
          claimedTransactionIds: new Set(["tx-1"]),
        }),
      ).toEqual([]);
    });

    it("does not offer a pairing the user refused", () => {
      expect(
        proposeFulfilments([occurrence()], [movement()], {
          today: TODAY,
          refusedPairs: new Set([refusalKey("tpl-rent", "2026-09-05", "tx-1")]),
        }),
      ).toEqual([]);
    });

    it("still offers a better candidate after a refusal", () => {
      // The refusal names the pair, not the occurrence: "not that payment"
      // must not mean "never ask about the 5th again".
      const proposals = proposeFulfilments(
        [occurrence()],
        [
          movement({ transactionId: "tx-1", occurredOn: "2026-09-03" }),
          movement({ transactionId: "tx-2", occurredOn: "2026-09-05" }),
        ],
        {
          today: TODAY,
          refusedPairs: new Set([refusalKey("tpl-rent", "2026-09-05", "tx-2")]),
        },
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.transactionId).toBe("tx-1");
    });
  });

  it("lists proposals in the order the month happened", () => {
    const proposals = proposeFulfilments(
      [
        occurrence({ templateId: "tpl-late", occurredOn: "2026-09-20" }),
        occurrence({ templateId: "tpl-early", occurredOn: "2026-09-02" }),
      ],
      [
        movement({ transactionId: "tx-late", occurredOn: "2026-09-20" }),
        movement({ transactionId: "tx-early", occurredOn: "2026-09-02" }),
      ],
      { today: TODAY },
    );

    expect(proposals.map((p) => p.actualOn)).toEqual([
      "2026-09-02",
      "2026-09-20",
    ]);
  });
});

describe("describeFulfilment", () => {
  it("says so when the amount is exact", () => {
    const [proposal] = proposeFulfilments(
      [occurrence()],
      [movement({ occurredOn: "2026-09-05" })],
      { today: TODAY },
    );

    expect(describeFulfilment(proposal!, money)).toBe(
      "The same to the cent, on the day it was due",
    );
  });

  it("leads with the difference, which is the part worth reading", () => {
    const [proposal] = proposeFulfilments(
      [occurrence({ amount: 3400, categoryId: SALARY_CATEGORY })],
      [
        movement({
          amount: 3433.14,
          categoryId: SALARY_CATEGORY,
          occurredOn: "2026-09-07",
        }),
      ],
      { today: TODAY },
    );

    expect(describeFulfilment(proposal!, money)).toBe(
      "33.14 € more than expected, 2 days late",
    );
  });

  it("says early when the money came first", () => {
    const [proposal] = proposeFulfilments(
      [occurrence()],
      [movement({ amount: 770, occurredOn: "2026-09-04" })],
      { today: TODAY },
    );

    expect(describeFulfilment(proposal!, money)).toBe(
      "10.00 € less than expected, 1 day early",
    );
  });
});

describe("only what has actually arrived", () => {
  /**
   * The bug this exists for, from a real screenshot: the Month page offered
   * "EDF −60 € Thu 17 Sep · the same to the cent, on the day it was due" on
   * the 4th. Both sides were forecasts — an EDF row dated the 17th against an
   * EDF occurrence dated the 17th — so the app was asking whether something
   * thirteen days away had happened, and a press would have removed a real
   * upcoming charge from the month's outgoings.
   */
  it("does not offer a movement dated in the future", () => {
    expect(
      proposeFulfilments(
        [occurrence({ occurredOn: "2026-09-17", amount: 60 })],
        [movement({ occurredOn: "2026-09-17", amount: 60 })],
        { today: "2026-09-04" },
      ),
    ).toEqual([]);
  });

  it("offers one dated today", () => {
    // The boundary belongs to the past: a charge that landed this morning has
    // arrived, and waiting until tomorrow to say so would be arbitrary.
    const proposals = proposeFulfilments(
      [occurrence({ occurredOn: "2026-09-05" })],
      [movement({ occurredOn: "2026-09-04" })],
      { today: "2026-09-04" },
    );

    expect(proposals).toHaveLength(1);
  });

  it("still matches a past movement to a future occurrence", () => {
    // The case the feature exists for: the charge is due on the 5th, the bank
    // took it on the 3rd, and it is the 4th. The occurrence is ahead of
    // today; the movement is not.
    const proposals = proposeFulfilments(
      [occurrence({ occurredOn: "2026-09-05" })],
      [movement({ occurredOn: "2026-09-03" })],
      { today: "2026-09-04" },
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.occurredOn).toBe("2026-09-05");
    expect(proposals[0]!.actualOn).toBe("2026-09-03");
  });

  it("prefers a movement that has happened over a nearer one that has not", () => {
    // Closeness decides between candidates, but only among candidates. A
    // future row is not a candidate at all, however exact.
    const proposals = proposeFulfilments(
      [occurrence({ occurredOn: "2026-09-05" })],
      [
        movement({ transactionId: "tx-past", occurredOn: "2026-09-03" }),
        movement({ transactionId: "tx-future", occurredOn: "2026-09-05" }),
      ],
      { today: "2026-09-04" },
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.transactionId).toBe("tx-past");
  });
});

describe("explainFulfilmentMisses", () => {
  /**
   * The report this exists for: "there are two identical Transportation
   * charges in my ledger and neither was proposed." Narrow thresholds are
   * right, and a narrow matcher that says nothing is indistinguishable from a
   * broken one.
   */
  function explain(
    occurrences: FulfilmentOccurrence[],
    movements: FulfilmentMovement[],
    today = TODAY,
  ) {
    const proposals = proposeFulfilments(occurrences, movements, { today });
    return explainFulfilmentMisses(occurrences, movements, proposals, {
      today,
    });
  }

  it("says nothing to match when the category is empty", () => {
    const [miss] = explain(
      [occurrence()],
      [movement({ categoryId: SALARY_CATEGORY })],
    );

    expect(miss).toMatchObject({ reason: "nothing-alike", nearest: null });
    expect(describeMiss(miss!, money)).toBe("nothing in its category to match");
  });

  it("blames the amount when the date was fine", () => {
    const [miss] = explain(
      [occurrence()],
      [movement({ amount: 980, occurredOn: "2026-09-05" })],
    );

    expect(miss!.reason).toBe("amount");
    expect(describeMiss(miss!, money)).toBe(
      "nearest was 980.00 €, too far from 780.00 €",
    );
  });

  it("blames the window when the amount was exact", () => {
    // The likeliest cause of a real miss: a charge the bank takes nine days
    // from the day the template names.
    const [miss] = explain(
      [occurrence({ occurredOn: "2026-09-14" })],
      [movement({ occurredOn: "2026-09-04" })],
    );

    expect(miss!.reason).toBe("date");
    expect(describeMiss(miss!, money)).toBe(
      "nearest was 10 days away, beyond the 4-day window",
    );
  });

  it("says so when the only candidate is still in the future", () => {
    const [miss] = explain(
      [occurrence({ occurredOn: "2026-09-17" })],
      [movement({ occurredOn: "2026-09-17" })],
      "2026-09-04",
    );

    expect(miss!.reason).toBe("not-arrived");
    expect(describeMiss(miss!, money)).toBe(
      "the nearest movement has not happened yet",
    );
  });

  it("remembers a refusal rather than blaming the data", () => {
    const occurrences = [occurrence()];
    const movements = [movement()];
    const refusedPairs = new Set([
      refusalKey("tpl-rent", "2026-09-05", "tx-1"),
    ]);

    const proposals = proposeFulfilments(occurrences, movements, {
      today: TODAY,
      refusedPairs,
    });
    const [miss] = explainFulfilmentMisses(occurrences, movements, proposals, {
      today: TODAY,
      refusedPairs,
    });

    expect(miss!.reason).toBe("refused");
  });

  it("explains nothing that was offered or already answered", () => {
    // Together with the proposals this accounts for every occurrence exactly
    // once, which is what makes the pair trustworthy as a report.
    expect(explain([occurrence()], [movement()])).toEqual([]);

    const occurrences = [occurrence()];
    const movements = [movement()];
    const fulfilledKeys = new Set(["tpl-rent:2026-09-05"]);
    const proposals = proposeFulfilments(occurrences, movements, {
      today: TODAY,
      fulfilledKeys,
    });

    expect(
      explainFulfilmentMisses(occurrences, movements, proposals, {
        today: TODAY,
        fulfilledKeys,
      }),
    ).toEqual([]);
  });
});
