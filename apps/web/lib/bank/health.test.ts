import { describe, expect, it } from "vitest";
import { classifyBankError, earliestValidUntil } from "./health";

describe("classifyBankError", () => {
  it("reads an ended key out of a 401 or 403", () => {
    expect(
      classifyBankError(new Error("GET /accounts failed: 401 Unauthorized"))
        .status,
    ).toBe("expired");
    expect(
      classifyBankError(new Error("POST /sync failed: 403 Forbidden")).status,
    ).toBe("expired");
  });

  it("reads a paused wallet out of a 402", () => {
    expect(
      classifyBankError(new Error("GET /accounts failed: 402 Payment Required"))
        .status,
    ).toBe("paused");
  });

  it("treats anything else as a failure worth trying again", () => {
    expect(classifyBankError(new Error("fetch failed")).status).toBe("error");
    expect(
      classifyBankError(
        new Error("GET /accounts failed: 503 Service Unavailable"),
      ).status,
    ).toBe("error");
  });

  it("never repeats the raw error to the screen", () => {
    const failure = classifyBankError(
      new Error("GET /accounts/abc123?key=secret failed: 500"),
    );
    expect(failure.message).not.toContain("secret");
  });
});

describe("earliestValidUntil", () => {
  it("counts down to the consent that ends first", () => {
    expect(
      earliestValidUntil([
        { validUntil: "2027-03-01T00:00:00Z" },
        { validUntil: null },
        { validUntil: "2026-12-15T00:00:00Z" },
      ]),
    ).toBe("2026-12-15T00:00:00Z");
    expect(earliestValidUntil([])).toBeNull();
  });
});
