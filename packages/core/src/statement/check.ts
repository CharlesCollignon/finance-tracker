import type { BankTransaction } from "../bank-feed";
import type { StatementBalance, StatementBlock } from "./model";

/**
 * Whether a statement's lines add up to what the statement itself says:
 * from its opening balance to its closing one, or to its own totals of
 * money out and money in — to the cent. A file read right says so; one
 * with a page missing, or a line read wrong, says that too, before
 * anything is imported.
 */

export interface StatementCheck {
  ok: boolean;
  /**
   * What the lines leave unexplained, signed, as a decimal string: « 0.00 »
   * when they add up.
   */
  gap: string;
}

/** What a statement totals, when it prints its totals: both positive. */
export interface StatementTotals {
  out: string;
  in: string;
}

function cents(value: string): number {
  return Math.round(Number(value) * 100);
}

/** A line's amount in cents: money in positive, money out negative. */
function signedCents(line: BankTransaction): number {
  const amount = cents(line.amount.replace("-", ""));
  return line.creditDebitIndicator === "DBIT" ? -amount : amount;
}

function gapOf(value: number): string {
  return (value / 100).toFixed(2);
}

/** The check of a block against its own balances, when it has both. */
export function checkBlock(block: StatementBlock): StatementCheck | null {
  if (!block.opening || !block.closing || block.lines.length === 0) {
    return null;
  }
  const moved = block.lines.reduce((sum, line) => sum + signedCents(line), 0);
  const gap = cents(block.closing.amount) - cents(block.opening.amount) - moved;
  return { ok: gap === 0, gap: gapOf(gap) };
}

/** The check of lines against the totals a statement prints. */
export function checkTotals(
  lines: readonly BankTransaction[],
  totals: StatementTotals,
): StatementCheck {
  let out = 0;
  let into = 0;
  for (const line of lines) {
    const amount = signedCents(line);
    if (amount < 0) out -= amount;
    else into += amount;
  }
  const outGap = cents(totals.out) - out;
  const inGap = cents(totals.in) - into;
  return {
    ok: outGap === 0 && inGap === 0,
    gap: gapOf(inGap - outGap),
  };
}

/**
 * Of every balance a statement states, the two the lines join — the
 * earliest that is followed by the lines' sum to a later one — when a
 * statement prints more balances than its opening and closing ones (a
 * summary box, a page's carried balance). Null when no pair joins.
 */
export function joiningBalances(
  balances: readonly StatementBalance[],
  lines: readonly BankTransaction[],
): { opening: StatementBalance; closing: StatementBalance } | null {
  const moved = lines.reduce((sum, line) => sum + signedCents(line), 0);
  for (let first = 0; first < balances.length; first += 1) {
    for (let last = balances.length - 1; last > first; last -= 1) {
      const opening = balances[first]!;
      const closing = balances[last]!;
      if (cents(closing.amount) - cents(opening.amount) === moved) {
        return { opening, closing };
      }
    }
  }
  return null;
}
