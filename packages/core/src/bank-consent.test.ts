import { describe, expect, it } from "vitest";

import { BANK_CONSENT_VERSION, consentIsCurrent } from "./bank-consent";

describe("consentIsCurrent", () => {
  it("accepts only the version on screen today", () => {
    expect(consentIsCurrent(BANK_CONSENT_VERSION)).toBe(true);
    expect(consentIsCurrent("2020-01-01")).toBe(false);
    expect(consentIsCurrent(null)).toBe(false);
    expect(consentIsCurrent(undefined)).toBe(false);
  });
});
