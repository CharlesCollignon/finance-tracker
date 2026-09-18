/**
 * What opens under a tile, and why it is not twenty-nine designs.
 *
 * Pressing a tile used to navigate to the surface that explained its figure.
 * It now expands in place, which raised the obvious objection: twenty-nine
 * figures would need twenty-nine expansions. They do not, because
 * `bearing-facts.ts` already carries a `family` on every datum — put there,
 * in its own words, "because the surface groups by it". Five families means
 * five chromes.
 *
 * The blocks are the second half, and the more important one. A panel shows
 * the blocks for *its tile*, not for its whole family. That distinction is
 * what makes this a dissolution of the Month screen rather than a hiding of
 * it: `month` is the fattest family, and a panel that rendered all of it
 * would be Month in an accordion. Each panel explains one figure.
 *
 * Pure. Holds no labels — a block's words belong to the component that draws
 * it, in the reader's language.
 */

import type { FactFamily } from "./bearing-facts";
import { BEARING_TILES, type TileId } from "./bearing-tiles";

/** One thing a panel can draw. */
export type PanelBlock =
  | "money-on-hand"
  | "cash-accounts"
  | "recent-on-account"
  | "review-inbox"
  | "arrived-charges"
  | "spend-strip"
  | "still-to-come"
  | "month-read"
  | "month-comparison"
  | "budget-progress"
  | "close-shelf"
  | "month-score"
  | "trend"
  // No "ingredients". It was a separate block until somebody tried to draw
  // it: both clients' `ProjectionCard` already lists what the projection is
  // made of — the phone's says "the ingredients are the point, not trim" and
  // mirrors the web's line for line — so a block beside "projection" could
  // only ever render the same list twice or nothing at all.
  | "projection"
  | "wallets"
  | "weight-bars"
  | "fund-cost";

/**
 * What sits above a panel's blocks.
 *
 * `month-scope` is the month picker and the budget-view toggle. They are
 * currently page furniture above content that mostly ignores them; here they
 * scope exactly the figures they govern, which is the whole argument for
 * moving them.
 */
export type PanelChrome = "none" | "month-scope" | "streak" | "horizon";

const FAMILY_CHROME: Record<FactFamily, PanelChrome> = {
  now: "none",
  month: "month-scope",
  run: "streak",
  ahead: "horizon",
  wallet: "none",
};

/** What a family's panel shows when its tile asks for nothing more specific. */
const FAMILY_BLOCKS: Record<FactFamily, readonly PanelBlock[]> = {
  now: ["money-on-hand", "recent-on-account"],
  month: ["spend-strip", "still-to-come"],
  run: ["close-shelf", "month-score"],
  ahead: ["projection"],
  wallet: ["wallets", "weight-bars"],
};

/**
 * Tiles whose panel explains their own figure rather than their family's.
 *
 * Deliberately partial. A tile with nothing here gets its family's blocks,
 * which is why adding a thirtieth figure to the Bearing does not oblige
 * anybody to design a thirtieth panel.
 */
const TILE_BLOCKS: Partial<Record<TileId, readonly PanelBlock[]>> = {
  // The one panel that carries the month in words. `free` is the month's
  // headline — what is left of it — and the read is a paragraph about
  // exactly that, so this is where dissolving the Month screen puts it.
  //
  // `arrived-charges` lands here too, first, for the same reason Month's own
  // "Needs you" slot rendered above its links: a question in front of the
  // reader outranks the figures beneath it. `free` is where a reader lands to
  // see how the month is going, which is exactly when "did this arrive?" is
  // worth asking.
  //
  // Both blocks are the point of naming things on a tile rather than on the
  // family: the read and the fulfilment report are the most expensive things
  // any panel can ask for, and a family-wide entry would charge every month
  // tile for blocks most of them do not show. `gatherPanelDetail` fetches
  // either only when a panel's blocks say so.
  free: ["arrived-charges", "spend-strip", "still-to-come", "month-read"],
  "savings-rate": ["month-comparison", "spend-strip"],
  "expenses-vs-previous": ["month-comparison", "trend"],
  "on-hand": ["money-on-hand", "cash-accounts"],
  "inbox-pending": ["review-inbox"],
  "unrecorded-so-far": ["budget-progress", "month-score"],
  "unrecorded-allowance": ["budget-progress", "month-score"],
  "unrecorded-over": ["budget-progress", "month-score"],
  "unrecorded-baseline": ["close-shelf", "month-score"],
  streak: ["close-shelf"],
  "best-streak": ["close-shelf"],
  "monthly-net-average": ["trend"],
  "projected-balance": ["projection"],
  "projected-kept": ["projection"],
  "wallet-cost": ["wallets", "fund-cost"],
  "wallet-drag": ["wallets", "weight-bars"],
};

export interface PanelSpec {
  family: FactFamily;
  chrome: PanelChrome;
  blocks: readonly PanelBlock[];
  /**
   * Where the panel's footer link goes, or null.
   *
   * The tile's own `href`, demoted. It used to be what a press did; it is now
   * the way out to the full surface, for the times a panel is not enough.
   */
  href: string | null;
}

export function panelFor(id: TileId, family: FactFamily): PanelSpec {
  return {
    family,
    chrome: FAMILY_CHROME[family],
    blocks: TILE_BLOCKS[id] ?? FAMILY_BLOCKS[family],
    href: BEARING_TILES[id].href,
  };
}
