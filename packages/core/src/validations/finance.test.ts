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
