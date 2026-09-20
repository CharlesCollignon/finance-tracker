# The Bearing as Five Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Bearing's twelve-tile draggable bento with a two-figure headline and five accordion cards, one per fact family, and narrow the app on wide screens.

**Architecture:** A new pure core module `bearing-cards.ts` becomes the single source of what the five cards are — family, lead figure, member figures, blocks, destinations — and both clients read it. `spine.ts` gains one field so its existing honesty ladder can drive a two-figure headline instead of a one-figure one; nothing else about it changes. The arranger (the model that chose which tiles led), drag-to-reorder and pinning are deleted from both clients and from core.

**Tech Stack:** TypeScript, Next.js 16 App Router (web), Expo Router + React Native (phone), Tailwind 4, vitest (core only), `@finance/core` workspace package.

**Spec:** `docs/superpowers/specs/2026-09-20-bearing-as-five-cards-design.md`

## Global Constraints

- **Tests live only in `packages/core`.** `apps/web` and `apps/mobile` have no test harness. Core modules are TDD'd; component work is verified by typecheck, `npx knip`, a production build, and looking at it.
- **Every user-facing string goes through the en/fr catalogues** in `packages/core/src/i18n/messages/{en,fr}.ts`. Both files must stay structurally identical or `src/i18n/unused-keys.test.ts` fails.
- **No new runtime dependencies.** In particular **do not add `motion`** — `knip.jsonc` records it as debt pending deletion. Numbers animate through the existing `AnimatedAmount`.
- **One easing curve.** Use `cssEasing()` and `DURATION` from `@finance/core/motion`. Never introduce a second cubic-bezier.
- **Reduced motion** is honoured via `usePrefersReducedMotion()` (web) for every animation added.
- **Never invent a destination.** `bearing-tiles.ts`: _"A tile with nowhere honest to lead leads nowhere; inventing a destination would teach people that pressing tiles is a coin flip."_ A figure links only where `BEARING_TILES[id].href` is non-null.
- **Gate command after every task:** `pnpm --filter web exec tsc --noEmit && pnpm --filter @finance/core exec vitest run && npx knip`
- **Known pre-existing failure:** `src/still-to-come.test.ts` fails on `main` and is unrelated to this work. Treat the suite as green if it is the only failure.

## File Structure

**Created**

- `packages/core/src/bearing-cards.ts` — the five cards; family, lead figure, figures, blocks, destinations
- `packages/core/src/bearing-cards.test.ts` — its tests
- `apps/web/components/react-bits/SpotlightCard.tsx` — pointer-follow interior glow, adapted
- `apps/web/components/react-bits/BorderGlow.tsx` — edge glow, adapted
- `apps/web/components/finance/bearing/BearingCards.tsx` — the card list, replaces `BearingGrid`
- `apps/web/components/finance/bearing/Headline.tsx` — the two-figure hero
- `apps/mobile/src/components/bearing/BearingCards.tsx` — the phone's card list
- `apps/mobile/src/components/bearing/Headline.tsx` — the phone's hero

**Modified**

- `apps/web/components/layout/PageContainer.tsx` — xl width
- `apps/web/lib/layout-shell.ts` — xl width, kept in step
- `packages/core/src/spine.ts` — add `onHand` to `SpineState`
- `packages/core/src/bearing-tiles.ts` — drop arrangement/pin/span exports, keep ids + hrefs
- `packages/core/src/bearing-panels.ts` — keyed by family, not tile
- `apps/web/app/(app)/bearing/page.tsx` — rewritten around cards
- `apps/web/components/finance/bearing/Spine.tsx` — ring + flame only, headline removed
- `apps/mobile/src/app/(tabs)/index.tsx` — rewritten around cards
- `apps/mobile/src/lib/bearing.ts` — arranger functions removed
- `knip.jsonc` — dependency list
- `apps/web/package.json`, `apps/mobile/package.json` — dependency removals

**Deleted**

- `packages/core/src/bearing-grid.ts` + `bearing-grid.test.ts`
- `packages/core/src/bearing-read.ts` + `bearing-read.test.ts`
- `packages/core/src/bearing-prompt.ts`
- `packages/core/src/bearing-budget.ts`
- `apps/web/components/finance/bearing/BearingGrid.tsx`
- `apps/web/components/finance/bearing/ArrangeButton.tsx`
- `apps/web/components/finance/bearing/Tile.tsx`
- `apps/web/lib/bearing/write.ts`, `apps/web/lib/bearing/client.ts`
- `apps/web/app/api/bearing/route.ts`
- `apps/web/lib/use-grid-columns.ts` (only `BearingGrid` uses it — confirm during Task 7)
- `apps/mobile/src/components/bearing/BearingTile.tsx`

