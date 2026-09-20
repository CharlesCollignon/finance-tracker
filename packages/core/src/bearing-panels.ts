/**
 * What a card can draw under its figures, and what sits above it.
 *
 * Two vocabularies and nothing else. The tables that chose between them used
 * to live here — a per-family default with a partial per-tile override on top,
 * reached through `panelFor(id, family)` — and they went when the Bearing
 * became five cards: with one card per family the lookup and the card say the
 * same thing, so `bearing-cards.ts` says it, in `CARD_FAMILY_BLOCKS`. The
 * curation that per-tile table held was the point of it and did not go with
 * it; that module's own comment records where it landed.
 *
 * What stays is the alphabet both clients render against. It lives here
 * rather than in `bearing-cards.ts` because a block is a thing a client knows
 * how to draw, not a thing a card knows how to choose — `panel-blocks.tsx` on
 * each client switches on this union, and so does each client's
 * `gatherPanelDetail`, which decides what to read for a card that asks.
 *
 * Pure. Holds no labels — a block's words belong to the component that draws
 * it, in the reader's language.
 */

/** One thing a card can draw. */
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
 * What sits above a card's blocks.
 *
 * `month-scope` is the month picker and the budget-view toggle. They were
 * page furniture above content that mostly ignored them; here they scope
 * exactly the figures they govern, which is the whole argument for moving
 * them.
 */
export type PanelChrome = "none" | "month-scope" | "streak" | "horizon";
