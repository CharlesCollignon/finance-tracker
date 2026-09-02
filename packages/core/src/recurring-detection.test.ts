import { describe, expect, it } from "vitest";

import {
  detectRecurring,
  filterLiveProposals,
  type DetectionInput,
} from "./recurring-detection";

function run(
  note: string,
  dates: string[],
  amount: number | number[],
  categoryId = "cat-subs",
  categoryName = "Subscriptions",
  categoryType: DetectionInput["categoryType"] = "expense",
): DetectionInput[] {
  return dates.map((occurredOn, index) => ({
    occurredOn,
    amount: Array.isArray(amount) ? amount[index]! : amount,
    note,
    categoryId,
    categoryName,
    categoryType,
  }));
}

describe("detectRecurring", () => {
  it("finds a monthly charge and the day it lands on", () => {
    const proposals = detectRecurring(
      run(
        "PRELEVEMENT FREE TELECOM",
        ["2026-06-08", "2026-07-08", "2026-08-08"],
        29.99,
      ),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      recurrence: "monthly",
      dayOfMonth: 8,
      amount: 29.99,
      count: 3,
    });
  });

  it("finds a weekly charge and the weekday it lands on", () => {
    // Mondays.
    const proposals = detectRecurring(
      run(
        "PAIEMENT PAR CARTE X7322 BITSTACK SAS MEYREUI",
        ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"],
        10,
      ),
    );

    expect(proposals[0]).toMatchObject({ recurrence: "weekly", dayOfWeek: 1 });
  });

  it("groups a merchant the terminal spelled two ways", () => {
    const proposals = detectRecurring([
      ...run(
        "PAIEMENT PAR CARTE X7322 BITSTACK SAS MEYREUI",
        ["2026-06-01"],
        10,
      ),
      ...run(
        "PAIEMENT PAR CARTE X7322 Bitstack 100 Impasse",
        ["2026-07-01"],
        10,
      ),
      ...run("PAIEMENT PAR CARTE X7322 BITSTACK", ["2026-08-01"], 10),
    ]);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.count).toBe(3);
  });

  it("wants more than a coincidence", () => {
    expect(
      detectRecurring(run("MACIF", ["2026-07-05", "2026-08-05"], 41.2)),
    ).toEqual([]);
  });

  it("ignores a run with no cadence to it", () => {
    expect(
      detectRecurring(
        run("MONOPRIX", ["2026-08-02", "2026-08-05", "2026-08-19"], 30),
      ),
    ).toEqual([]);
  });

  it("will not propose a fixed template for something that varies", () => {
    // An energy bill is not a subscription; a fixed figure would put a wrong
    // number into every projection.
    expect(
      detectRecurring(
        run("EDF", ["2026-06-10", "2026-07-10", "2026-08-10"], [40, 95, 62]),
      ),
    ).toEqual([]);
  });

  it("tolerates the small drift a real charge has", () => {
    const proposals = detectRecurring(
      run(
        "SPOTIFY",
        ["2026-06-10", "2026-07-11", "2026-08-09"],
        [10.99, 10.99, 11.99],
      ),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.amount).toBe(11.99);
  });

  it("carries the newest price forward rather than averaging it away", () => {
    const proposals = detectRecurring(
      run(
        "NETFLIX",
        ["2026-06-15", "2026-07-15", "2026-08-15"],
        [13.49, 13.49, 14.49],
      ),
    );

    expect(proposals[0]!.amount).toBe(14.49);
  });

  it("never proposes a template from income", () => {
    // A salary is the employer's schedule, not a standing instruction the
    // user issues.
    expect(
      detectRecurring(
        run(
          "VIREMENT QUANTCUBE TECHNOLOGY",
          ["2026-06-30", "2026-07-30", "2026-08-30"],
          3200,
          "cat-salary",
          "Salary",
          "income",
        ),
      ),
    ).toEqual([]);
  });

  it("will not fold two things filed differently into one template", () => {
    const proposals = detectRecurring([
      ...run("AMAZON", ["2026-06-01"], 12, "cat-a", "Other"),
      ...run("AMAZON", ["2026-07-01"], 12, "cat-b", "Subscriptions"),
      ...run("AMAZON", ["2026-08-01"], 12, "cat-c", "Groceries"),
    ]);

    expect(proposals).toEqual([]);
  });

  it("puts the biggest yearly commitment first", () => {
    const proposals = detectRecurring([
      ...run("BITSTACK", ["2026-08-03", "2026-08-10", "2026-08-17"], 10),
      ...run(
        "LOYER",
        ["2026-06-05", "2026-07-05", "2026-08-05"],
        900,
        "cat-rent",
        "Housing",
      ),
    ]);

    // 900 x 12 beats 10 x 52.
    expect(proposals.map((p) => p.key)).toEqual(["loyer", "bitstack"]);
  });
});

describe("filterLiveProposals", () => {
  const monthly = detectRecurring(
    run("FREE TELECOM", ["2026-06-08", "2026-07-08", "2026-08-08"], 29.99),
  );

  it("drops a charge that has plainly lapsed", () => {
    expect(filterLiveProposals(monthly, "2027-01-01", new Set())).toEqual([]);
  });

  it("keeps one that is still running", () => {
    expect(filterLiveProposals(monthly, "2026-09-10", new Set())).toHaveLength(
      1,
    );
  });

  it("says nothing about a merchant already covered by a template", () => {
    expect(
      filterLiveProposals(monthly, "2026-09-10", new Set(["free telecom"])),
    ).toEqual([]);
  });
});
