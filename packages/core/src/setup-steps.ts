/**
 * Le point's setup cards: one at a time, the next thing the app needs to say
 * something worth reading — and none once it has it.
 *
 * The bank first, where it can be connected: it brings the balance, the
 * income and the charges at once. Without one, the balance (what makes
 * « Il vous reste » possible), the salary (what it runs to), the charges
 * (what it takes off), and the first month close on the reading day.
 * Investments and property never get a card: they are found in their tabs.
 *
 * « Plus tard » puts a step away for good, on every device
 * (`dismissed_prompts`, `setup:<step>`); the bank's own invitation is put
 * away as it is everywhere else (`bank-invite:bearing`), which is what the
 * caller's `bankInvited` already accounts for.
 */
export type SetupStep = "bank" | "balance" | "salary" | "charges" | "close";

/** What a step is put away under, in `dismissed_prompts`. */
export function setupPrompt(step: Exclude<SetupStep, "bank">): string {
  return `setup:${step}`;
}

export interface SetupFacts {
  /** A bank can be connected here and the invitation was not put away. */
  bankInvited: boolean;
  /** A bank feeds the ledger: it brings the rest itself. */
  bankFed: boolean;
  /** The month has a balance: the bank's, a close's, or one typed. */
  hasBalance: boolean;
  /** An active recurring income: what « Il vous reste » runs to. */
  hasIncome: boolean;
  /** An active recurring charge. */
  hasCharges: boolean;
  /** A month has been closed. */
  hasClosed: boolean;
  /** A month is ready to close now: the attention row already asks. */
  readyToClose: boolean;
  dismissed: readonly string[];
}

export function nextSetupStep(facts: SetupFacts): SetupStep | null {
  if (facts.bankFed) {
    return null;
  }
  if (facts.bankInvited) {
    return "bank";
  }
  const wanted: [Exclude<SetupStep, "bank">, boolean][] = [
    ["balance", !facts.hasBalance],
    ["salary", !facts.hasIncome],
    ["charges", !facts.hasCharges],
    ["close", !facts.hasClosed && !facts.readyToClose],
  ];
  for (const [step, needed] of wanted) {
    if (needed && !facts.dismissed.includes(setupPrompt(step))) {
      return step;
    }
  }
  return null;
}

/**
 * The day the first close can be made: the reading day of the month after
 * today's, when this month's closing balance is read.
 */
export function firstCloseDay(today: string, closeDay: number): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const next =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}-${String(closeDay).padStart(2, "0")}`;
}
