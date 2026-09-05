import { describe, expect, it } from "vitest";

import {
  describeSelectionDeletion,
  describeSelectionMove,
  planSelectionMove,
  pruneSelection,
  selectAllState,
  summarizeSelection,
  toggleSelectAll,
  toggleSelected,
} from "./selection";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function tx(
  id: string,
  amount: number,
  type: CategoryType = "expense",
  templateId: string | null = null,
): TransactionWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: "cat-1",
    recurring_template_id: templateId,
    occurred_on: "2026-09-01",
    amount,
    note: null,
    created_at: "2026-09-01T10:00:00.000Z",
    categories: {
      name: "Groceries",
      type,
      icon: null,
      counts_toward_summary: true,
    },
  };
}

const rows = [
  tx("a", 10),
  tx("b", 20, "income"),
  tx("c", 30, "expense", "tpl-1"),
  tx("d", 40, "savings", "tpl-2"),
];

describe("summarizeSelection", () => {
  it("counts and totals the selected rows only", () => {
    const summary = summarizeSelection(rows, new Set(["a", "b"]));
    expect(summary.count).toBe(2);
    expect(summary.total).toBe(30);
  });

  it("counts how many come from a recurring template", () => {
    const summary = summarizeSelection(rows, new Set(["a", "c", "d"]));
    expect(summary.recurringCount).toBe(2);
    expect(summary.allRecurring).toBe(false);
  });

  it("flags a selection that is entirely recurring", () => {
    expect(summarizeSelection(rows, new Set(["c", "d"])).allRecurring).toBe(
      true,
    );
  });

  it("breaks the selection down by type", () => {
    const summary = summarizeSelection(rows, new Set(["a", "b", "d"]));
    expect(summary.byType).toEqual({
      expense: 1,
      income: 1,
      savings: 1,
      investment: 0,
    });
  });

  it("is empty for an empty selection", () => {
    const summary = summarizeSelection(rows, new Set());
    expect(summary.count).toBe(0);
    expect(summary.allRecurring).toBe(false);
  });

  it("ignores ids that are not in the list", () => {
    expect(summarizeSelection(rows, new Set(["ghost"])).count).toBe(0);
  });

  it("rounds the total to cents", () => {
    const summary = summarizeSelection(
      [tx("x", 10.005), tx("y", 0.005)],
      new Set(["x", "y"]),
    );
    expect(summary.total).toBe(10.01);
  });
});

describe("toggleSelected", () => {
  it("adds an unselected id", () => {
    expect([...toggleSelected(new Set(["a"]), "b")]).toEqual(["a", "b"]);
  });

  it("removes a selected id", () => {
    expect([...toggleSelected(new Set(["a", "b"]), "a")]).toEqual(["b"]);
  });

  it("does not mutate the set it is given", () => {
    const original = new Set(["a"]);
    toggleSelected(original, "b");
    expect([...original]).toEqual(["a"]);
  });
});

describe("selectAllState", () => {
  it("reports none, some and all", () => {
    expect(selectAllState(["a", "b"], new Set())).toBe("none");
    expect(selectAllState(["a", "b"], new Set(["a"]))).toBe("some");
    expect(selectAllState(["a", "b"], new Set(["a", "b"]))).toBe("all");
  });

  it("reports none for an empty list", () => {
    expect(selectAllState([], new Set(["a"]))).toBe("none");
  });

  it("ignores selected rows that are not visible", () => {
    expect(selectAllState(["a"], new Set(["a", "hidden"]))).toBe("all");
  });
});

