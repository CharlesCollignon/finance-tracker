import { describe, expect, it } from "vitest";

import {
  detectRecurring,
  filterLiveProposals,
  proposalCadence,
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

describe("detectRecurring, months apart", () => {
  it("finds a quarterly charge and the months it falls in", () => {
    const [proposal] = detectRecurring(
      run(
        "PRLV SEPA VEOLIA EAU",
        ["2026-01-12", "2026-04-13", "2026-07-11", "2026-10-12"],
        87.4,
      ),
    );
    expect(proposal).toMatchObject({
      recurrence: "monthly",
      months: [1, 4, 7, 10],
      dayOfMonth: 12,
    });
    expect(proposalCadence(proposal!, "fr")).toBe("chaque trimestre");
  });

  it("finds one every two months", () => {
    const [proposal] = detectRecurring(
      run(
        "PRLV SEPA ENGIE",
        ["2026-03-05", "2026-05-05", "2026-07-06", "2026-09-04"],
        64,
      ),
    );
    expect(proposal).toMatchObject({
      recurrence: "monthly",
      months: [1, 3, 5, 7, 9, 11],
    });
  });

  it("finds one every six months", () => {
    const [proposal] = detectRecurring(
      run("MAIF HABITATION", ["2025-04-02", "2025-10-02", "2026-04-02"], 210),
    );
    expect(proposal).toMatchObject({ recurrence: "monthly", months: [4, 10] });
    expect(proposalCadence(proposal!, "en")).toBe("every 6 months");
  });

  it("finds the months a monthly run skips every year", () => {
    // Tax taken from January to October, two years running.
    const dates = [2025, 2026].flatMap((year) =>
      Array.from(
        { length: 10 },
        (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-15`,
      ),
    );
    const [proposal] = detectRecurring(run("DGFIP IMPOT", dates, 240));
    expect(proposal).toMatchObject({
      recurrence: "monthly",
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    expect(proposalCadence(proposal!, "fr")).toBe(
      "chaque mois sauf nov., déc.",
    );
  });

  it("does not call a month skipped once a month it always skips", () => {
    // Fourteen months with August missing in 2025 only: not a habit, and
    // the months it keeps were mostly seen once.
    const dates = [
      "2025-06-03",
      "2025-07-03",
      "2025-09-03",
      "2025-10-03",
      "2025-11-03",
      "2025-12-03",
      "2026-01-03",
      "2026-02-03",
      "2026-03-03",
      "2026-04-03",
      "2026-05-03",
      "2026-06-03",
      "2026-07-03",
      "2026-08-03",
    ];
    const [proposal] = detectRecurring(run("NETFLIX", dates, 13.49));
    expect(proposal).toMatchObject({ recurrence: "monthly", months: null });
  });

  it("does not read one missed month in a short run as a skipped one", () => {
    // March 2026 missed, every other month of a year and a bit paid.
    const dates = [
      "2025-06-03",
      "2025-07-03",
      "2025-08-04",
      "2025-09-03",
      "2025-10-03",
      "2025-11-03",
      "2025-12-03",
      "2026-01-05",
      "2026-02-03",
      "2026-04-03",
      "2026-05-04",
      "2026-06-03",
      "2026-07-03",
    ];
    const [proposal] = detectRecurring(run("SFR BOX", dates, 32));
    expect(proposal).toMatchObject({ recurrence: "monthly", months: null });
  });

  it("finds a grant paid from September to June", () => {
    const dates = [2024, 2025].flatMap((year) => [
      ...[9, 10, 11, 12].map((m) => `${year}-${String(m).padStart(2, "0")}-05`),
      ...[1, 2, 3, 4, 5, 6].map((m) => `${year + 1}-0${m}-05`),
    ]);
    const [proposal] = detectRecurring(run("CROUS LOYER", dates, 120));
    expect(proposal).toMatchObject({
      months: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12],
    });
  });

  it("weighs a quarterly charge by what it costs a year", () => {
    const proposals = detectRecurring([
      ...run(
        "PRLV SEPA VEOLIA EAU",
        ["2026-01-12", "2026-04-13", "2026-07-11"],
        90,
      ),
      ...run("SPOTIFY", ["2026-05-02", "2026-06-02", "2026-07-02"], 11),
    ]);
    // 4 × 90 = 360 a year against 12 × 11 = 132.
    expect(proposals.map((p) => p.key)).toEqual([
      proposals.find((p) => p.months !== null)!.key,
      proposals.find((p) => p.months === null)!.key,
    ]);
  });
});

describe("filterLiveProposals, months apart", () => {
  const quarterly = detectRecurring(
    run(
      "PRLV SEPA VEOLIA EAU",
      ["2026-01-12", "2026-04-13", "2026-07-11"],
      87.4,
    ),
  );

  it("keeps a quarterly charge between two of its payments", () => {
    expect(
      filterLiveProposals(quarterly, "2026-10-01", new Set()),
    ).toHaveLength(1);
  });

  it("drops it once a payment is plainly missed", () => {
    expect(filterLiveProposals(quarterly, "2026-12-15", new Set())).toEqual([]);
  });
});
