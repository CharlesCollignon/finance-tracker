import { describe, expect, it } from "vitest";

import {
  askTitle,
  buildAskAnswerRequest,
  buildAskPlanRequest,
  chargeFacts,
  cushionFacts,
  givesAdvice,
  loanFacts,
  renderAskSentences,
  spendingFacts,
  verifyAskAnswer,
  verifyAskPlan,
} from "./ask";
import type { MonthFact } from "./month-facts";

const groceries: MonthFact = {
  id: "spent:2026-03:c1",
  label: "Courses, mars 2026",
  unit: "money",
  value: 218,
  sense: "up-is-bad",
};
const pack = { facts: [groceries] };

describe("verifyAskPlan", () => {
  it("keeps three families at most, once each", () => {
    expect(
      verifyAskPlan({
        kind: "facts",
        tools: ["month", "spending", "month", "charges", "loans"],
        search: "",
        advice: false,
      }),
    ).toEqual({
      kind: "facts",
      tools: ["month", "spending", "charges"],
      search: null,
      advice: false,
    });
  });

  it("refuses a search with nothing to look for, and what is not a plan", () => {
    expect(
      verifyAskPlan({ kind: "search", tools: [], search: "  ", advice: false }),
    ).toBeNull();
    expect(verifyAskPlan({ kind: "facts", tools: ["shops"] })).toBeNull();
  });

  it("keeps the shop a search is for", () => {
    expect(
      verifyAskPlan({
        kind: "search",
        tools: ["month"],
        search: " Carrefour ",
        advice: false,
      }),
    ).toMatchObject({ kind: "search", search: "Carrefour" });
  });
});

describe("verifyAskAnswer", () => {
  it("keeps a sentence whose every figure is the app's", () => {
    expect(
      verifyAskAnswer(
        {
          sentences: [
            {
              text: "Vos courses ont coûté {{fact:spent:2026-03:c1}} en mars.",
              basis: ["spent:2026-03:c1"],
            },
          ],
        },
        pack,
      ),
    ).toEqual({
      ok: true,
      sentences: ["Vos courses ont coûté {{fact:spent:2026-03:c1}} en mars."],
      dropped: 0,
    });
  });

  it("drops a sentence that writes a number, cites the unknown, or advises", () => {
    const verdict = verifyAskAnswer(
      {
        sentences: [
          { text: "Vous avez dépensé 218 € en courses.", basis: [] },
          { text: "Le loyer vaut {{fact:rent}}.", basis: ["rent"] },
          {
            text: "Vous devriez réduire les courses à {{fact:spent:2026-03:c1}}.",
            basis: ["spent:2026-03:c1"],
          },
          {
            text: "Les courses représentent {{fact:spent:2026-03:c1}}.",
            basis: ["spent:2026-03:c1"],
          },
        ],
      },
      pack,
    );
    expect(verdict).toEqual({
      ok: true,
      sentences: ["Les courses représentent {{fact:spent:2026-03:c1}}."],
      dropped: 3,
    });
  });

  it("has no answer when nothing honest is left", () => {
    expect(
      verifyAskAnswer(
        { sentences: [{ text: "You should repay it.", basis: [] }] },
        pack,
      ),
    ).toEqual({ ok: false, reason: "nothing-left" });
    expect(verifyAskAnswer({ answer: "hi" }, pack)).toEqual({
      ok: false,
      reason: "shape",
    });
  });
});

describe("givesAdvice", () => {
  it.each([
    "Vous devriez rembourser votre prêt.",
    "Je vous conseille de placer cette somme.",
    "Il serait judicieux d'attendre.",
    "You should pay it off early.",
    "I would recommend keeping it.",
    "Consider repaying the loan.",
  ])("hears advice in « %s »", (sentence) => {
    expect(givesAdvice(sentence)).toBe(true);
  });

  it("hears none in a statement of fact", () => {
    expect(givesAdvice("Il reste {{fact:loan:l1:owed}} à rembourser.")).toBe(
      false,
    );
  });
});

