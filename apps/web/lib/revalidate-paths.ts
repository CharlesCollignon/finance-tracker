import { revalidatePath } from "next/cache";

/**
 * After a write: every signed-in surface reads fresh.
 *
 * One call for every action, because the app's pages are not separate
 * documents but views of one ledger. A transaction moves Le point's balance,
 * the Journal, the calendar, the history, the Plan's projection and, when it
 * is an investment, Placements; a template moves all of those and the
 * recurring list; a bank sync moves everything at once. The lists this
 * replaced named the pages each kind of write reached, by hand, and every one
 * of them had fallen behind — `/history` was missing from all of them, a
 * category change never reached `/import` or `/welcome`, and a savings
 * account that created a category never told `/categories`.
 *
 * `/(app)` with `"layout"` is the route group itself: every page under it
 * carries that layout's tag, so a page added there tomorrow is covered the day
 * it is added, and the marketing pages — at `/`, in their own group, with
 * nothing to do with a ledger — are left alone. It costs nothing extra: every
 * app page reads cookies and so is rendered on request anyway; what this
 * clears is the browser's copy of pages already visited, which is exactly
 * what would otherwise show the figures from before the write.
 */
export function revalidateApp(): void {
  revalidatePath("/(app)", "layout");
}