describe("toggleSelectAll", () => {
  it("selects everything visible when nothing is selected", () => {
    expect([...toggleSelectAll(["a", "b"], new Set())].sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("completes a partial selection", () => {
    expect([...toggleSelectAll(["a", "b"], new Set(["a"]))].sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("clears when everything visible is already selected", () => {
    expect([...toggleSelectAll(["a", "b"], new Set(["a", "b"]))]).toEqual([]);
  });

  it("leaves rows hidden by a filter alone", () => {
    // "hidden" is selected but not on screen; select-all must not drop it.
    const next = toggleSelectAll(["a"], new Set(["hidden"]));
    expect(next.has("hidden")).toBe(true);
    expect(next.has("a")).toBe(true);
  });

  it("clearing also leaves hidden rows alone", () => {
    const next = toggleSelectAll(["a"], new Set(["a", "hidden"]));
    expect(next.has("hidden")).toBe(true);
    expect(next.has("a")).toBe(false);
  });
});

describe("pruneSelection", () => {
  it("drops ids that are no longer available", () => {
    expect([...pruneSelection(new Set(["a", "gone"]), ["a", "b"])]).toEqual([
      "a",
    ]);
  });

  it("returns an empty set when nothing survives", () => {
    expect([...pruneSelection(new Set(["gone"]), ["a"])]).toEqual([]);
  });
});

describe("describeSelectionDeletion", () => {
  function describe_(ids: string[]) {
    return describeSelectionDeletion(summarizeSelection(rows, new Set(ids)));
  }

  it("says nothing when nothing is selected", () => {
    expect(describe_([])).toBeNull();
  });

  it("warns that deletion is permanent for one-offs", () => {
    expect(describe_(["a"])).toBe(
      "Delete 1 transaction? This cannot be undone.",
    );
  });

  it("pluralises", () => {
    expect(describe_(["a", "b"])).toContain("Delete 2 transactions?");
  });

  it("warns that a single recurring entry will come back", () => {
    const text = describe_(["c"])!;
    expect(text).toContain("It comes from recurring templates");
    expect(text).toContain("recreate it");
  });

  it("warns for an all-recurring selection", () => {
    const text = describe_(["c", "d"])!;
    expect(text).toContain("They come from recurring templates");
    expect(text).toContain("recreate them");
  });

  it("counts the recurring subset in a mixed selection", () => {
    expect(describe_(["a", "c", "d"])).toContain(
      "2 of them come from recurring templates",
    );
  });
});

/* ------------------------------------------------ moving a selection */

/** A row with a merchant note and a date, which the move logic needs. */
function shop(
  id: string,
  note: string,
  occurredOn: string,
  categoryId = "cat-1",
  type: CategoryType = "expense",
  templateId: string | null = null,
): TransactionWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: categoryId,
    recurring_template_id: templateId,
    occurred_on: occurredOn,
    amount: 10,
    note,
    created_at: `${occurredOn}T10:00:00.000Z`,
    categories: {
      name: "Groceries",
      type,
      icon: null,
      counts_toward_summary: true,
    },
  };
}

const GROCERIES = { id: "cat-1", type: "expense" as CategoryType };
const BROKER = { id: "cat-9", type: "investment" as CategoryType };

describe("planSelectionMove", () => {
  it("counts the rows whose kind of category changes", () => {
    const effect = planSelectionMove(rows, new Set(["a", "b", "d"]), BROKER);

    // All three are expense/income/savings, none of them investment.
    expect(effect.typeChanges).toBe(3);
  });

  it("counts no type change when the target is the same kind", () => {
    const effect = planSelectionMove(rows, new Set(["a", "c"]), GROCERIES);

    expect(effect.typeChanges).toBe(0);
  });

  it("reports a merchant it will teach, when the newest row is selected", () => {
    const history = [
      shop("old", "CARREFOUR PARIS", "2026-07-04"),
      shop("new", "CARREFOUR PARIS", "2026-09-01"),
    ];

    const effect = planSelectionMove(history, new Set(["old", "new"]), BROKER);

    expect(effect.rulesRewritten).toEqual(["CARREFOUR PARIS"]);
    expect(effect.rulesLeftBehind).toEqual([]);
  });

  it("reports a merchant left behind when a newer row is not selected", () => {
    // The whole point of the feature: the merchant index keeps the category
    // of the most recent transaction, so fixing only the old ones is undone
    // by the next bank sync, silently.
    const history = [
      shop("old", "CARREFOUR PARIS", "2026-07-04"),
      shop("newer", "CARREFOUR PARIS", "2026-09-01"),
    ];

    const effect = planSelectionMove(history, new Set(["old"]), BROKER);

    expect(effect.rulesLeftBehind).toEqual(["CARREFOUR PARIS"]);
    expect(effect.rulesRewritten).toEqual([]);
  });

  it("treats differently-spelled rows as the same shop", () => {
    // Same normalisation the merchant index uses, so the two cannot disagree.
    const history = [
      shop("old", "carrefour  paris", "2026-07-04"),
      shop("new", "CARREFOUR PARIS", "2026-09-01"),
    ];

    const effect = planSelectionMove(history, new Set(["old"]), BROKER);

    expect(effect.rulesLeftBehind).toHaveLength(1);
  });

  it("says nothing about a merchant already filed to the target", () => {
    const history = [shop("a", "CARREFOUR", "2026-09-01", "cat-9")];

    const effect = planSelectionMove(history, new Set(["a"]), BROKER);

    expect(effect.rulesRewritten).toEqual([]);
    expect(effect.rulesLeftBehind).toEqual([]);
  });

  it("ignores rows with no merchant to key on", () => {
    const effect = planSelectionMove(rows, new Set(["a"]), BROKER);

    expect(effect.rulesRewritten).toEqual([]);
    expect(effect.rulesLeftBehind).toEqual([]);
  });

  it("counts rows a template will keep filing its own way", () => {
    const effect = planSelectionMove(rows, new Set(["c", "d"]), BROKER);

    expect(effect.recurringCount).toBe(2);
  });
});

describe("describeSelectionMove", () => {
  const summaryOf = (ids: string[], list = rows) =>
    summarizeSelection(list, new Set(ids));

  it("says nothing when nothing unusual will happen", () => {
    // Most moves are one category to another of the same kind. A sentence
    // confirming that nothing happens is a sentence nobody reads.
    const effect = planSelectionMove(rows, new Set(["a"]), GROCERIES);

    expect(
      describeSelectionMove(effect, summaryOf(["a"]), "Groceries"),
    ).toBeNull();
  });

  it("says nothing for an empty selection", () => {
    const effect = planSelectionMove(rows, new Set(), BROKER);

    expect(describeSelectionMove(effect, summaryOf([]), "Broker")).toBeNull();
  });

  it("warns that past months will change when the kind changes", () => {
    const effect = planSelectionMove(rows, new Set(["a"]), BROKER);
    const sentence = describeSelectionMove(effect, summaryOf(["a"]), "Broker");

    expect(sentence).toContain("unrecorded spending");
  });

  it("names the merchants that will keep being filed the old way", () => {
    // Filed somewhere else today, so moving them to Groceries is a real
    // change and the merchant rule is genuinely in play.
    const history = [
      shop("old", "CARREFOUR", "2026-07-04", "cat-wrong"),
      shop("newer", "CARREFOUR", "2026-09-01", "cat-wrong"),
    ];
    const effect = planSelectionMove(history, new Set(["old"]), GROCERIES);
    const sentence = describeSelectionMove(
      effect,
      summaryOf(["old"], history),
      "Groceries",
    );

    expect(sentence).toContain("CARREFOUR");
    expect(sentence).toContain("still be filed the old way");
  });

  it("prefers the warning to the reassurance when both apply", () => {
    // One merchant taught, one left behind. The one that will surprise the
    // user later is the one worth the space.
    const history = [
      shop("taught", "MONOPRIX", "2026-09-02", "cat-wrong"),
      shop("old", "CARREFOUR", "2026-07-04", "cat-wrong"),
      shop("newer", "CARREFOUR", "2026-09-01", "cat-wrong"),
    ];
    const effect = planSelectionMove(
      history,
      new Set(["taught", "old"]),
      GROCERIES,
    );
    const sentence = describeSelectionMove(
      effect,
      summaryOf(["taught", "old"], history),
      "Groceries",
    );

    expect(sentence).toContain("CARREFOUR");
    expect(sentence).not.toContain("From now on");
  });
});
