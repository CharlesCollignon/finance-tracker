import { describe, expect, it } from "vitest";

import {
  firstCloseDay,
  nextSetupStep,
  setupPrompt,
  type SetupFacts,
} from "./setup-steps";

const NOTHING: SetupFacts = {
  bankInvited: false,
  bankFed: false,
  hasBalance: false,
  hasIncome: false,
  hasCharges: false,
  hasClosed: false,
  readyToClose: false,
  dismissed: [],
};

describe("nextSetupStep", () => {
  it("offers the bank first, where it can be connected", () => {
    expect(nextSetupStep({ ...NOTHING, bankInvited: true })).toBe("bank");
  });

  it("asks nothing once a bank feeds the ledger", () => {
    expect(
      nextSetupStep({ ...NOTHING, bankInvited: true, bankFed: true }),
    ).toBeNull();
  });

  it("then walks the balance, the salary, the charges and the first close", () => {
    expect(nextSetupStep(NOTHING)).toBe("balance");
    expect(nextSetupStep({ ...NOTHING, hasBalance: true })).toBe("salary");
    expect(
      nextSetupStep({ ...NOTHING, hasBalance: true, hasIncome: true }),
    ).toBe("charges");
    expect(
      nextSetupStep({
        ...NOTHING,
        hasBalance: true,
        hasIncome: true,
        hasCharges: true,
      }),
    ).toBe("close");
  });

  it("skips a step put away for good", () => {
    expect(
      nextSetupStep({ ...NOTHING, dismissed: [setupPrompt("balance")] }),
    ).toBe("salary");
  });

  it("leaves the close to the attention row once a month can be closed", () => {
    expect(
      nextSetupStep({
        ...NOTHING,
        hasBalance: true,
        hasIncome: true,
        hasCharges: true,
        readyToClose: true,
      }),
    ).toBeNull();
  });

  it("is done when everything is set up", () => {
    expect(
      nextSetupStep({
        ...NOTHING,
        hasBalance: true,
        hasIncome: true,
        hasCharges: true,
        hasClosed: true,
      }),
    ).toBeNull();
  });
});

describe("firstCloseDay", () => {
  it("is the reading day of the month after today's", () => {
    expect(firstCloseDay("2026-10-08", 5)).toBe("2026-11-05");
    expect(firstCloseDay("2026-12-20", 3)).toBe("2027-01-03");
  });
});
