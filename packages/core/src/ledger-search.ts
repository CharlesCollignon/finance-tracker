import { parseTypedAmount } from "./amount-input";

/**
 * What a search in the Journal looks for, worked out once for the month on
 * screen (`filterLedger`) and for every month (`@finance/data/ledger-search`):
 * the words, in a row's note — where a bank puts the shop — or its category's
 * name, and an amount, when what was typed reads as one.
 *
 * « 12,30 » finds the rows of 12,30 €; « carrefour » the rows that name it;
 * « 45 » both a « Lot 45 » and the rows of 45 €.
 */
export interface SearchNeedle {
  /** Lower case, trimmed. Never empty. */
  text: string;
  /** What was typed read as an amount, or null. */
  amount: number | null;
}

/** Fewer letters than this find too much to be worth asking every month. */
export const MIN_SEARCH_LENGTH = 2;

/** What was typed as a needle, or null for nothing to look for. */
export function searchNeedle(query: string): SearchNeedle | null {
  const text = query.trim().toLowerCase();
  if (text === "") {
    return null;
  }
  const amount = parseTypedAmount(text);
  return {
    text,
    amount: amount !== null && amount > 0 ? amount : null,
  };
}

/** Whether a needle is worth looking for across every month. */
export function searchesEveryMonth(needle: SearchNeedle | null): boolean {
  return (
    needle !== null &&
    (needle.amount !== null || needle.text.length >= MIN_SEARCH_LENGTH)
  );
}

/** Whether a row, or a row still to come, is one the needle finds. */
export function matchesNeedle(
  needle: SearchNeedle,
  fields: readonly (string | null | undefined)[],
  amount: number,
): boolean {
  if (needle.amount !== null && Math.abs(amount - needle.amount) < 0.005) {
    return true;
  }
  return fields.some((field) =>
    (field ?? "").toLowerCase().includes(needle.text),
  );
}

/**
 * The words, as a PostgREST `ilike` pattern can carry them: the characters
 * its filter syntax reserves are dropped, and SQL's wildcards escaped, so a
 * « 50% » looks for « 50% » rather than for anything.
 */
export function ilikeWords(text: string): string {
  return text
    .replace(/[,()"\\*]/g, " ")
    .replace(/[%_]/g, (wildcard) => `\\${wildcard}`)
    .replace(/\s+/g, " ")
    .trim();
}