---

### Task 1: Narrow the app on wide screens

Independent of everything else and shippable alone.

**Files:**

- Modify: `apps/web/components/layout/PageContainer.tsx`
- Modify: `apps/web/lib/layout-shell.ts`

**Interfaces:**

- Consumes: nothing
- Produces: nothing — a pure CSS change

- [ ] **Step 1: Change the container's xl step**

In `apps/web/components/layout/PageContainer.tsx`, replace `xl:max-w-[90rem]` with `xl:max-w-6xl`:

```tsx
        // Kept in step with SHELL_HEADER_INNER_CLASS — see the note there.
        "mx-auto w-full min-w-0 max-w-lg md:max-w-3xl lg:max-w-5xl xl:max-w-6xl",
```

- [ ] **Step 2: Change the header band to match**

In `apps/web/lib/layout-shell.ts`, in `SHELL_HEADER_INNER_CLASS`, replace `xl:max-w-[90rem]` with `xl:max-w-6xl`:

```ts
export const SHELL_HEADER_INNER_CLASS =
  "mx-auto flex h-[var(--shell-header-height)] w-full min-w-0 max-w-lg " +
  "items-center justify-between gap-2 px-4 " +
  "sm:gap-3 md:max-w-3xl md:gap-4 md:px-6 lg:max-w-5xl xl:max-w-6xl";
```

- [ ] **Step 3: Update the doc comment that explains the old number**

The comment in `layout-shell.ts` justifies 90rem by the Month surface, which is retired. Replace that paragraph:

```ts
/**
 * Shared app shell dimensions — keep SideNav + PageHeader borders aligned.
 *
 * The width steps here and in PageContainer have to stay in step with each
 * other: they are what makes the header band's contents line up with the
 * cards below it, and changing one alone visibly offsets the title from the
 * column it belongs to.
 *
 * The `xl` step exists because the app had no desktop tier at all — `lg` was
 * the last word, so above 1024px of content the whole app sat in a 1024px
 * column with the backdrop showing on either side. It was 90rem, chosen for
 * the Month surface's two columns; Month is retired and the width outlived
 * its reason, so it is 72rem — wide enough for the Ledger's table and narrow
 * enough that a line of prose stops short of a tiring measure.
 */
```

- [ ] **Step 4: Verify the Ledger's table still fits**

Run the dev server bound for a Windows browser (this machine is WSL2 in `nat` mode; `localhost` will not load):

```bash
pnpm --filter web exec next dev -H 0.0.0.0 -p 3210
hostname -I | awk '{print $1}'   # hand this IP to the user, not localhost
```

Open `/transactions` at a viewport wider than 1280px and confirm no horizontal scroll and no truncated columns. Check `/history` (the category grid) too.

- [ ] **Step 5: Gate and commit**

```bash
pnpm --filter web exec tsc --noEmit && npx knip
git add apps/web/components/layout/PageContainer.tsx apps/web/lib/layout-shell.ts
git commit -m "Stop the app at 72rem, now that Month is not what sets it"
```

---

### Task 2: The card model in core

**Files:**

- Create: `packages/core/src/bearing-cards.ts`
- Create: `packages/core/src/bearing-cards.test.ts`
- Modify: `packages/core/package.json` (add the `./bearing-cards` export)

**Interfaces:**

- Consumes: `FactFamily`, `BearingFacts`, `BearingFact` from `./bearing-facts`; `TileId`, `BEARING_TILES` from `./bearing-tiles`; `PanelBlock`, `PanelChrome` from `./bearing-panels`; `formatFact` from `./month-facts`; `Locale`, `DEFAULT_LOCALE` from `./i18n/locale`
- Produces:
  - `type CardId = FactFamily`
  - `interface CardFigure { id: TileId; label: string; display: string; value: number; sense: "up-is-good" | "up-is-bad" | "neutral"; note: string | null; href: string | null }`
  - `interface BearingCard { id: CardId; nameKey: Key; lead: CardFigure | null; figures: CardFigure[]; blocks: readonly PanelBlock[]; chrome: PanelChrome; destinations: string[] }`
  - `const CARD_ORDER: readonly CardId[]`
  - `function buildBearingCards(facts: BearingFacts, formatMoney: (n: number) => string, locale?: Locale): BearingCard[]`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/bearing-cards.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { BEARING_TILE_IDS, BEARING_TILES, type TileId } from "./bearing-tiles";
import {
  CARD_ORDER,
  CARD_FAMILY_BLOCKS,
  buildBearingCards,
  type BearingCard,
} from "./bearing-cards";
import type { BearingFact, BearingFacts } from "./bearing-facts";

