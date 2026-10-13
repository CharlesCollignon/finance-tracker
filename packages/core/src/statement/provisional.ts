import type { BankTransaction } from "../bank-feed";

/**
 * Lines that arrive before the statement does — a bank's alert e-mail the
 * day of the payment, later a notification on the phone — are provisional:
 * when the month's statement comes, each of its lines that is one of them
 * confirms it rather than being added a second time. Same account, same
 * amount to the cent, same way, a few days apart at most: a bank books a
 * card payment a day or two after the alert. The closest day wins, and a
 * provisional line answers for one statement line only, so two coffees
 * stay two.
 */

/** A line kept before its statement, as the feed holds it. */
export interface ProvisionalLine {
  /** Its id in the feed (`bank_feed_items.provider_id`). */
  id: string;
  /** Positive, as a decimal string. */
  amount: string;
  direction: "in" | "out";
  /** `YYYY-MM-DD`. */
  day: string;
  /** The statement line that already confirmed it, if one has. */
  confirmedBy: string | null;
}

/** How far apart, in days, an alert and its booking may be. */
export const PROVISIONAL_WINDOW_DAYS = 4;

function cents(amount: string): number {
  return Math.round(Math.abs(Number(amount)) * 100);
}

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * `lines` parted into the fresh ones — to plan as any other — and the ones
 * a provisional line already stands for: those confirmed now, to record,
 * and those confirmed by an earlier import of the same statement.
 */
export function confirmProvisional(
  lines: readonly BankTransaction[],
  provisional: readonly ProvisionalLine[],
  windowDays = PROVISIONAL_WINDOW_DAYS,
): {
  fresh: BankTransaction[];
  confirmed: { provisionalId: string; lineId: string }[];
  alreadyConfirmed: number;
} {
  const fresh: BankTransaction[] = [];
  const confirmed: { provisionalId: string; lineId: string }[] = [];
  const claimed = new Set<string>();
  const byConfirmation = new Map(
    provisional
      .filter((line) => line.confirmedBy !== null)
      .map((line) => [line.confirmedBy!, line.id]),
  );
  let alreadyConfirmed = 0;

  for (const line of lines) {
    if (byConfirmation.has(line.id)) {
      alreadyConfirmed += 1;
      continue;
    }
    const day = line.bookingDate ?? line.valueDate ?? line.transactionDate;
    const direction = line.creditDebitIndicator === "DBIT" ? "out" : "in";
    const amount = cents(line.amount);
    let best: ProvisionalLine | null = null;
    if (day) {
      for (const candidate of provisional) {
        if (
          candidate.confirmedBy !== null ||
          claimed.has(candidate.id) ||
          candidate.direction !== direction ||
          cents(candidate.amount) !== amount
        ) {
          continue;
        }
        const apart = daysApart(candidate.day, day);
        if (apart <= windowDays && (!best || apart < daysApart(best.day, day))) {
          best = candidate;
        }
      }
    }
    if (best) {
      claimed.add(best.id);
      confirmed.push({ provisionalId: best.id, lineId: line.id });
    } else {
      fresh.push(line);
    }
  }
  return { fresh, confirmed, alreadyConfirmed };
}