describe("the figures", () => {
  it("names the largest categories month by month, with each month's total", () => {
    const facts = spendingFacts(
      [{ key: "2026-03", label: "mars 2026" }],
      [
        {
          monthKey: "2026-03",
          categoryId: "c1",
          category: "Courses",
          total: 218,
        },
        {
          monthKey: "2026-03",
          categoryId: "c2",
          category: "Loyer",
          total: 850,
        },
      ],
      {
        total: (month) => `Dépenses, ${month}`,
        category: (name, month) => `${name}, ${month}`,
      },
    );
    expect(facts.map((fact) => [fact.id, fact.value])).toEqual([
      ["spent:2026-03", 1068],
      ["spent:2026-03:c1", 218],
      ["spent:2026-03:c2", 850],
    ]);
  });

  it("sums the recurring entries each way", () => {
    const facts = chargeFacts(
      [
        { id: "t1", name: "Loyer", monthly: 850, income: false },
        { id: "t2", name: "Salaire", monthly: 3200, income: true },
      ],
      { charge: (name) => name, out: "Sorties", in: "Entrées" },
    );
    expect(facts.find((fact) => fact.id === "charges-out")?.value).toBe(850);
    expect(facts.find((fact) => fact.id === "charges-in")?.value).toBe(3200);
  });

  it("counts the cushion in months only with fixed costs to divide by", () => {
    const words = { savings: "Épargne", months: "Mois couverts" };
    expect(cushionFacts(6000, 2000, words).map((fact) => fact.value)).toEqual([
      6000, 3,
    ]);
    expect(cushionFacts(6000, 0, words)).toHaveLength(1);
  });

  it("says each loan's facts, not what to do about it", () => {
    const facts = loanFacts(
      [
        {
          id: "l1",
          name: "Prêt immobilier",
          owed: 112400,
          rate: 1.45,
          monthly: 690,
          interestLeft: 12850.456,
          monthsLeft: 180,
        },
      ],
      {
        owed: (name) => `${name}, restant dû`,
        rate: (name) => `${name}, taux`,
        monthly: (name) => `${name}, mensualité`,
        interestLeft: (name) => `${name}, intérêts restants`,
        monthsLeft: (name) => `${name}, mois restants`,
      },
    );
    expect(facts.map((fact) => fact.id)).toEqual([
      "loan:l1:owed",
      "loan:l1:rate",
      "loan:l1:monthly",
      "loan:l1:interest-left",
      "loan:l1:months-left",
    ]);
    expect(facts[3]!.value).toBe(12850.46);
  });
});

describe("the requests", () => {
  it("routes with the question as typed and the families by name", () => {
    const request = buildAskPlanRequest("Combien chez Carrefour ?", "fr");
    expect(request.user).toBe("Combien chez Carrefour ?");
    expect(request.system).toContain("- loans:");
  });

  it("answers with the figures listed, and says what advice is", () => {
    const request = buildAskAnswerRequest("Dois-je rembourser ?", pack, {
      money: (amount) => `${amount} €`,
      locale: "fr",
      advice: true,
    });
    expect(request.user).toContain(
      "spent:2026-03:c1 | Courses, mars 2026 | 218 €",
    );
    expect(request.system).toContain("Cette question demande un conseil.");
  });
});

describe("rendering", () => {
  it("writes the app's figure into each sentence", () => {
    const segments = renderAskSentences(
      {
        kind: "facts",
        sentences: ["Courses : {{fact:spent:2026-03:c1}}."],
        facts: [groceries],
        advice: false,
        locale: "fr",
        model: "m",
      },
      (amount) => `${amount} €`,
    );
    expect(
      segments[0]!.find((segment) => segment.kind === "figure"),
    ).toMatchObject({ display: "218 €" });
  });

  it("titles a conversation with its first question, cut short", () => {
    expect(askTitle("  Combien   ai-je ?  ")).toBe("Combien ai-je ?");
    expect(askTitle("x".repeat(100))).toHaveLength(80);
  });
});