const euro = (n: number) => `${n.toFixed(2)} €`;

function fact(
  id: TileId,
  family: BearingFact["family"],
  value = 100,
): BearingFact {
  return {
    id,
    family,
    label: id,
    unit: "money",
    value,
    sense: "up-is-good",
  };
}

function pack(facts: BearingFact[]): BearingFacts {
  return { asOf: "2026-09-20", facts, missing: [], thin: false };
}

describe("CARD_ORDER", () => {
  it("is the five families, headline families first", () => {
    expect(CARD_ORDER).toEqual(["month", "now", "run", "ahead", "wallet"]);
  });
});

describe("buildBearingCards", () => {
  it("puts every figure in its own family's card and nowhere else", () => {
    const facts = pack([
      fact("free", "month"),
      fact("committed", "month"),
      fact("on-hand", "now"),
      fact("streak", "run"),
      fact("runway-months", "ahead"),
      fact("wallet-cost", "wallet"),
    ]);

    const cards = buildBearingCards(facts, euro);
    const placed = cards.flatMap((card) => card.figures.map((f) => f.id));

    expect(placed).toHaveLength(6);
    expect(new Set(placed).size).toBe(6);
    expect(
      cards.find((c) => c.id === "month")!.figures.map((f) => f.id),
    ).toEqual(["free", "committed"]);
  });

  it("leads a card with its first figure, and formats it through the caller", () => {
    const cards = buildBearingCards(pack([fact("free", "month", 880.2)]), euro);
    const month = cards.find((c) => c.id === "month")!;

    expect(month.lead?.id).toBe("free");
    expect(month.lead?.display).toBe("880.20 €");
  });

  /**
   * The rule `bearing-tiles.ts` states in prose: a figure with nowhere
   * honest to lead leads nowhere, and a card may only offer destinations
   * its own figures already carry.
   */
  it("offers only destinations its figures actually carry", () => {
    const cards = buildBearingCards(
      pack([
        fact("free", "month"), // href null
        fact("committed", "month"), // /recurring
        fact("unrecorded-so-far", "month"), // /budgets
      ]),
      euro,
    );
    const month = cards.find((c) => c.id === "month")!;

    expect(month.destinations).toEqual(["/recurring", "/budgets"]);
    expect(month.figures.find((f) => f.id === "free")!.href).toBeNull();
  });

  it("drops a card with no figures rather than drawing an empty one", () => {
    const cards = buildBearingCards(pack([fact("on-hand", "now")]), euro);
    expect(cards.map((c) => c.id)).toEqual(["now"]);
  });
});

