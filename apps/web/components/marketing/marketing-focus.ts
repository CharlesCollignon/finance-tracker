/**
 * The marketing site's focus ring, in one place.
 *
 * DESIGN.md states it as a system rule — "a 2px ring in Lamplit Gold with a
 * 2px offset against the page" — and the call-to-action pair was the only
 * thing on the public site that drew it. Everything else fell back to the
 * user agent's outline: the wordmark, the Product trigger and its menu, the
 * language controls in all three of their shapes, the hamburger and the sheet
 * it opens, the hero's glass cards, the seven feature cards, the previous and
 * next links, and twelve footer links. A keyboard visitor met a different
 * ring on every one of them, drawn in whatever colour their browser picked,
 * over a near-black ground none of those defaults were chosen against.
 *
 * A module of its own rather than an export from one of the components, so a
 * server component and a client component can both reach it without either
 * one pulling the other's boundary across. It is a class string and not a CSS
 * rule because the offset is the part that matters here and Tailwind's ring
 * utilities already own that machinery — see `ring-offset` below, which names
 * the marketing ground rather than the app's, because the site is a step
 * deeper than the page the app's default was measured on.
 */
export const marketingFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-ground)]";
