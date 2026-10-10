import { describe, expect, it } from "vitest";

import { askTitle, renderAskSentences } from "./ask";
import type { MonthFact } from "./month-facts";

const groceries: MonthFact = {
  id: "spent:2026-03:c1",
  label: "Courses, mars 2026",
  unit: "money",
  value: 218,
  sense: "up-is-bad",
};

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
