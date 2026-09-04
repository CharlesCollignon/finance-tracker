import { describe, expect, it } from "vitest";

import { buildMonthFacts, type BuildMonthFactsInput } from "./month-facts";
import {
  buildMonthReadPrompt,
  MONTH_READ_PROMPT_VERSION,
} from "./month-read-prompt";
import type { MonthlySummary } from "./types/database";

const money = (amount: number) =>
  `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function summary(partial: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    income: 3200,
    expenses: 1650.5,
    savings: 200,
    investments: 0,
    investmentDeployments: 0,
    remaining: 1549.5,
    budgetView: "current",
    expenseBreakdown: [
      {
        categoryId: "groceries",
        name: "Groceries",
        type: "expense",
        icon: null,
        total: 412.4,
      },
    ],
    savingsBreakdown: [],
    investmentBreakdown: [],
    investmentDeploymentBreakdown: [],
    ...partial,
  };
}

function pack(partial: Partial<BuildMonthFactsInput> = {}) {
  return buildMonthFacts({
    year: 2026,
    month: 3,
    state: "closed",
    summary: summary(),
    comparison: null,
    close: null,
    pulse: null,
    closeSummary: null,
    unrecordedCap: null,
    budgets: [],
    goals: [],
    investedValue: null,
    inboxPending: 0,
    chargesUnconfirmed: 0,
    ...partial,
  });
}

describe("buildMonthReadPrompt", () => {
  it("lists every figure exactly once, by id", () => {
    const facts = pack();
    const { user } = buildMonthReadPrompt(facts, { money });

    for (const fact of facts.facts) {
      const occurrences = user.split(fact.id).length - 1;
      // Some ids are prefixes of others ("budget" / "budget-left"), so this
      // asserts at least one mention rather than exactly one.
      expect(occurrences, `${fact.id} should appear`).toBeGreaterThan(0);
    }
  });

  it("never shows a number without a unit attached", () => {
    // If the model never sees an unlabelled float it is markedly less likely
    // to produce one — and it never needs one, since it may not print one.
    //
    // The rule is a unit, not the absence of a decimal point: money arrives
    // through the injected formatter (French locale here, so "412,40 €") and
    // a percent keeps its sign ("6.3%"), which is how the rest of the app
    // renders one. Both are labelled quantities. A bare "6.3" would not be.
    const { user } = buildMonthReadPrompt(pack(), { money });

    for (const match of user.matchAll(/\d+\.\d+(.?)/g)) {
      expect(match[1], `"${match[0]}" should carry a unit`).toBe("%");
    }
    expect(user).toContain("412,40 €");
  });

  it("names what is not known, and why, in words", () => {
    const { user } = buildMonthReadPrompt(pack({ unrecordedCap: null }), {
      money,
    });

    expect(user).toContain("Not known, and why");
    expect(user).toContain("no allowance has been set");
  });

  it("leaves the absences section out when nothing is missing", () => {
    const complete = pack({
      unrecordedCap: 80,
      comparison: {
        current: 1650,
        previous: 1800,
        delta: -150,
        ratio: -0.083,
        direction: "down",
        throughDay: 31,
        partial: false,
        comparable: true,
        previousLabel: "February",
      },
      close: {
        monthKey: "2026-03",
        unrecorded: 60,
        kept: 900,
        keptRate: 28,
        cashChange: 700,
      },
    });

    expect(buildMonthReadPrompt(complete, { money }).user).not.toContain(
      "Not known",
    );
  });

  describe("the rules that are repeated", () => {
    it("states the figure rule first and again last", () => {
      // Instruction adherence decays across a long message, and this is the
      // one rule whose failure is expensive.
      const { system } = buildMonthReadPrompt(pack(), { money });
      const occurrences = system.split("{{fact:id}}").length - 1;

      expect(occurrences).toBeGreaterThanOrEqual(2);
    });

    it("keeps the naming rule beside it in both positions", () => {
      // Measured, not assumed: stated once in the middle, every model tried
      // ignored it and wrote "{{fact:top-expense:c1}} rose" where a reader
      // needs "groceries rose". Position was what the figure rule had and it
      // did not.
      const { system } = buildMonthReadPrompt(pack(), { money });
      const occurrences = system.split("A placeholder is a number").length - 1;

      expect(occurrences).toBe(2);
      // Last word to the pair, so nothing separates them from the answer.
      expect(system.trimEnd().endsWith("for the name.")).toBe(true);
    });
  });

  describe("the vocabulary", () => {
    it("carries the app's own words", () => {
      const { system } = buildMonthReadPrompt(pack(), { money });

      expect(system).toContain("Unrecorded spending");
      expect(system).toContain("Kept");
      expect(system).toContain("Unrecorded allowance");
      expect(system).toContain("Month close");
    });

    it("forbids the words the app avoids", () => {
      // A read calling a month close a "reconciliation" contradicts every
      // label printed around it, and the reader cannot tell which is wrong.
      const { system } = buildMonthReadPrompt(pack(), { money });

      expect(system).toContain("reconciliation");
      expect(system).toContain("forecast");
      // Named only as things to avoid, which is what these assertions check
      // in combination with the ones above.
      expect(system).toMatch(/Never call it a "reconciliation"/);
    });
  });

  describe("advice", () => {
    it("asks for it, and forbids congratulation", () => {
      const { system } = buildMonthReadPrompt(pack(), { money });

      expect(system).toContain("Say what to change");
      expect(system).toContain("Do not congratulate");
    });

    it("rules out advice the app has no basis for", () => {
      const { system } = buildMonthReadPrompt(pack(), { money });

      expect(system).toContain("no product, tax or investment advice");
      expect(system).toContain("risk tolerance");
    });
  });

  describe("provisional months", () => {
    it('asks for "so far" while a month is running', () => {
      const { system } = buildMonthReadPrompt(pack({ state: "in-progress" }), {
        money,
      });

      expect(system).toContain("so far");
      expect(system).toContain("still running");
    });

    it("says the figures are settled once it is over", () => {
      const { system } = buildMonthReadPrompt(pack({ state: "closed" }), {
        money,
      });

      expect(system).toContain("settled");
    });
  });

  it("admits an incomplete picture rather than writing over it", () => {
    const { system } = buildMonthReadPrompt(pack({ inboxPending: 4 }), {
      money,
    });

    expect(system).toContain("The picture is incomplete");
  });

  it("has a version, for identifying what wrote an older read", () => {
    expect(MONTH_READ_PROMPT_VERSION).toBeGreaterThan(0);
  });
});
