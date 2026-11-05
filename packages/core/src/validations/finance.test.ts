import { describe, expect, it } from "vitest";
import { recurringTemplateSchema } from "./finance";

const TEMPLATE = {
  categoryId: "8f14e45f-ceea-467a-9575-0b1f3e2c4a1d",
  amount: "1159.92",
  recurrence: "monthly",
  dayOfMonth: "5",
};

describe("recurringTemplateSchema's property", () => {
  it("leaves it alone when the form does not ask", () => {
    expect(recurringTemplateSchema.parse(TEMPLATE).propertyId).toBeUndefined();
  });

  it("detaches it when the form sends none", () => {
    expect(
      recurringTemplateSchema.parse({ ...TEMPLATE, propertyId: "" }).propertyId,
    ).toBeNull();
  });

  it("attaches it to the property the form sends", () => {
    const propertyId = "0b9b4e36-3f1c-4d43-9d4f-6a2a8f7d9e10";
    expect(
      recurringTemplateSchema.parse({ ...TEMPLATE, propertyId }).propertyId,
    ).toBe(propertyId);
    expect(
      recurringTemplateSchema.safeParse({ ...TEMPLATE, propertyId: "Lyon" })
        .success,
    ).toBe(false);
  });
});

describe("recurringTemplateSchema's months", () => {
  it("is absent when the form does not send it", () => {
    expect(recurringTemplateSchema.parse(TEMPLATE)).not.toHaveProperty(
      "months",
    );
  });

  it("reads the form's list into its one shape", () => {
    const parsed = recurringTemplateSchema.parse({
      ...TEMPLATE,
      months: "10,1,7,4",
    });
    expect(parsed.recurrence === "monthly" && parsed.months).toEqual([
      1, 4, 7, 10,
    ]);
  });

  it("is every month, null, when empty or all twelve", () => {
    for (const months of ["", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]) {
      const parsed = recurringTemplateSchema.parse({ ...TEMPLATE, months });
      expect(parsed.recurrence === "monthly" && parsed.months).toBeNull();
    }
  });

  it("refuses what is not a month", () => {
    expect(
      recurringTemplateSchema.safeParse({ ...TEMPLATE, months: "0,13" })
        .success,
    ).toBe(false);
  });

  it("refuses some months on a transfer that follows the DCAs", () => {
    const result = recurringTemplateSchema.safeParse({
      ...TEMPLATE,
      pricingType: "purchases",
      months: [1, 4, 7, 10],
    });
    expect(result.success).toBe(false);
  });
});

describe("recurringTemplateSchema's amountVaries", () => {
  it("reads the form's switch", () => {
    expect(
      recurringTemplateSchema.parse({ ...TEMPLATE, amountVaries: "true" })
        .amountVaries,
    ).toBe(true);
    expect(
      recurringTemplateSchema.parse({ ...TEMPLATE, amountVaries: false })
        .amountVaries,
    ).toBe(false);
  });

  it("leaves it alone when absent", () => {
    expect(
      recurringTemplateSchema.parse(TEMPLATE).amountVaries,
    ).toBeUndefined();
  });
});