describe("the card model covers the whole vocabulary", () => {
  it("gives every family a block list", () => {
    for (const id of CARD_ORDER) {
      expect(CARD_FAMILY_BLOCKS[id].length).toBeGreaterThan(0);
    }
  });

  /**
   * The expensive blocks cost a fetch when a card opens. Each must appear on
   * exactly one card, or opening two cards pays twice for one answer.
   */
  it("puts each expensive block on exactly one card", () => {
    for (const block of ["month-read", "arrived-charges"] as const) {
      const carrying = CARD_ORDER.filter((id) =>
        CARD_FAMILY_BLOCKS[id].includes(block),
      );
      expect(carrying).toHaveLength(1);
    }
  });

  it("knows a href for every tile id the vocabulary has", () => {
    for (const id of BEARING_TILE_IDS) {
      expect(BEARING_TILES[id]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/bearing-cards.test.ts`
Expected: FAIL — `Failed to resolve import "./bearing-cards"`

- [ ] **Step 3: Write the module**

Create `packages/core/src/bearing-cards.ts`:

```ts
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
import { BEARING_TILES, type TileId } from "./bearing-tiles";
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
```

- [ ] **Step 4: Add the subpath export**

`packages/core/package.json` lists every subpath explicitly (the wildcard was removed deliberately — see `knip.jsonc`). Add, in alphabetical position:

```json
    "./bearing-cards": "./src/bearing-cards.ts",
```

- [ ] **Step 5: Add the five card names to both catalogues**

In `packages/core/src/i18n/messages/en.ts`, inside the existing `bearing:` block:

```ts
    cards: {
      month: "This month",
      now: "The accounts",
      run: "Your run",
      ahead: "The year ahead",
      wallet: "Wallets",
    },
```

In `fr.ts`, at the same position in the same block:

```ts
    cards: {
      month: "Ce mois-ci",
      now: "Les comptes",
      run: "Votre régularité",
      ahead: "L'année à venir",
      wallet: "Portefeuilles",
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/bearing-cards.test.ts src/i18n`
Expected: PASS, all tests

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/bearing-cards.ts packages/core/src/bearing-cards.test.ts \
        packages/core/package.json packages/core/src/i18n/messages/en.ts \
        packages/core/src/i18n/messages/fr.ts
git commit -m "Say what the Bearing's five cards are, once, for both clients"
```

---

### Task 3: Let the spine carry two figures

**Files:**

- Modify: `packages/core/src/spine.ts`
- Modify: `packages/core/src/spine.test.ts`

**Interfaces:**

- Consumes: `MonthPulse` from `./month-pulse`
- Produces: `SpineState` gains `onHand: number | null`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/spine.test.ts` (reuse whatever pulse fixture that file already defines — do not invent a second one):

```ts
describe("the headline's second figure", () => {
  it("carries what the accounts hold when a balance is readable", () => {
    const state = resolveSpine({
      pulse: pulseWith({ onHand: 1240.5, free: 880.2 }),
      everClosed: true,
      closes: { streak: 3, bestStreak: 5 },
      remaining: 400,
    });

    expect(state.onHand).toBe(1240.5);
    expect(state.headline).toEqual({ figure: "free", value: 880.2 });
  });

  /**
   * The ladder's whole argument: a reader with no bank must not be shown a
   * figure that implies one. The headline falls back to the recorded
   * remaining, and the second figure is simply absent rather than zero.
   */
  it("has no second figure without a readable balance", () => {
    const state = resolveSpine({
      pulse: pulseWith({ onHand: null, free: null }),
      everClosed: false,
      closes: null,
      remaining: 400,
    });

    expect(state.onHand).toBeNull();
    expect(state.headline.figure).toBe("remaining");
  });
});
```

If `spine.test.ts` has no `pulseWith` helper, add one at the top of the file that spreads over whatever complete `MonthPulse` fixture it already uses.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @finance/core exec vitest run src/spine.test.ts`
Expected: FAIL — `state.onHand` is `undefined`, not `1240.5`

- [ ] **Step 3: Add the field**

In `packages/core/src/spine.ts`, extend the interface:

```ts
export interface SpineState {
  step: "no-balance" | "no-close" | "measuring" | "lit";
  headline: { figure: "free" | "remaining"; value: number };
  /**
   * What the accounts hold, for the headline's first line. Null exactly when
   * no balance is readable — which is the same condition that sends
   * `headline` to `remaining`, and is why this is a separate nullable field
   * rather than a second entry in `headline`: one of the two figures can be
   * absent while the other is not.
   */
  onHand: number | null;
  ring: SpineRing;
  flame: { streak: number; best: number } | null;
}
```

And populate it in `resolveSpine`, which already receives `pulse`:

```ts
return {
  step,
  headline,
  onHand: pulse.onHand,
  ring: pulse.overRecorded ? { kind: "absent" } : ring,
  flame,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/spine.test.ts`
Expected: PASS — including every pre-existing spine test, unchanged

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/spine.ts packages/core/src/spine.test.ts
git commit -m "Let the spine say what the accounts hold, beside what is left"
```

---

### Task 4: The two React Bits card surfaces, adapted

**Files:**

- Create: `apps/web/components/react-bits/SpotlightCard.tsx`
- Create: `apps/web/components/react-bits/BorderGlow.tsx`

**Interfaces:**

- Consumes: `cn` from `@/lib/utils`, `usePrefersReducedMotion` from `@/lib/use-reduced-motion`
- Produces: `<SpotlightCard className? children>`, `<BorderGlow className? children>` — both plain wrappers taking no colour props

- [ ] **Step 1: Write SpotlightCard**

The original sets React state on every `mousemove` and hardcodes `bg-neutral-900`. Both are replaced: the pointer writes CSS custom properties on a ref, so moving the pointer repaints without re-rendering the card's children (an open accordion, in this case); and the colour comes from the theme.

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * A card with a glow that follows the pointer across it.
 *
 * Adapted from React Bits' SpotlightCard, with two changes it needed to
 * live here. Its colours were `bg-neutral-900` and `border-neutral-800`,
 * which would have pinned a second palette beside the app's and painted over
 * the veil `GLASS_CARD` lets through; the surface is the caller's now and
 * this draws only the glow.
 *
 * And the original tracked the pointer in React state, re-rendering on every
 * mousemove. Here the pointer writes two CSS custom properties onto the
 * element, so the browser repaints and React never runs — which matters
 * because these cards contain an open accordion, and re-rendering that
 * sixty times a second to move a gradient is the kind of thing that makes an
 * interface feel cheap on a laptop.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        if (reducedMotion || !ref.current) {
          return;
        }
        const rect = ref.current.getBoundingClientRect();
        ref.current.style.setProperty(
          "--spot-x",
          `${event.clientX - rect.left}px`,
        );
        ref.current.style.setProperty(
          "--spot-y",
          `${event.clientY - rect.top}px`,
        );
        ref.current.style.setProperty("--spot-on", "1");
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--spot-on", "0");
      }}
      className={cn("relative isolate overflow-hidden", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10",
          "opacity-[var(--spot-on,0)] transition-opacity duration-500",
          "bg-[radial-gradient(circle_at_var(--spot-x,50%)_var(--spot-y,50%),color-mix(in_srgb,var(--primary)_18%,transparent),transparent_70%)]",
        )}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write BorderGlow**

The original takes a `backgroundColor` hex prop and paints it itself, does its own mesh gradient from three hex colours, and re-renders on every pointer move. Here it draws the edge only, in the theme's accent, and writes the angle and proximity as custom properties.

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/** Below this, the pointer is not near enough an edge to light it. */
const EDGE_SENSITIVITY = 0.35;

/**
 * A card whose edge lights where the pointer approaches it.
 *
 * Adapted from React Bits' BorderGlow. The original owned the card's
 * background — it took a `backgroundColor` hex and painted it — and built
 * its border from a seven-stop mesh of three hard-coded hex colours. Both
 * are gone: the surface belongs to the caller, and the edge is the app's own
 * accent, so a theme change moves this with it.
 *
 * Like `SpotlightCard`, the pointer writes custom properties rather than
 * state. The original called two `setState`s per `pointermove`; five of these
 * in a list, each wrapping an accordion, is the version of that which is
 * actually felt.
 *
 * The two effects are not the same one twice. This lights the *edge* the
 * pointer is near; the spotlight follows it across the *interior*. Layering
 * them is the intended look.
 */
export function BorderGlow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const el = ref.current;
        if (reducedMotion || !el) {
          return;
        }
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = event.clientX - rect.left - cx;
        const dy = event.clientY - rect.top - cy;

        // How close to an edge, 0 at the centre and 1 at the border. The
        // original's arithmetic, kept: the larger of the two axis ratios.
        const proximity = Math.min(
          1,
          Math.max(Math.abs(dx) / cx, Math.abs(dy) / cy),
        );
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        el.style.setProperty("--glow-angle", `${angle.toFixed(2)}deg`);
        el.style.setProperty(
          "--glow-on",
          proximity < EDGE_SENSITIVITY
            ? "0"
            : ((proximity - EDGE_SENSITIVITY) / (1 - EDGE_SENSITIVITY)).toFixed(
                3,
              ),
        );
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--glow-on", "0");
      }}
      className={cn("relative isolate", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-[inherit]",
          "opacity-[var(--glow-on,0)] transition-opacity duration-300",
          "[background:conic-gradient(from_var(--glow-angle,0deg),color-mix(in_srgb,var(--primary)_70%,transparent),transparent_25%,transparent_75%,color-mix(in_srgb,var(--primary)_70%,transparent))]",
          // Border-box only: the fill is the caller's surface, and painting
          // under it would wash the figures out.
          "[mask:linear-gradient(#000_0_0)_padding-box,linear-gradient(#000_0_0)]",
          "[mask-composite:exclude] [padding:1px]",
        )}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec eslint components/react-bits/SpotlightCard.tsx components/react-bits/BorderGlow.tsx
```

Expected: both clean. `react-hooks/refs` will reject any ref write during render — these only write inside event handlers, which is allowed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/react-bits/SpotlightCard.tsx apps/web/components/react-bits/BorderGlow.tsx
git commit -m "Take the spotlight and the border glow, and leave their palettes behind"
```

---

### Task 5: The web headline

**Files:**

- Create: `apps/web/components/finance/bearing/Headline.tsx`
- Modify: `apps/web/components/finance/bearing/Spine.tsx`

**Interfaces:**

- Consumes: `SpineState` from `@finance/core/spine` (with `onHand` from Task 3); `AnimatedAmount` from `@/components/finance/AnimatedAmount`; `useFormatCurrency` from `@/lib/use-currency`
- Produces: `<Headline state={SpineState} />`; `Spine` keeps its export but no longer draws a headline

- [ ] **Step 1: Write the headline**

```tsx
"use client";

import type { SpineState } from "@finance/core/spine";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";

/**
 * What the accounts hold, and what they are on course to hold.
 *
 * The two figures a reader opens this screen for, and nothing else. Both come
 * off `resolveSpine`, which is kept rather than replaced because its ladder
 * is the thing that makes them honest: a reader with no bank connected gets
 * no `onHand` at all and a headline that falls back to what the ledger has
 * recorded, rather than a confident zero.
 *
 * Numbers go through `AnimatedAmount` — the house count-up. React Bits'
 * `CountUp` was vendored here once and removed: it formats its own digits and
 * takes no format function, so it cannot render the reader's currency, and it
 * draws straight through the privacy blur.
 */
export function Headline({ state }: { state: SpineState }) {
  const t = useT();
  const format = useFormatCurrency();

  return (
    <div className="flex flex-col gap-4 py-2">
      {state.onHand !== null ? (
        <Figure
          label={t("bearingFacts.onHand")}
          value={state.onHand}
          format={format}
        />
      ) : null}
      <Figure
        label={t(
          state.headline.figure === "free"
            ? "bearingFacts.free"
            : "bearing.remaining",
        )}
        value={state.headline.value}
        format={format}
        muted={state.onHand !== null}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  format,
  muted = false,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <AnimatedAmount
        value={value}
        format={format}
        title={label}
        className={
          muted
            ? "text-3xl font-semibold tabular-nums md:text-4xl"
            : "text-4xl font-semibold tabular-nums md:text-5xl"
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Add the one missing key**

`bearing.remaining` is the fallback label when no balance is readable. It does **not** exist today — the `remaining:` keys at `en.ts:1301` and `en.ts:1703` are in other namespaces. Add to both catalogues inside the `bearing:` block:

```ts
    remaining: "Recorded as left",   // en
    remaining: "Enregistré comme restant",   // fr
```

- [ ] **Step 3: Strip the headline out of Spine**

`Spine.tsx` keeps the ring and the flame and stops drawing a figure — it is about to be rendered inside the Run card. Remove the headline markup and the `AnimatedAmount`/currency imports it used, and keep the component's existing props. Do not touch `spine.ts`'s ring maths.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: errors only in `bearing/page.tsx`, which Task 6 rewrites. Do not fix them here.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/finance/bearing/Headline.tsx \
        apps/web/components/finance/bearing/Spine.tsx \
        packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts
git commit -m "Put the two figures at the top, and take the ring off the headline"
```

---

### Task 6: The web card list, and the page

**Files:**

- Create: `apps/web/components/finance/bearing/BearingCards.tsx`
- Modify: `apps/web/app/(app)/bearing/page.tsx`
- Delete: `apps/web/components/finance/bearing/BearingGrid.tsx`
- Delete: `apps/web/components/finance/bearing/Tile.tsx`

**Interfaces:**

- Consumes: `buildBearingCards`, `BearingCard` from `@finance/core/bearing-cards`; the existing `Panel` from `./Panel`; `SpotlightCard`, `BorderGlow` from Task 4
- Produces: `<BearingCards facts={BearingFacts} trend={number[]} spine={SpineState} />`

- [ ] **Step 1: Write the card list**

One card per family, closed by default, one open at a time. The card is `BorderGlow` wrapping `SpotlightCard` wrapping the app's `GLASS_CARD` surface — edge, interior, then the surface itself, which stays the caller's.

Reuse the existing `Panel` for the block area rather than writing a second one; it already fetches lazily. Its signature is `Panel({ tile }: { tile: RenderedTile })` and its first line is `panelFor(tile.id, tile.family)` — both die in Task 9. Change it to `Panel({ card }: { card: BearingCard })` and drop the `panelFor` call entirely: a card already carries `blocks`, `chrome` and `destinations`, which is everything `spec` was giving it.

The expand/collapse uses the grid `0fr`/`1fr` trick and `cssEasing()`, exactly as `bearing/Panel`'s own `Expand` and the new `BranchedNav` do. Do not add a new animation approach.

The Run card renders `<Spine>` among its blocks — that is where the ring and flame now live.

- [ ] **Step 2: Rewrite the page**

`apps/web/app/(app)/bearing/page.tsx` loses `readPins`, `mergeArrangement`, `arrangementFooting`, `describeArrangementFreshness`, `arrangementsRemaining`, `arrangerConfigured`, the `captionFacts` block, the `freshness` block, the as-of/arrange-hint row and `<ArrangeButton>`. It keeps `gatherBearingFacts`, `buildAttention`, `resolveSpine`, `getMonthlyTrend`, the thin/empty branch and `<AttentionRow>`.

The body becomes:

```tsx
<PageContainer className="flex flex-col gap-6">
  <Headline state={spineState} />
  {attention.length > 0 ? <AttentionRow attention={attention} /> : null}
  <BearingCards
    facts={facts}
    spine={spineState}
    trend={trend.map((point) => point.net)}
  />
</PageContainer>
```

- [ ] **Step 3: Delete the grid and the tile**

```bash
git rm apps/web/components/finance/bearing/BearingGrid.tsx \
       apps/web/components/finance/bearing/Tile.tsx
```

- [ ] **Step 4: Gate**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

Expected: typecheck clean; build succeeds. `knip` will still report the now-orphaned arranger files — Task 7 removes them.

- [ ] **Step 5: Look at it**

Start the dev server bound to all interfaces and hand the user the WSL IP, not `localhost` (this machine is WSL2 in `nat` mode and a `localhost` URL will not load in their Windows browser):

```bash
pnpm --filter web exec next dev -H 0.0.0.0 -p 3210
hostname -I | awk '{print $1}'
```

Confirm: five cards, one opens at a time, the ring and flame appear inside "Your run", figure rows without an href are not dressed as links, and the footer of "This month" offers three destinations.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Draw the Bearing as five cards that open where they stand"
```

---

### Task 7: Delete the arranger from the web app

**Files:**

- Delete: `apps/web/components/finance/bearing/ArrangeButton.tsx`, `apps/web/lib/bearing/write.ts`, `apps/web/lib/bearing/client.ts`, `apps/web/app/api/bearing/route.ts`, `apps/web/lib/use-grid-columns.ts`
- Modify: `apps/web/lib/bearing/store.ts`, `apps/web/lib/actions/bearing.ts`

**Interfaces:**

- Consumes: nothing
- Produces: nothing — `readBearingState` and `readPins` disappear from the app's surface

- [ ] **Step 1: Confirm nothing else imports them**

```bash
grep -rn "ArrangeButton\|saveBearingPinsAction\|readPins\|readBearingState\|arrangerConfigured\|use-grid-columns" \
  apps/web --exclude-dir=node_modules --exclude-dir=.next
```

Expected: no hits outside the files being deleted. If `use-grid-columns` has another importer, keep it and strike it from the delete list.

- [ ] **Step 2: Delete and trim**

```bash
git rm apps/web/components/finance/bearing/ArrangeButton.tsx \
       apps/web/lib/bearing/write.ts apps/web/lib/bearing/client.ts \
       apps/web/app/api/bearing/route.ts apps/web/lib/use-grid-columns.ts
```

Then remove the pin and arrangement functions from `apps/web/lib/bearing/store.ts` and `apps/web/lib/actions/bearing.ts`, keeping any function the panel path still uses. If a file empties entirely, delete it.

- [ ] **Step 3: Remove the dnd-kit dependencies**

```bash
pnpm --filter web remove @dnd-kit/core @dnd-kit/modifiers @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 4: Gate**

```bash
pnpm --filter web exec tsc --noEmit && npx knip && pnpm --filter web build
```

Expected: all clean. `knip` is the gate that proves nothing is orphaned.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Retire the arranger, which had five fixed cards left to arrange"
```

---

### Task 8: The phone

**Files:**

- Create: `apps/mobile/src/components/bearing/Headline.tsx`, `apps/mobile/src/components/bearing/BearingCards.tsx`
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/lib/bearing.ts`
- Delete: `apps/mobile/src/components/bearing/BearingTile.tsx`

**Interfaces:**

- Consumes: `buildBearingCards` from `@finance/core/bearing-cards`; `SpineState` with `onHand`
- Produces: the same five cards, same order, same copy as the web

- [ ] **Step 1: Mirror the headline and the card list**

Same structure and the same core module, with the phone's own primitives. The card surface is the phone's existing glass card — `SpotlightCard` and `BorderGlow` are DOM and CSS (`conic-gradient` masks, `mask-composite`) and pointer-driven, so neither can run here and neither is faked under the same name.

The phone's `AnimatedAmount` already matches the web's 650ms curve; use it for every figure.

- [ ] **Step 2: Strip the reorder out of the tab screen**

Remove `ReorderableList`, `reorderItems`, the `dragged` state, the long-press handle and the pins save from `(tabs)/index.tsx`, and the arranger functions (`getBearingArrangement`, `getBearingPins`, `bearingOrder`, `bearingWritable`, `arrangeBearing`, `saveBearingPins`, `ArrangeOutcome`) from `src/lib/bearing.ts`.

- [ ] **Step 3: Remove the dependency**

```bash
pnpm --filter mobile remove react-native-reorderable-list
```

- [ ] **Step 4: Gate**

```bash
pnpm --filter mobile exec expo customize tsconfig.json
pnpm --filter mobile exec tsc --noEmit
npx knip
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Give the phone the same five cards, and take its drag handle away"
```

---

### Task 9: Delete the arranger from core

Last, so nothing in the plan is ever broken mid-flight.

**Files:**

- Delete: `packages/core/src/bearing-read.ts`, `bearing-read.test.ts`, `bearing-prompt.ts`, `bearing-budget.ts`, `bearing-grid.ts`, `bearing-grid.test.ts`
- Modify: `packages/core/src/bearing-tiles.ts`, `bearing-tiles.test.ts`, `bearing-panels.ts`, `bearing-panels.test.ts`, `packages/core/package.json`, `knip.jsonc`

- [ ] **Step 1: Confirm nothing imports them**

```bash
grep -rn "@finance/core/bearing-\(read\|prompt\|budget\|grid\)" \
  apps packages --exclude-dir=node_modules --exclude-dir=.next
```

Expected: no hits. If any remain, finish Tasks 6–8 before continuing.

- [ ] **Step 2: Delete**

```bash
git rm packages/core/src/bearing-read.ts packages/core/src/bearing-read.test.ts \
       packages/core/src/bearing-prompt.ts packages/core/src/bearing-budget.ts \
       packages/core/src/bearing-grid.ts packages/core/src/bearing-grid.test.ts
```

- [ ] **Step 3: Trim `bearing-tiles.ts`**

Remove `MAX_TILES`, `TileSpan`, `slotSpan`, `TilePins`, `defaultArrangement`, `mergeArrangement` and the `HEAD`/`REPEAT` slot tables. Keep `BEARING_TILE_IDS`, `TileId`, `isTileId`, `TileMeta`, `BEARING_TILES`, `PHONE_PATHS`, `phoneHref`. Delete the tests covering the removed exports, keep the rest.

- [ ] **Step 4: Rekey `bearing-panels.ts` to families**

`panelFor(id, family)` and `TILE_BLOCKS` go; `bearing-cards.ts` owns the family→blocks map now. Keep `PanelBlock` and `PanelChrome`, which `bearing-cards.ts` imports. Update `bearing-panels.test.ts` to match.

- [ ] **Step 5: Remove the dead subpath exports**

Delete `./bearing-read`, `./bearing-prompt`, `./bearing-budget` and `./bearing-grid` from `packages/core/package.json`.

- [ ] **Step 6: Delete the arranger's words from both catalogues**

`src/i18n/unused-keys.test.ts` is a **reachability gate that fails on an unused key**, so deleting the feature without its words breaks the suite. Remove these from the `bearing:` block in `en.ts` _and_ the matching entries in `fr.ts` — the two files must stay structurally identical:

```
arrange, arranging, arrangeHint, arrangementsLeft,
ownOrder, pinned, reorder, resetPins, orderNotSaved, moved
```

Keep `title`, `asOf`, `empty` and the new `cards` and `remaining`. Then confirm:

```bash
pnpm --filter @finance/core exec vitest run src/i18n
```

Expected: PASS. A failure here names the exact key still referenced or still orphaned.

- [ ] **Step 7: Record the unread table as debt**

The arranger's storage is migration 029's `bearing_arrangements`. It is **not** dropped: dropping it is a migration, and this repo has no way to run one. Add to `knip.jsonc`'s existing DEBT commentary, or to the spec, a line saying the table is unread and awaiting a migration that can be proven on a local stack.

- [ ] **Step 8: Full gate**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter mobile exec tsc --noEmit
pnpm --filter @finance/core exec vitest run
npx knip
pnpm --filter web build
```

Expected: all clean; `still-to-come.test.ts` remains the only failure.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Delete the arrangement, its prompt, its budget and its grid"
```

---

## Self-review notes

Checked against the spec:

- Width → Task 1. Headline → Tasks 3, 5, 8. Five cards → Tasks 2, 6, 8. Blocks per family → Task 2 (`CARD_FAMILY_BLOCKS`). Card links → Task 2 (`destinations`, tested). Web surface → Task 4. Phone surface → Task 8. Deletions → Tasks 6–9. Shared module → Task 2. Words → Tasks 2, 5. Testing → Tasks 2, 3.
- `RenderedTile` dies with `bearing-read.ts`; `CardFigure` in Task 2 replaces it, and every consumer (`Tile.tsx`, `Panel.tsx`, the phone's two) is rewritten or deleted in Tasks 6 and 8 before Task 9 removes the type.
- `formatFact` lives in `month-facts.ts`, not `bearing-read.ts`, so it survives the deletion and Task 2 imports it from there.
- Names used consistently throughout: `buildBearingCards`, `BearingCard`, `CardFigure`, `CARD_ORDER`, `CARD_FAMILY_BLOCKS`, `SpineState.onHand`.
- Two gaps the review found and fixed: `bearing.remaining` was left as "check whether it exists" (it does not), and nothing removed the ten arranger-only i18n keys — which `unused-keys.test.ts` fails on, so Task 9 would have ended red.
