import { describe, expect, it } from "vitest";

import { translator } from "./i18n/t";
import type { CloseableMonth, MonthCloseResult } from "./month-close";
import { closeReminder, monthClosedByBank } from "./push-messages";

const fr = { t: translator("fr"), locale: "fr" as const };

const september: CloseableMonth = {
  year: 2026,
  month: 9,
  monthKey: "2026-09",
  label: "septembre 2026",
  observeOn: "2026-10-05",
  isBaseline: false,
};

describe("closeReminder", () => {
  it("speaks on the reading day, naming the month", () => {
    const push = closeReminder({
      ...fr,
      next: september,
      today: "2026-10-05",
      closesSoFar: 3,
      streak: 0,
    });
    expect(push?.kind).toBe("close");
    expect(push?.key).toBe("close:2026-09");
    expect(push?.title).toContain("septembre");
  });

  it("mentions the run when there is one", () => {
    const push = closeReminder({
      ...fr,
      next: september,
      today: "2026-10-06",
      closesSoFar: 3,
      streak: 3,
    });
    expect(push?.body).toContain("3 mois");
  });

  it("says nothing before the reading day, for a first close, or with nothing due", () => {
    const base = { ...fr, closesSoFar: 3, streak: 0 };
    expect(
      closeReminder({ ...base, next: september, today: "2026-10-04" }),
    ).toBeNull();
    expect(
      closeReminder({
        ...base,
        next: { ...september, isBaseline: true },
        today: "2026-10-05",
      }),
    ).toBeNull();
    expect(
      closeReminder({
        ...base,
        closesSoFar: 0,
        next: september,
        today: "2026-10-05",
      }),
    ).toBeNull();
    expect(
      closeReminder({ ...base, next: null, today: "2026-10-05" }),
    ).toBeNull();
  });
});

function result(overrides: Partial<MonthCloseResult>): MonthCloseResult {
  return {
    status: "reconciled",
    openingBalance: 1000,
    closingBalance: 1200,
    flows: { income: 2000, expenses: 1500, savings: 100, transfers: 0 },
    kept: 300,
    keptRate: 15,
    unrecorded: 0,
    unexplainedCredit: null,
    ...overrides,
  };
}

describe("monthClosedByBank", () => {
  it("says what the month left", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({}),
    });
    expect(push.key).toBe("closed:2026-09");
    expect(push.body).toContain("300");
    expect(push.body).not.toContain("non notées");
  });

  it("adds the unrecorded spending when there was some", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({ unrecorded: 85 }),
    });
    expect(push.body).toContain("85");
    expect(push.body).toContain("non notées");
  });

  it("says a month that cost more than it brought plainly", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({ kept: -120 }),
    });
    expect(push.body).toContain("120");
    expect(push.body).not.toContain("−120");
  });

  it("calls a first close the starting point", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({ status: "baseline", kept: null, unrecorded: null }),
    });
    expect(push.body).toContain("point de départ");
  });
});
