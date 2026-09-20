/**
 * The five cards the Bearing is made of.
 *
 * `bearing-facts.ts` puts a `family` on every datum "because the surface
 * groups by it", and that grouping is now the whole layout: one card per
 * family, every one of the twenty-nine figures inside exactly one of them.
 * It replaces three mechanisms that each answered "which of these matters?"
 * — a model's arrangement, the reader's pins, and a twelve-slot bento — with
 * a fixed list short enough not to need any of them.
 *
 * Pure, and the one place the two clients agree about what a card is. Holds
 * no words of its own beyond a message key: a card's name belongs to the
 * catalogue, in the reader's language.
 */

import type { Key } from "./i18n/t";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import type { BearingFacts, FactFamily } from "./bearing-facts";
import { formatFact } from "./month-facts";
import { BEARING_TILES, type TileId, type TileSeries } from "./bearing-tiles";
import type { PanelBlock, PanelChrome } from "./bearing-panels";

export type CardId = FactFamily;

/**
 * The order the cards stand in.
 *
 * `month` first because it is the question the screen is opened for, and
 * `now` second because the headline has already answered most of it. The
 * remaining three are in widening horizons, which is the order
 * `bearing-facts.ts` builds them in.
 */
export const CARD_ORDER: readonly CardId[] = [
  "month",
  "now",
  "run",
  "ahead",
  "wallet",
];

export const CARD_NAME_KEYS: Record<CardId, Key> = {
  month: "bearing.cards.month",
  now: "bearing.cards.now",
  run: "bearing.cards.run",
  ahead: "bearing.cards.ahead",
  wallet: "bearing.cards.wallet",
};

/**
 * What each card draws under its figures.
 *
 * `bearing-panels.ts` used to key this by tile, with a partial per-tile table
 * over a per-family default. One card per family collapses the two, but the
 * curation in the per-tile table must not be lost with it: `month-read` and
 * `arrived-charges` are the expensive blocks, and the reason they were named
 * on `free` rather than on the month family was so the other seven month
 * tiles did not pay for them. With a single month card that argument becomes
 * "exactly one card pays", which the tests above hold this to.
 */
export const CARD_FAMILY_BLOCKS: Record<CardId, readonly PanelBlock[]> = {
  month: [
    "arrived-charges",
    "spend-strip",
    "still-to-come",
    "month-comparison",
    "month-read",
  ],
  now: ["money-on-hand", "cash-accounts", "recent-on-account", "review-inbox"],
  run: ["close-shelf", "month-score", "budget-progress", "trend"],
  ahead: ["projection"],
  wallet: ["wallets", "weight-bars", "fund-cost"],
};

const CARD_CHROME: Record<CardId, PanelChrome> = {
  month: "month-scope",
  now: "none",
  run: "streak",
  ahead: "horizon",
  wallet: "none",
};

export interface CardFigure {
  id: TileId;
  label: string;
  /** The app's formatted value — never a model's. */
  display: string;
  value: number;
  sense: "up-is-good" | "up-is-bad" | "neutral";
  note: string | null;
  /** Null when this figure has nowhere honest to lead. */
  href: string | null;
  /**
   * The shape drawn behind this figure, or null when it draws none.
   *
   * Here for the same reason `href` is: it is a fact about the figure that
   * both clients need in order to draw a row, and a card list that carries
   * one but not the other is not actually the one place they agree. The web
   * card list imported `BEARING_TILES` to look this up per figure, which is
   * a reach past this module into the table it is built from — and the
   * phone would have had to make the identical reach. Copied, not
   * re-exported: a client asks a card what its figures are and gets the
   * whole answer.
   */
  series: TileSeries | null;
}

export interface BearingCard {
  id: CardId;
  nameKey: Key;
  /** The figure shown while the card is closed. Null only if it has none. */
  lead: CardFigure | null;
  figures: CardFigure[];
  blocks: readonly PanelBlock[];
  chrome: PanelChrome;
  /**
   * The distinct surfaces this card's figures are explained on.
   *
   * Never a single chosen href. Only `wallet` has one destination; the rest
   * carry two or three, and four figures across the pack carry none at all.
   * Picking one would be inventing a destination for the others, which
   * `bearing-tiles.ts` is explicit about not doing.
   */
  destinations: string[];
}

/**
 * The cards, filled in from the pack as it stands now.
 *
 * `formatMoney` is the caller's because the display currency is the
 * browser's `localStorage` and no server can know it — the same reason
 * `renderArrangement` took one before this replaced it.
 *
 * A family with no figures yields no card rather than an empty one: the pack
 * omits a figure it cannot state honestly, so an empty family means "nothing
 * true to say here", and a card saying that is worse than no card.
 */
export function buildBearingCards(
  facts: BearingFacts,
  formatMoney: (amount: number) => string,
  locale: Locale = DEFAULT_LOCALE,
): BearingCard[] {
  const cards: BearingCard[] = [];

  for (const id of CARD_ORDER) {
    const figures: CardFigure[] = [];

    for (const fact of facts.facts) {
      if (fact.family !== id) {
        continue;
      }
      const meta = BEARING_TILES[fact.id as TileId];
      if (!meta) {
        continue;
      }
      figures.push({
        id: fact.id as TileId,
        label: fact.label,
        display: formatFact(fact, formatMoney, locale),
        value: fact.value,
        sense: fact.sense,
        note: fact.note ?? null,
        href: meta.href,
        series: meta.series ?? null,
      });
    }

    if (figures.length === 0) {
      continue;
    }

    const destinations: string[] = [];
    for (const figure of figures) {
      if (figure.href && !destinations.includes(figure.href)) {
        destinations.push(figure.href);
      }
    }

    cards.push({
      id,
      nameKey: CARD_NAME_KEYS[id],
      lead: figures[0] ?? null,
      figures,
      blocks: CARD_FAMILY_BLOCKS[id],
      chrome: CARD_CHROME[id],
      destinations,
    });
  }

  return cards;
}
