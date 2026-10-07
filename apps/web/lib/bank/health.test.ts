import { describe, expect, it } from "vitest";
import { classifyBankError, consentByBank, consentToWatch } from "./health";

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

describe("consentToWatch", () => {
  const connections = [
    { aspspName: "BoursoBank", validUntil: "2027-03-01T00:00:00Z" },
    { aspspName: "Crédit Agricole", validUntil: null },
    { aspspName: "Crédit Agricole", validUntil: "2026-12-15T00:00:00Z" },
    { aspspName: "N26", validUntil: "2026-01-02T00:00:00Z" },
  ];

  it("counts down to the first consent to end at a bank the user follows", () => {
    expect(
      consentToWatch(connections, new Set(["BoursoBank", "Crédit Agricole"])),
    ).toBe("2026-12-15T00:00:00Z");
  });

  it("leaves aside a bank nobody follows an account at", () => {
    expect(consentToWatch(connections, new Set(["BoursoBank"]))).toBe(
      "2027-03-01T00:00:00Z",
    );
  });

  it("watches every bank before any account is followed", () => {
    expect(consentToWatch(connections, new Set())).toBe("2026-01-02T00:00:00Z");
    expect(consentToWatch([], new Set())).toBeNull();
  });
});

describe("consentByBank", () => {
  it("keeps each bank's earliest consent", () => {
    expect(
      consentByBank([
        { aspspName: "Crédit Agricole", validUntil: "2027-01-01T00:00:00Z" },
        { aspspName: "Crédit Agricole", validUntil: "2026-12-15T00:00:00Z" },
        { aspspName: "BoursoBank", validUntil: null },
      ]),
    ).toEqual(new Map([["Crédit Agricole", "2026-12-15T00:00:00Z"]]));
  });
});
