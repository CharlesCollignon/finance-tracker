import { describe, expect, it } from "vitest";

import { statementAccountSchema } from "./statements";

describe("statementAccountSchema", () => {
  const fresh = {
    kind: "new",
    key: null,
    label: "Carte Visa Premier",
    bank: "BNP",
    currency: "EUR",
  };

  it("takes a deferred-debit card's own statement", () => {
    expect(
      statementAccountSchema.safeParse({ ...fresh, role: "card" }).success,
    ).toBe(true);
  });

  it("still refuses a role it does not know", () => {
    expect(
      statementAccountSchema.safeParse({ ...fresh, role: "credit" }).success,
    ).toBe(false);
  });
});
