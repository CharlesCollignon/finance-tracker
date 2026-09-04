import { cookies } from "next/headers";
import { getCurrentMonth, parseMonthParams } from "@finance/core/constants";
import { MONTH_COOKIE, parseRememberedMonth } from "@finance/core/month-memory";

/**
 * Which month a surface is showing, remembered across surfaces.
 *
 * Three screens are month-scoped — the Month, the Ledger and the Calendar —
 * and the month lived only in the query string. So picking March and tapping
 * Ledger landed on `/transactions` with no query, which read as "today", and
 * the user was thrown back to the current month every time they changed
 * surface. The arrows made that worse: getting back to March meant six
 * clicks, twice.
 *
 * A session cookie carries it, and the **middleware** puts it back into the
 * address before anything renders. This function deliberately does not
 * redirect — it used to, and that was wrong in a way only the development
 * overlay revealed. `/transactions` renders the Ledger's view tabs, Next
 * prefetches the `/calendar` link in them, the prefetch began rendering
 * CalendarPage, and a `redirect()` from inside that render abandoned it
 * half-finished; React's instrumentation then measured a component that
 * started and never completed and reported "'CalendarPage' cannot have a
 * negative time stamp". A request that should be turned away should be turned
 * away before it becomes a component. See `lib/supabase/middleware.ts`.
 *
 * What is left here is a plain resolver, and it still reads the cookie on
 * purpose: a request that reaches a page without having passed the middleware
 * should render the month the user was looking at rather than silently
 * jumping to today.
 *
 * A session cookie rather than a stored preference on purpose: the month
 * should survive changing surface and reloading the page, and it should not
 * survive closing the app. Reopening Pluclair a week later to February's
 * figures, believing them to be this month's, is a far worse failure than
 * having to pick a month again.
 */

export interface MonthScopeParams {
  y?: string;
  m?: string;
}

export async function resolveMonthScope(
  params: MonthScopeParams,
): Promise<{ year: number; month: number }> {
  if (params.y && params.m) {
    return parseMonthParams(params.y, params.m);
  }

  const store = await cookies();
  const remembered = parseRememberedMonth(store.get(MONTH_COOKIE)?.value);

  return remembered ?? getCurrentMonth();
}
