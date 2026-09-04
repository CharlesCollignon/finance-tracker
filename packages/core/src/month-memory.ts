/**
 * Carrying "the month I was looking at" between surfaces.
 *
 * Three screens are month-scoped — the Month, the Ledger and the Calendar —
 * and the month used to live only in a query string, so changing surface
 * dropped it and threw the user back to today. It is now remembered for the
 * session, which means it arrives from somewhere the user can edit: a cookie
 * on the web, storage on the phone. Parsing it is therefore validation, not
 * convenience, and it lives here so the bounds are tested once rather than
 * trusted twice.
 *
 * A month out of range is not a small problem. `new Date(2026, 13 - 1, 1)`
 * rolls silently into the next year, and `new Date(2026, -1, 1)` into the
 * previous one — so an unchecked 13 would show February 2027 while every
 * label on screen said the year the user asked for.
 */

/**
 * Where the web app stores it.
 *
 * Lives here rather than beside the server helper that reads it, because the
 * browser writes the same cookie and importing the reader's module would drag
 * `next/headers` into the client bundle — which fails at build time, not at
 * typecheck time.
 */
export const MONTH_COOKIE = "pluclair-month";

export interface RememberedMonth {
  year: number;
  month: number;
}

/** Bounds wide enough for any real ledger and narrow enough to catch nonsense. */
const MIN_YEAR = 1970;
const MAX_YEAR = 2999;

/** `2026-03` — zero-padded, so it sorts and compares as text. */
export function formatRememberedMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The month a stored value names, or null if it does not name one.
 *
 * Deliberately strict about shape as well as range: accepting `2026-3` or
 * `  2026-03  ` would mean two spellings of the same month, and the looser
 * the parse the more surface there is for a value that round-trips into
 * something else.
 */
export function parseRememberedMonth(
  value: string | null | undefined,
): RememberedMonth | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}
