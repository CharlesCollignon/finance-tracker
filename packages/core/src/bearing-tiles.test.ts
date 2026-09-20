import { describe, expect, it } from "vitest";

import {
  BEARING_TILES,
  BEARING_TILE_IDS,
  isTileId,
  phoneHref,
} from "./bearing-tiles";

describe("the tile catalogue", () => {
  it("gives every tile a destination decision", () => {
    for (const id of BEARING_TILE_IDS) {
      expect(BEARING_TILES).toHaveProperty(id);
    }
    expect(Object.keys(BEARING_TILES)).toHaveLength(BEARING_TILE_IDS.length);
  });

  it("rejects an id that is not a tile", () => {
    expect(isTileId("net-position")).toBe(true);
    expect(isTileId("top-expense:c4")).toBe(false);
  });
});

/**
 * Every screen the phone's router actually has, transcribed from
 * `apps/mobile/src/app`: the tab group (`index`, `calendar`, `investments`,
 * `planning`, `profile`, `recurring`, `transactions`) plus the root-level
 * routes beside it. Hand-written because core cannot see the app, and worth
 * keeping in step: a footer link to a path missing from this list is a press
 * that lands nowhere.
 */
const PHONE_ROUTES = new Set([
  "/",
  "/calendar",
  "/categories",
  "/import",
  "/investments",
  "/onboarding",
  "/planning",
  "/profile",
  "/recurring",
  "/transactions",
]);

describe("phoneHref", () => {
  it("sends every tile to a screen the phone actually has", () => {
    for (const id of BEARING_TILE_IDS) {
      const href = phoneHref(BEARING_TILES[id].href);
      if (href === null) {
        continue;
      }
      const path = href.split("?")[0]!;
      expect(PHONE_ROUTES.has(path), `${id} -> ${href}`).toBe(true);
    }
  });

  it("redirects the one path only the web app has, and drops the rest", () => {
    // Budget caps, goal pacing, projections, runway, close history.
    expect(phoneHref("/budgets")).toBe("/planning");
    // The Month page these both used to reach is retired; no tile points at
    // either any more, and the table says so rather than staying silent.
    expect(phoneHref("/dashboard")).toBeNull();
    expect(phoneHref("/history")).toBeNull();
  });

  it("leaves the paths both clients share alone", () => {
    expect(phoneHref("/investments")).toBe("/investments");
    expect(phoneHref("/recurring")).toBe("/recurring");
  });

  it("keeps the query string, so the review filter still applies", () => {
    expect(phoneHref("/transactions?review=inbox")).toBe(
      "/transactions?review=inbox",
    );
  });

  it("carries a query string across a redirect", () => {
    expect(phoneHref("/budgets?month=2026-09")).toBe("/planning?month=2026-09");
  });

  it("leads nowhere when the tile leads nowhere", () => {
    expect(phoneHref(null)).toBeNull();
  });
});
