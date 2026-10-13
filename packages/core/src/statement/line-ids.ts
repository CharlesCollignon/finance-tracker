import type { BankTransaction } from "../bank-feed";
import type { RawLine } from "./model";

/**
 * An id for each line of a file, the same every time the same line is read
 * again: the same export downloaded twice, or two exports that overlap by a
 * month, must add nothing twice — and two real coffees at the same counter on
 * the same day must stay two.
 *
 * So the id is a fingerprint of what the line says — its day, its signed
 * amount, its words — plus its rank among the lines of the file that say
 * exactly the same, in the order the file lists them. A second download
 * holds the same lines in the same days, and gives each the same rank.
 *
 * Not the file's own reference (an OFX's `FITID`), even when there is one:
 * some banks make a new one at every download, and a reference that changes
 * is a duplicate waiting to happen. The fingerprint holds wherever the words
 * do; a bank that words the same line differently in two formats is the
 * matcher's to catch (`findLedgerMatch`), not this.
 *
 * Prefixed by the account in the data layer: the same coffee on two accounts
 * is two coffees.
 */

/** Words compared as a bank's file writes them, spacing and case aside. */
export function lineWords(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Two 32-bit FNV-1a hashes, with different seeds, side by side: sixteen hex
 * digits, enough that two different lines of one account never meet, and
 * plain arithmetic the phone runs as the server does.
 */
function fingerprint(text: string): string {
  let first = 0x811c9dc5;
  let second = 0x01000193 ^ 0x5bd1e995;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x01000193) >>> 0;
    second = (second ^ (second >>> 15)) >>> 0;
  }
  return (
    first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0")
  );
}

/** What makes a line itself: day, signed amount and words. */
export function lineSignature(line: RawLine): string {
  const day = line.bookingDate ?? line.valueDate ?? line.transactionDate ?? "";
  const negative =
    line.creditDebitIndicator.toUpperCase() === "DBIT" ||
    line.amount.trim().startsWith("-");
  const amount = Number(line.amount.replace("-", "")).toFixed(2);
  const words = lineWords(
    [line.creditorName, line.debtorName, line.remittanceInformation]
      .filter(Boolean)
      .join(" "),
  );
  return `${day}|${negative ? "-" : "+"}${amount}|${words}`;
}

/** Each line with its id: `l<fingerprint>-<rank>`. */
export function withLineIds(lines: readonly RawLine[]): BankTransaction[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const signature = lineSignature(line);
    const rank = seen.get(signature) ?? 0;
    seen.set(signature, rank + 1);
    return { ...line, id: `l${fingerprint(signature)}-${rank}` };
  });
}
