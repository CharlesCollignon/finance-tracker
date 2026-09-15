"use client";

import { useSyncExternalStore } from "react";

/**
 * The Bearing grid's column count, in JS.
 *
 * `BearingGrid` lays tiles out with `grid-cols-2 md:grid-cols-4` — two
 * columns below Tailwind's `md` breakpoint, four at or above it. Placing a
 * full-width panel under the right row (`rowEndIndex` in
 * `@finance/core/bearing-grid`) needs to know which of those two is actually
 * in effect, and CSS alone can't hand that number to JS. This hook reads the
 * same breakpoint Tailwind itself defines it at, `48rem`
 * (`--breakpoint-md` in `tailwindcss/theme.css`), rather than a hardcoded
 * pixel figure nobody has promised stays in step with the class names in the
 * markup.
 *
 * Same shape as `usePrefersReducedMotion` below, and for the same reason:
 * a media query read through `useSyncExternalStore` with a server snapshot,
 * so the server-rendered HTML and the client's first paint agree instead of
 * one hydrating over the other.
 */
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeGridColumns(onChange: () => void): () => void {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getGridColumnsSnapshot(): 2 | 4 {
  return window.matchMedia(DESKTOP_QUERY).matches ? 4 : 2;
}

/**
 * Assumes the desktop count on the server, because there is no viewport to
 * ask yet. Wrong only for a phone's first paint, and even then only until
 * `useSyncExternalStore` corrects it on mount — nothing this number affects
 * is visible before then, since a panel only appears once a tile has
 * actually been pressed, which cannot happen before hydration.
 */
function getGridColumnsServerSnapshot(): 2 | 4 {
  return 4;
}

export function useGridColumns(): 2 | 4 {
  return useSyncExternalStore(
    subscribeGridColumns,
    getGridColumnsSnapshot,
    getGridColumnsServerSnapshot,
  );
}
