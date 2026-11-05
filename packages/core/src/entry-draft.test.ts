import { describe, expect, it } from "vitest";

import {
  categoriesOfKind,
  entryGap,
  merchantsOfKind,
  offersAdvance,
  scheduleOfEntry,
  schedulePayload,
  type EntrySchedule,
} from "./entry-draft";
import { formatRecurrenceSchedule } from "./recurrence";
import type { MerchantRule } from "./merchant-memory";
import type { Category } from "./types/database";
import { recurringTemplateSchema } from "./validations/finance";

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

function category(id: string, type: Category["type"]): Category {
  return { id, name: id, type, icon: null } as Category;
}

const schedule = (patch: Partial<EntrySchedule>): EntrySchedule => ({
  rhythm: "monthly",
  dayOfMonth: 5,
  dayOfWeek: 1,
  month: 11,
  ...patch,
});

describe("categoriesOfKind", () => {
  const all = [
    category("rent", "expense"),
    category("food", "expense"),
    category("pay", "income"),
    category("fun", "expense"),
  ];

  it("keeps only the kind asked for, recent ones first", () => {
    expect(
      categoriesOfKind(all, "expense", ["fun", "pay"]).map((c) => c.id),
    ).toEqual(["fun", "rent", "food"]);
  });

  it("keeps the caller's order with no recents", () => {
    expect(categoriesOfKind(all, "income").map((c) => c.id)).toEqual(["pay"]);
  });
});

describe("merchantsOfKind", () => {
  it("drops shops filed under another kind", () => {
    const rules = [
      { key: "a", categoryType: "expense" },
      { key: "b", categoryType: "income" },
    ] as MerchantRule[];
    expect(merchantsOfKind(rules, "income").map((r) => r.key)).toEqual(["b"]);
  });
});

describe("entryGap", () => {
  it("asks for the amount before the category", () => {
    expect(entryGap({ amountComplete: false, hasCategory: false })).toBe(
      "amount",
    );
    expect(entryGap({ amountComplete: true, hasCategory: false })).toBe(
      "category",
    );
    expect(entryGap({ amountComplete: true, hasCategory: true })).toBeNull();
  });
});

describe("scheduleOfEntry", () => {
  it("reads a quarter as every third month from the starting one", () => {
    expect(
      scheduleOfEntry(schedule({ rhythm: "quarterly", month: 11 })).months,
    ).toEqual([2, 5, 8, 11]);
  });

  it("says each rhythm back the way Récurrents does", () => {
    const say = (patch: Partial<EntrySchedule>) =>
      formatRecurrenceSchedule(scheduleOfEntry(schedule(patch)), "fr");
    expect(say({ rhythm: "monthly" })).toBe("Mensuel · le 5");
    expect(say({ rhythm: "weekly", dayOfWeek: 1 })).toMatch(/^Hebdomadaire/);
    expect(say({ rhythm: "yearly" })).toMatch(/^Annuel · 5 novembre/);
    expect(say({ rhythm: "quarterly" })).toMatch(/^Trimestriel · le 5/);
  });
});

describe("schedulePayload", () => {
  const common = {
    categoryId: CATEGORY_ID,
    amount: 120,
    pricingType: "fixed",
  };

  for (const rhythm of ["monthly", "weekly", "quarterly", "yearly"] as const) {
    it(`is a valid ${rhythm} template`, () => {
      const parsed = recurringTemplateSchema.safeParse({
        ...common,
        ...schedulePayload(schedule({ rhythm })),
      });
      expect(parsed.success).toBe(true);
    });
  }

  it("keeps a quarter's months", () => {
    const parsed = recurringTemplateSchema.parse({
      ...common,
      ...schedulePayload(schedule({ rhythm: "quarterly", month: 1 })),
    });
    expect(parsed.recurrence === "monthly" && parsed.months).toEqual([
      1, 4, 7, 10,
    ]);
  });
});

describe("offersAdvance", () => {
  it("is for a monthly income only", () => {
    expect(offersAdvance("income", "monthly")).toBe(true);
    expect(offersAdvance("income", "weekly")).toBe(false);
    expect(offersAdvance("expense", "monthly")).toBe(false);
  });
});
