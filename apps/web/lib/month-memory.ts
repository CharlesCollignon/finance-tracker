"use client";

import {
  MONTH_COOKIE,
  formatRememberedMonth,
} from "@finance/core/month-memory";

/**
 * Remember the month the user just picked, for the next surface they open.
 *
 * Written from the browser rather than through a server action: a cookie with
 * no expiry is a session cookie, which is exactly the lifetime wanted here,
 * and `document.cookie` sets one without a round trip in the middle of a
 * navigation the user is already waiting on.
 *
 * Nothing reads this on the client. The server reads it in `resolveMonthScope`
 * when a month-scoped page is opened without a month in its address; on the
 * client the address bar is always the source of truth.
 */
export function rememberMonth(year: number, month: number): void {
  try {
    const value = formatRememberedMonth(year, month);
    // `SameSite=Lax` so it survives a normal top-level navigation and is not
    // sent on cross-site requests. No `Secure`: this has to work on
    // http://localhost as well as production, and the month someone is
    // looking at is not a secret.
    document.cookie = `${MONTH_COOKIE}=${value}; path=/; samesite=lax`;
  } catch {
    // Cookies disabled. The month still works within a surface, because the
    // address bar carries it; it just will not follow the user to the next
    // one. Not worth failing a navigation over.
  }
}
