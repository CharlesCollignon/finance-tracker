/**
 * What the Bearing can show, and where each figure leads.
 *
 * A tile is one datum, and deliberately so: there is one vocabulary of figure
 * ids, `bearing-facts.ts`'s, and this file only says what a figure means to
 * the surface — its destination, and the shape drawn behind it.
 *
 * It used to hold the bento as well: a sequence of slot spans, the app's own
 * ordering of figures, the reader's pins and the merge of the two with a
 * model's proposed arrangement. All of that went when the Bearing became five
 * fixed cards — `bearing-cards.ts` groups the same figures by the `family`
 * they already carry, which is short enough that nothing has to be ranked.
 * What survives is the part that was never about layout.
 *
 * Pure. No labels live here either — a tile's label is its datum's label,
 * already translated in the pack, so there is one place a figure is named.
 */

/* ------------------------------------------------------------ the tiles */

/**
 * Every figure the Bearing can show.
 *
 * Closed, and worth noting why it can be: unlike a month pack, which carries
 * a datum per category and so has ids nobody can enumerate in advance, every
 * Bearing figure is one of a fixed set.
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
 * never renamed.
 *
 * `on-hand`, `free` and `savings-rate` used to lead to the Month page at
 * `/dashboard`. That page is gone: everything it said about those three
 * figures is now said by the blocks that open inside the card the figure
 * stands in (`bearing-cards.ts`'s `CARD_FAMILY_BLOCKS`), so — like
 * `net-position` — there is no further surface to send a press to.
 */
export const BEARING_TILES: Record<TileId, TileMeta> = {
  "net-position": { href: null, series: "trend" },
  "on-hand": { href: null },
  invested: { href: "/investments" },
  "invested-share": { href: "/investments" },
  "inbox-pending": { href: "/transactions?review=inbox" },
  free: { href: null },
  committed: { href: "/recurring" },
  arriving: { href: "/recurring" },
  "savings-rate": { href: null },
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

/**
 * The phone's answer to the web-only paths above, or null for a footer link
 * that should not exist at all.
 *
 * `BEARING_TILES` is written against the web router, as its own comment
 * says, and the phone used to forward those strings to `router.push`
 * unchanged. Fifteen of the twenty-six tiles with a footer link therefore
 * pointed at a screen Expo Router has never had: there is no `/dashboard`,
 * no `/budgets` and no `/history` anywhere under `apps/mobile/src/app`.
 *
 * `/budgets` still becomes Plan, which is where the phone keeps budget caps,
 * goal pacing, projections, runway and the close history: the whole of what
 * the tiles sent there are about.
 *
 * `/dashboard` and `/history` map to null rather than to a screen, and both
 * for the same reason. `/dashboard` was the Month page; Month is retired, and
 * no `BEARING_TILES` entry points at it any more — `on-hand`, `free` and
 * `savings-rate` lead nowhere now, same as `net-position`, because their
 * panel says what Month used to. `/history` is the Ledger's by-category
 * view, which the phone's Ledger has never had either, and the screen that
 * used to stand in for it — Month, again, for its month-against-previous
 * comparison and its net-per-month trend — is the same retired page. Neither
 * entry is reached through a live `BEARING_TILES` href any more; both stay
 * here, mapped honestly to "no link", rather than being deleted and quietly
 * falling through `phoneHref`'s no-mapping branch to a web-only path if some
 * future tile ever points at either again.
 *
 * Exported, read-only, because `/budgets` → `/planning` is one fact about
 * this app's route topology and `apps/mobile/src/components/bearing/Spine.tsx`
 * needs that same fact for the attention row's own, separately-verified
 * redirect — see that file's `attentionHref` for why it reads this table
 * rather than retyping the string. `/budgets` is the one entry `attentionHref`
 * relies on being a real path rather than null, which is why it is typed as
 * a required `string` below rather than folded into the general
 * `string | null` index signature. If this table's `/budgets` entry ever
 * moves, that is the other place to check.
 */
export const PHONE_PATHS: {
  readonly [path: string]: string | null;
  readonly "/budgets": string;
} = {
  "/dashboard": null,
  "/budgets": "/planning",
  "/history": null,
};

/**
 * Where a tile's figure is explained on the phone, or null for no footer
 * link at all.
 *
 * A translation of `BEARING_TILES`'s web path rather than a second table, so
 * a tile added to the catalogue cannot be forgotten here: anything without a
 * phone-specific answer keeps the path it already had, and those all resolve
 * (`/investments`, `/recurring`, `/transactions`). The query string rides
 * along untouched, which is what keeps `inbox-pending` landing on the Ledger
 * with its review filter already applied.
 *
 * `PHONE_PATHS` can answer a lookup three ways, and only two of them mean the
 * same thing here: `undefined` (the path is not in the table at all) and a
 * `string` (a real phone path) both pass `href` through or translate it as
 * before. `null` is the third and means the table itself says this web path
 * has no phone screen to link to — distinct from "not in the table", and the
 * reason `phoneHref` cannot collapse the two checks below into one.
 */
export function phoneHref(href: string | null): string | null {
  if (href === null) {
    return null;
  }

  const query = href.indexOf("?");
  const path = query < 0 ? href : href.slice(0, query);

  const phone = PHONE_PATHS[path];
  if (phone === undefined) {
    return href;
  }
  if (phone === null) {
    return null;
  }

  return query < 0 ? phone : `${phone}${href.slice(query)}`;
}
