import { describe, expect, it } from "vitest";

import { buildCategoryScreen, type StoredReadInput } from "./category-screen";
import { findingsDigest } from "./category-selection";
import type { CategoryType, TransactionWithCategory } from "./types/database";

function tx(
  occurredOn: string,
  amount: number,
  categoryId = "cat-groceries",
  name = "Courses",
  type: CategoryType = "expense",
): TransactionWithCategory {
  return {
    id: `tx-${occurredOn}-${amount}-${categoryId}`,
    user_id: "u",
    category_id: categoryId,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T00:00:00.000Z`,
    cash_on: null,
    deleted_at: null,
    categories: { name, type, icon: null, counts_toward_summary: true },
  };
}

/** A year of groceries at 300, and a rent at 900 every month. */
function year(): TransactionWithCategory[] {
  const rows: TransactionWithCategory[] = [];
  for (let month = 1; month <= 10; month += 1) {
    const day = `2026-${String(month).padStart(2, "0")}-05`;
    rows.push(tx(day, 300));
    rows.push(tx(day, 900, "cat-rent", "Loyer"));
  }
  return rows;
}

const NO_READS = new Map<string, StoredReadInput>();

describe("buildCategoryScreen", () => {
  it("orders the cards by what their tiles draw, and pools this month's spending", () => {
    const screen = buildCategoryScreen({
      rows: year(),
      year: 2026,
      month: 10,
      locale: "fr",
      storedReads: NO_READS,
      storedSelection: null,
      monthExpenses: null,
    });

    expect(screen.cards.map((card) => card.history.name)).toEqual([
      "Loyer",
      "Courses",
    ]);
    expect(screen.cards[0]!.drawn).toHaveLength(12);
    expect(screen.breakdownTotal).toBe(1_200);
    expect(screen.rerankState).toBe("none");
    expect(screen.behind["cat-rent"]).toEqual([
      expect.objectContaining({ occurredOn: "2026-10-05", amount: 900 }),
    ]);
    expect(screen.behindMonth["cat-rent"]).toBe("2026-10");
  });

  it("refuses a stored order whose findings have since moved, and says so", () => {
    const rows = [...year(), tx("2026-10-20", 1_500)];
    const input = {
      rows,
      year: 2026,
      month: 10,
      locale: "fr" as const,
      storedReads: NO_READS,
      monthExpenses: null,
    };
    const fresh = buildCategoryScreen({ ...input, storedSelection: null });
    const picks = fresh.allFindings.map((finding) => ({ id: finding.id }));

    const applied = buildCategoryScreen({
      ...input,
      storedSelection: {
        selection: { picks },
        digest: findingsDigest(fresh.allFindings),
        locale: "fr",
      },
    });
    const stale = buildCategoryScreen({
      ...input,
      storedSelection: { selection: { picks }, digest: "old", locale: "fr" },
    });

    expect(picks.length).toBeGreaterThan(0);
    expect(applied.rerankState).toBe("applied");
    expect(stale.rerankState).toBe("stale");
    expect(stale.findings).toEqual(fresh.allFindings);
  });
});
