/**
 * What the Bearing can show, where each tile leads, and how they are laid out.
 *
 * A tile is one datum, and deliberately so: the model already has a
 * vocabulary of figure ids from `bearing-facts.ts`, and giving it a second
 * vocabulary of tile ids to choose from would be two lists to keep in step
 * for no gain. Choosing a tile *is* choosing a figure.
 *
 * **Sizes belong to the slot, not to the tile.** The bento shape is a fixed
 * sequence of spans and the arrangement decides which figure lands in which
 * slot. Three things follow, and all three are the reason it is built this
 * way: the rhythm of the grid survives any reordering, dragging is a plain
 * permutation rather than a packing problem, and the model has no size field
 * to get wrong.
 *
 * Pure. No labels live here either — a tile's label is its datum's label,
 * already translated in the pack, so there is one place a figure is named.
 */

import type { BearingFacts, FactFamily } from "./bearing-facts";

/* ------------------------------------------------------------ the tiles */

/**
 * Every figure that may become a tile.
 *
 * Closed, and worth noting why it can be: unlike a month pack, which carries
 * a datum per category and so has ids nobody can enumerate in advance, every
 * Bearing figure is one of a fixed set. That is what lets a model be handed
 * the whole vocabulary and be held to it exactly.
 */
export const BEARING_TILE_IDS = [
  "net-position",
  "on-hand",
  "invested",
  "invested-share",
  "inbox-pending",
  "free",
  "committed",
  "arriving",
  "savings-rate",
  "expenses-vs-previous",
  "unrecorded-so-far",
  "unrecorded-allowance",
  "unrecorded-over",
  "unrecorded-baseline",
  "streak",
  "best-streak",
  "monthly-net-average",
  "projected-balance",
  "projected-kept",
  "projected-monthly-net",
  "committed-monthly",
  "runway-months",
  "wallet-cost",
  "wallet-gain",
  "wallet-return",
  "wallet-drag",
  "wallet-drift",
  "wallet-concentration",
  "contribution-pace",
] as const;

export type TileId = (typeof BEARING_TILE_IDS)[number];

const TILE_ID_SET: ReadonlySet<string> = new Set(BEARING_TILE_IDS);

export function isTileId(value: string): value is TileId {
  return TILE_ID_SET.has(value);
}

/** Which series a tile draws behind its figure, when it draws one at all. */
export type TileSeries = "trend" | "projection";

export interface TileMeta {
  /**
   * The surface this figure is explained on, or null when it is not any one
   * surface's. A tile with nowhere honest to lead leads nowhere; inventing a
   * destination would teach people that pressing tiles is a coin flip.
   */
  href: string | null;
  series?: TileSeries;
}

/**
 * Where each figure is explained.
 *
 * Paths are the app's existing ones — `navigation.ts` records why they were
 * never renamed — so the Month page is `/dashboard` even though it is no
 * longer the app's front door.
 */
export const BEARING_TILES: Record<TileId, TileMeta> = {
  "net-position": { href: null, series: "trend" },
  "on-hand": { href: "/dashboard" },
  invested: { href: "/investments" },
  "invested-share": { href: "/investments" },
  "inbox-pending": { href: "/transactions?review=inbox" },
  free: { href: "/dashboard" },
  committed: { href: "/recurring" },
  arriving: { href: "/recurring" },
  "savings-rate": { href: "/dashboard" },
  "expenses-vs-previous": { href: "/history" },
  "unrecorded-so-far": { href: "/budgets" },
  "unrecorded-allowance": { href: "/budgets" },
  "unrecorded-over": { href: "/budgets" },
  "unrecorded-baseline": { href: "/budgets" },
  streak: { href: "/budgets" },
  "best-streak": { href: "/budgets" },
  "monthly-net-average": { href: "/history", series: "trend" },
  "projected-balance": { href: "/budgets", series: "projection" },
  "projected-kept": { href: "/budgets", series: "projection" },
  "projected-monthly-net": { href: "/budgets" },
  "committed-monthly": { href: "/recurring" },
  "runway-months": { href: "/budgets" },
  "wallet-cost": { href: "/investments" },
  "wallet-gain": { href: "/investments" },
  "wallet-return": { href: "/investments" },
  "wallet-drag": { href: "/investments" },
  "wallet-drift": { href: "/investments" },
  "wallet-concentration": { href: "/investments" },
  "contribution-pace": { href: "/investments" },
};

/* ------------------------------------------------------------ the bento */

export type TileSpan = "hero" | "wide" | "unit";

/**
 * The opening of the grid, and the figure that gets the room.
 *
 * A hero, two units beside it and a wide beneath them fills a four-column
 * grid exactly — no gaps, whatever lands where. `tall` was tried and dropped:
 * a two-row span mixed with single-row ones leaves auto-placement holes at
 * some counts, and a bento with a gap in it looks like a bug rather than a
 * layout.
 */
const HEAD: readonly TileSpan[] = ["hero", "unit", "unit", "wide"];

