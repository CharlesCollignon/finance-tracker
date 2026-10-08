import { describe, expect, it } from "vitest";

import { isJointTransferCategory, withMyShare } from "./my-share";
import type { TransactionWithCategory } from "./types/database";

function tx(
  id: string,
  categoryId: string,
  name: string,
  amount: number,
  type: "expense" | "income" = "expense",
): TransactionWithCategory {
  return {
    id,
    category_id: categoryId,
    amount,
    occurred_on: "2026-10-05",
    categories: { name, type, icon: null, counts_toward_summary: true },
  } as TransactionWithCategory;
}

describe("withMyShare", () => {
  const personal = [
    tx("p1", "mine-groceries", "Courses", 40),
    tx("p2", "mine-transfer", "Versement au compte commun", 600),
    tx("p3", "mine-salary", "Salaire", 2500, "income"),
  ];
  const joint = [
    tx("j1", "joint-groceries", "courses ", 120),
    tx("j2", "joint-rent", "Loyer", 900),
    tx("j3", "joint-in", "Versements", 1200, "income"),
  ];

  it("takes the transfers out and puts the person's part of the space's spending in", () => {
    const rows = withMyShare(personal, joint, 0.4);
    expect(rows.map((row) => [row.category_id, row.amount])).toEqual([
      ["mine-groceries", 40],
      ["mine-salary", 2500],
      // Under the person's own « Courses », the names matching loosely.
      ["mine-groceries", 48],
      // A joint category the person has no twin of keeps its own.
      ["joint-rent", 360],
    ]);
  });

  it("leaves the space's income out: it is the partners' transfers coming in", () => {
    expect(withMyShare([], joint, 0.5).some((row) => row.id === "j3")).toBe(
      false,
    );
  });

  it("holds a part between nothing and the whole", () => {
    expect(withMyShare([], joint, 2).map((row) => row.amount)).toEqual([
      120, 900,
    ]);
    expect(withMyShare([], joint, -1)).toEqual([]);
  });

  it("knows the transfer category in either language", () => {
    expect(isJointTransferCategory("Versement au compte commun")).toBe(true);
    expect(isJointTransferCategory("Transfer to the joint account")).toBe(true);
    expect(isJointTransferCategory("Courses")).toBe(false);
  });
});
