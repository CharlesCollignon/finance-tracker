import { describe, expect, it } from "vitest";

import { keptWallets } from "./investments";
import {
  defaultSavingsKind,
  liquidSavings,
  savingsBalance,
  savingsRate,
  yearlyInterest,
} from "./savings-accounts";

const ldds = {
  kind: "ldds" as const,
  balance: 8_000,
  balance_on: "2026-09-01",
  category_id: "cat-ldds",
  bank_account_id: null,
  annual_rate: null,
};

describe("savingsBalance", () => {
  it("adds what was logged in the account's category after the balance was given", () => {
    expect(
      savingsBalance(
        ldds,
        [
          { categoryId: "cat-ldds", movedOn: "2026-09-01", amount: 100 },
          { categoryId: "cat-ldds", movedOn: "2026-09-05", amount: 200 },
          { categoryId: "cat-other", movedOn: "2026-09-05", amount: 999 },
        ],
        [],
      ),
    ).toEqual({
      kind: "ldds",
      balance: 8_200,
      asOf: "2026-09-01",
      added: 200,
      source: "given",
    });
  });

  it("reads a linked bank account's balance instead", () => {
    expect(
      savingsBalance(
        { ...ldds, bank_account_id: "acc-1" },
        [{ categoryId: "cat-ldds", movedOn: "2026-09-05", amount: 200 }],
        [
          {
            provider_account_id: "acc-1",
            reported_balance: 8_412.5,
            reported_on: "2026-09-30",
          },
        ],
      ),
    ).toMatchObject({ balance: 8_412.5, asOf: "2026-09-30", source: "bank" });
  });
});

describe("rates and interest", () => {
  it("uses the regulated rate unless the account has its own", () => {
    expect(savingsRate(ldds)).toBe(0.017);
    expect(savingsRate({ kind: "pel", annual_rate: 0.025 })).toBe(0.025);
  });

  it("takes the tax off a year's interest", () => {
    expect(yearlyInterest(12_000, ldds)).toBe(204);
    expect(yearlyInterest(10_000, { kind: "pel", annual_rate: null })).toBe(
      140,
    );
  });
});

describe("which account savings go to", () => {
  it("prefers the Livret A, then any account at hand", () => {
    expect(defaultSavingsKind(["pel", "ldds", "livret_a"])).toBe("livret_a");
    expect(defaultSavingsKind(["pel", "ldds"])).toBe("ldds");
    expect(defaultSavingsKind(["pel"])).toBe("pel");
    expect(defaultSavingsKind([])).toBeNull();
  });

  it("leaves a PEL out of what is at hand", () => {
    expect(
      liquidSavings([
        { kind: "ldds", balance: 5_000, asOf: "", added: 0, source: "given" },
        { kind: "pel", balance: 20_000, asOf: "", added: 0, source: "given" },
      ]),
    ).toBe(5_000);
  });
});

describe("keptWallets", () => {
  it("keeps the wallets with positions and the ones added, in order", () => {
    expect(
      keptWallets({ withPositions: ["crypto", "pea"], shown: ["av", "pea"] }),
    ).toEqual(["pea", "av", "crypto"]);
  });
});
