/**
 * Connecting a bank, one step at a time (docs/plans/EVERYDAY_PLAN.md,
 * phase 2): the account at open-banking.io, the bank connected there, the
 * credentials file downloaded, the file given to Pluclair.
 *
 * The step reached is remembered for the account, on every device, among
 * the prompts put away (`dismissed_prompts`), only the latest kept: someone
 * who signed up on the phone and comes back on the computer to download the
 * file starts where they stopped.
 */
export const BANK_WIZARD_STEPS = 4;

export type BankWizardStep = 1 | 2 | 3 | 4;

/** What the step reached is kept under; only the latest one is. */
export const BANK_WIZARD_FAMILY = "bank-wizard:";

export function bankWizardPrompt(step: BankWizardStep): string {
  return `${BANK_WIZARD_FAMILY}${step}`;
}

function asStep(value: number): BankWizardStep | null {
  return value === 1 || value === 2 || value === 3 || value === 4
    ? value
    : null;
}

/** The step reached, from the prompts put away; the first without one. */
export function bankWizardStepOf(dismissed: readonly string[]): BankWizardStep {
  let reached: BankWizardStep = 1;
  for (const prompt of dismissed) {
    if (prompt.startsWith(BANK_WIZARD_FAMILY)) {
      const step = asStep(Number(prompt.slice(BANK_WIZARD_FAMILY.length)));
      if (step !== null && step > reached) {
        reached = step;
      }
    }
  }
  return reached;
}

/**
 * The step a refused file sends the reader back to: the one where what went
 * wrong is put right. A file that is not the right one goes back to
 * downloading it; a file that works on an account with no bank yet, back to
 * connecting the bank. Anything else — the service out of reach, a failed
 * save — stays on the file.
 */
export function bankWizardStepFor(problem: string): BankWizardStep {
  switch (problem) {
    case "bankConnect.noAccountsYet":
      return 2;
    case "bankConnect.fileNotCredentials":
    case "bankConnect.fileMissingApiKey":
    case "bankConnect.fileWrongService":
    case "bankConnect.fileRejected":
    case "bankConnect.fileKeyMismatch":
      return 3;
    default:
      return 4;
  }
}
