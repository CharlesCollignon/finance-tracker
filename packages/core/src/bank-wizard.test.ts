import { describe, expect, it } from "vitest";

import {
  bankWizardPrompt,
  bankWizardStepFor,
  bankWizardStepOf,
} from "./bank-wizard";

describe("bankWizardStepOf", () => {
  it("starts at the first step", () => {
    expect(bankWizardStepOf([])).toBe(1);
    expect(bankWizardStepOf(["recap:2026-10-05"])).toBe(1);
  });

  it("is the step reached", () => {
    expect(bankWizardStepOf([bankWizardPrompt(3)])).toBe(3);
  });

  it("ignores what is not a step", () => {
    expect(bankWizardStepOf(["bank-wizard:9", "bank-wizard:x"])).toBe(1);
  });
});

describe("bankWizardStepFor", () => {
  it("sends the wrong file back to downloading it", () => {
    expect(bankWizardStepFor("bankConnect.fileMissingApiKey")).toBe(3);
    expect(bankWizardStepFor("bankConnect.fileRejected")).toBe(3);
  });

  it("sends an account with no bank back to connecting one", () => {
    expect(bankWizardStepFor("bankConnect.noAccountsYet")).toBe(2);
  });

  it("keeps anything else on the file", () => {
    expect(bankWizardStepFor("bankConnect.openBankingUnreachable")).toBe(4);
  });
});