/**
 * And then this, forever.
 *
 * Two units and a wide is one four-column row. Repeating it means the grid
 * packs cleanly at any number of tiles, so nothing here has to know how many
 * figures a particular person's pack happens to contain.
 */
const REPEAT: readonly TileSpan[] = ["unit", "unit", "wide"];

export function slotSpan(index: number): TileSpan {
  if (index < HEAD.length) {
    return HEAD[index]!;
  }
  return REPEAT[(index - HEAD.length) % REPEAT.length]!;
}

/**
 * How many tiles the surface shows.
 *
 * A limit rather than everything available, because the point of this screen
 * is the answer and a wall of twenty-nine figures is the file on someone's
 * money, not a bearing. Twelve fills the head plus two full repeats.
 */
export const MAX_TILES = 12;

/* ----------------------------------------------------- the arrangement */

/**
 * Figures that go first when they are there at all.
 *
 * The rule is "anything wrong, then the headline". Breaches come before good
 * news because a screen that leads with a healthy net position while an
 * allowance is blown has buried the only thing on it worth acting on. This is
 * the app's own judgement and it is what ships — the model is asked to
 * improve on it, not to supply it, which is what keeps the surface working
 * with no model key at all.
 */
const PRIORITY: readonly TileId[] = [
  "unrecorded-over",
  "inbox-pending",
  "wallet-drift",
  "net-position",
  "free",
  "projected-kept",
  "invested",
  "wallet-return",
];

/** After the priority list, families in this order. */
const FAMILY_ORDER: readonly FactFamily[] = [
  "now",
  "month",
  "ahead",
  "run",
  "wallet",
];

/**
 * The app's own ordering of whatever figures exist.
 *
 * Deterministic, so two renders of the same pack agree, and total, so every
 * available figure has a place even past `MAX_TILES` — the caller trims, and
 * a pinned tile at slot ten needs the list to reach slot ten.
 */
export function defaultArrangement(facts: BearingFacts): TileId[] {
  const available = new Set(
    facts.facts.map((fact) => fact.id).filter(isTileId),
  );

  const ordered: TileId[] = [];
  const take = (id: TileId) => {
    if (available.delete(id)) {
      ordered.push(id);
    }
  };

  for (const id of PRIORITY) {
    take(id);
  }

  for (const family of FAMILY_ORDER) {
    for (const fact of facts.facts) {
      if (fact.family === family && isTileId(fact.id)) {
        take(fact.id);
      }
    }
  }

  return ordered;
}

/** Where the user has put a tile themselves: figure id to slot index. */
export type TilePins = Readonly<Record<string, number>>;

/**
 * The order actually rendered.
 *
 * Pinned tiles hold their slots and the proposal fills what is left. That
 * precedence is the whole bargain of a draggable surface: a model that
 * reshuffles a choice somebody just made with their finger is the feature
 * undoing its own point, and one that ignored the proposal entirely would
 * make "Rearrange" a button that does nothing.
 *
 * A pin naming a figure the pack no longer carries is dropped rather than
 * held open — someone who disconnects their bank should not be left with a
 * hole where the balance used to be.
 */
export function mergeArrangement(
  proposed: readonly string[],
  pins: TilePins,
  facts: BearingFacts,
  limit: number = MAX_TILES,
): TileId[] {
  const available = new Set(
    facts.facts.map((fact) => fact.id).filter(isTileId),
  );

  const placed = new Map<number, TileId>();
  const pinnedTiles = new Set<TileId>();

  for (const [id, slot] of Object.entries(pins)) {
    if (
      !isTileId(id) ||
      !available.has(id) ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= limit ||
      placed.has(slot)
    ) {
      continue;
    }
    placed.set(slot, id);
    pinnedTiles.add(id);
  }

  // The proposal, then the app's own ordering behind it. A model that names
  // six figures should not leave six empty slots, and a model that names none
  // should leave the surface exactly as it would have been without one.
  const queue: TileId[] = [];
  const queued = new Set<TileId>();
  for (const id of [...proposed, ...defaultArrangement(facts)]) {
    if (
      isTileId(id) &&
      available.has(id) &&
      !pinnedTiles.has(id) &&
      !queued.has(id)
    ) {
      queue.push(id);
      queued.add(id);
    }
  }

  // Always dense. A gap in a bento reads as a bug rather than as a layout,
  // so the list is exactly as long as there are figures to fill it and a pin
  // pointing past the end is honoured as "late" rather than left as a hole.
  const count = Math.min(limit, pinnedTiles.size + queue.length);
  const result: (TileId | null)[] = new Array<TileId | null>(count).fill(null);

  const beyond: TileId[] = [];
  for (const [slot, id] of [...placed].sort(([left], [right]) => left - right)) {
    if (slot < count && result[slot] === null) {
      result[slot] = id;
    } else {
      beyond.push(id);
    }
  }

  const fill = [...queue, ...beyond];
  let next = 0;
  for (let slot = 0; slot < count; slot += 1) {
    if (result[slot] === null) {
      result[slot] = fill[next] ?? null;
      next += 1;
    }
  }

  return result.filter((id): id is TileId => id !== null);
}
