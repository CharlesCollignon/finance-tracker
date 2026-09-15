# Bearing Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Bearing tile expand in place into a panel that explains its figure, on both clients, with Month still present and untouched.

**Architecture:** All judgement is pure and lives in `packages/core` — a shared motion vocabulary and a lookup from tile to panel contents. The clients render it: web inserts a full-width row into the bento grid, mobile grows the open row in its single column. Panel headlines come from the fact pack already loaded, so a panel opens instantly; only its detail is fetched on expand.

**Tech Stack:** TypeScript, vitest, Next.js 16 (App Router, React 19), Expo / React Native 0.86 with Reanimated 4, NativeWind, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-15-bearing-month-merge-design.md`

## Global Constraints

- Every user-facing string goes through `packages/core/src/i18n/messages/en.ts` and `fr.ts`. `en.ts` is the schema — `fr.ts` is typed `typeof en`, so a missing French key is a type error. Never ship a literal.
- New judgement goes in `packages/core` as a pure function with a `.test.ts` beside it. The clients only render. No new logic in `apps/`.
- Motion constants come from `@finance/core/motion` only. No duration, easing or delay literal may appear in `apps/`.
- Reduced motion is honoured: `usePrefersReducedMotion()` on web, `useReducedMotion()` from `react-native-reanimated` on mobile.
- One panel open at a time, on both clients.
- Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/` — per `AGENTS.md`, this version differs from training data.
- Tests run with `pnpm test` (vitest in `@finance/core`).
- Do not touch Month (`apps/web/app/(app)/dashboard/`, `apps/mobile/src/app/(tabs)/month.tsx`) in this plan. It is retired in Plan 2.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `packages/core/src/motion.ts` | The shared motion vocabulary: easing, durations, stagger |
| `packages/core/src/motion.test.ts` | Its tests |
| `packages/core/src/bearing-panels.ts` | Which chrome and blocks a tile's panel shows |
| `packages/core/src/bearing-panels.test.ts` | Its tests |
| `apps/web/components/finance/bearing/Panel.tsx` | The web panel shell — chrome, blocks, footer link |
| `apps/web/components/finance/bearing/panel-blocks.tsx` | Maps a `PanelBlock` to a web component |
| `apps/web/lib/actions/bearing-panel.ts` | Server function returning one family's detail |
| `apps/web/lib/bearing/panel-detail.ts` | Gathering that detail, per family |
| `apps/mobile/src/components/bearing/Panel.tsx` | The phone panel shell |
| `apps/mobile/src/components/bearing/panel-blocks.tsx` | Maps a `PanelBlock` to a phone component |
| `apps/mobile/src/lib/bearing-panel.ts` | Fetching panel detail on the phone |

**Modified:**

| File | Change |
| --- | --- |
| `packages/core/src/bearing-read.ts` | `RenderedTile` gains `family` |
| `packages/core/src/bearing-read.test.ts` | Covers the new field |
| `packages/core/src/i18n/messages/en.ts`, `fr.ts` | Panel strings |
| `apps/web/components/finance/bearing/BearingGrid.tsx` | Open state, panel row insertion |
| `apps/web/components/finance/bearing/Tile.tsx` | Press expands instead of navigating |
| `apps/web/components/motion/Stagger.tsx` | Reads constants from core |
| `apps/mobile/src/app/(tabs)/index.tsx` | Open state, passes it down |
| `apps/mobile/src/components/bearing/BearingTile.tsx` | Press expands; renders the panel |
| `apps/mobile/src/components/motion/FadeIn.tsx`, `Stagger.tsx` | Read constants from core |

---

## Task 1: The shared motion vocabulary

The two clients currently keep their motion in step by comment — mobile's `Stagger.tsx` says "Matches the web Stagger's 40ms cadence" and `AnimatedAmount` is duplicated at 650ms on both. This task makes that a shared fact.

**Files:**
- Create: `packages/core/src/motion.ts`
- Test: `packages/core/src/motion.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `EASE_STANDARD: readonly [number, number, number, number]`, `DURATION: { enter: 500; count: 650; panel: 420 }`, `STAGGER_STEP_MS: 40`, `STAGGER_MAX_STEPS: 8`, `staggerDelay(index: number): number`, `cssEasing(points?): string`, `easeOutCubic(t: number): number`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  cssEasing,
  DURATION,
  EASE_STANDARD,
  easeOutCubic,
  staggerDelay,
  STAGGER_MAX_STEPS,
  STAGGER_STEP_MS,
} from "./motion";

describe("staggerDelay", () => {
  it("steps by the cadence both clients already use", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(STAGGER_STEP_MS);
    expect(staggerDelay(3)).toBe(3 * STAGGER_STEP_MS);
  });

  it("caps, so a long list does not leave later rows visibly late", () => {
    const capped = STAGGER_MAX_STEPS * STAGGER_STEP_MS;
    expect(staggerDelay(STAGGER_MAX_STEPS)).toBe(capped);
    expect(staggerDelay(STAGGER_MAX_STEPS + 40)).toBe(capped);
  });
});

describe("cssEasing", () => {
  it("writes the shared curve as a CSS value", () => {
    expect(cssEasing()).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
  });
});

describe("easeOutCubic", () => {
  it("lands exactly on both ends", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("is ahead of linear in the first half, which is what ease-out means", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("the vocabulary itself", () => {
  it("keeps the curve the phone already animates on", () => {
    expect(EASE_STANDARD).toEqual([0.32, 0.72, 0, 1]);
  });

  it("keeps the count-up duration AnimatedAmount fixed on both clients", () => {
    expect(DURATION.count).toBe(650);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @finance/core test motion`
Expected: FAIL — `Failed to resolve import "./motion"`.

- [ ] **Step 3: Write the module**

Create `packages/core/src/motion.ts`:

```ts
/**
 * How things move, in both apps.
 *
 * These numbers already existed twice. `FadeIn.tsx` on the phone held the
 * curve, `Stagger.tsx` on each client held the same 40ms cadence with a
 * comment saying so, and `AnimatedAmount` was written twice at 650ms because
 * — as its own doc puts it — "the two clients show the same figure and a
 * spring settles on a different curve, so the same amount would arrive
 * differently depending on which screen you were holding".
 *
 * A comment is not a mechanism. This is, and it is the same move the rest of
 * `packages/core` makes: the shared truth lives once, and each client adapts
 * it to its own animation engine. CSS wants a string, Reanimated wants the
 * four control points, and both come from here.
 *
 * Pure, dependency-free, and deliberately free of any component: this module
 * describes motion, it does not perform it.
 */

/**
 * The app's one easing curve, as cubic-bezier control points.
 *
 * One curve rather than a set, because a screen where different blocks
 * decelerate differently reads as several screens.
 */
export const EASE_STANDARD = [0.32, 0.72, 0, 1] as const;

export const DURATION = {
  /** A block arriving on screen. */
  enter: 500,
  /** A figure counting to a new value. */
  count: 650,
  /** A panel opening or closing. */
  panel: 420,
} as const;

/** The gap between consecutive items in a staggered enter. */
export const STAGGER_STEP_MS = 40;

/**
 * Beyond this many steps the delay stops growing.
 *
 * A twelve-tile grid staggered without a cap leaves the last tile arriving
 * half a second after the first, which reads as the screen being slow rather
 * than as a flourish.
 */
export const STAGGER_MAX_STEPS = 8;

/** How long the item at `index` waits before entering. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP_MS;
}

/** The curve as a CSS `cubic-bezier()` value. */
export function cssEasing(
  points: readonly number[] = EASE_STANDARD,
): string {
  return `cubic-bezier(${points.join(", ")})`;
}

/**
 * Ease-out cubic — fast start, settles gently on the final figure.
 *
 * Kept separate from `EASE_STANDARD` because counting a number up is not the
 * same gesture as a block arriving, and both clients already agreed on this
 * one independently.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm --filter @finance/core test motion`
Expected: PASS, 6 tests.

- [ ] **Step 5: Point the existing motion components at it**

In `apps/mobile/src/components/motion/FadeIn.tsx`, replace the local constant:

```tsx
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

const NOCTURNE_EASING = Easing.bezier(...EASE_STANDARD);
```

and use `DURATION.enter` in place of the literal `500`.

In `apps/mobile/src/components/motion/Stagger.tsx`, delete `STAGGER_MS` and `MAX_STEPS` and use `staggerDelay`:

```tsx
import { staggerDelay } from "@finance/core/motion";

export function StaggerItem({ index, children, className }: StaggerItemProps) {
  return (
    <FadeIn delayMs={staggerDelay(index)} className={className}>
      {children}
    </FadeIn>
  );
}
```

Make the same substitution in `apps/web/components/motion/Stagger.tsx`, and replace `DURATION_MS = 650` in both `AnimatedAmount.tsx` files with `DURATION.count`, and their local `easeOut` with the imported `easeOutCubic`.

- [ ] **Step 6: Verify nothing moved differently**

Run: `pnpm test`
Expected: PASS, whole core suite green.
Run: `pnpm --filter web lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/motion.ts packages/core/src/motion.test.ts \
  apps/mobile/src/components/motion apps/web/components/motion \
  apps/web/components/finance/AnimatedAmount.tsx \
  apps/mobile/src/components/AnimatedAmount.tsx
git commit -m "Keep the two apps moving alike by saying how, once"
```

---

## Task 2: Carry the family onto a rendered tile

`panelFor` needs a tile's family, and `RenderedTile` does not have it — the family lives on the datum in the pack. This is a two-line change that Task 3 depends on entirely.

**Files:**
- Modify: `packages/core/src/bearing-read.ts:319-390`
- Test: `packages/core/src/bearing-read.test.ts`

**Interfaces:**
- Consumes: `BearingFact.family` from `bearing-facts.ts`.
- Produces: `RenderedTile.family: FactFamily`.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/bearing-read.test.ts`:

```ts
it("carries each datum's family onto the tile it renders", () => {
  const facts = pack(["free", "streak"]);
  const tiles = renderArrangement(
    ["free", "streak"],
    null,
    facts,
    (n) => `${n}`,
  );

  expect(tiles.map((tile) => tile.family)).toEqual(["month", "run"]);
});
```

If the existing test file has no `pack` helper, copy the one from `bearing-tiles.test.ts:31` verbatim into this file.

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @finance/core test bearing-read`
Expected: FAIL — `family` is `undefined`, and TypeScript reports it is not a property of `RenderedTile`.

- [ ] **Step 3: Add the field**

In `packages/core/src/bearing-read.ts`, add to the `RenderedTile` interface, after `id`:

```ts
  /**
   * Which horizon this figure belongs to.
   *
   * Copied from the datum rather than looked up from the id, for the reason
   * `bearing-facts.ts` gives for carrying it there: two apps deriving the
   * same grouping from a naming convention is two places for that convention
   * to rot. The panel system groups by this.
   */
  family: FactFamily;
```

Import the type at the top:

```ts
import type { BearingFacts, FactFamily } from "./bearing-facts";
```

and set it in the `rendered.push({...})` call, beside `id`:

```ts
      family: fact.family,
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm --filter @finance/core test bearing-read`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/bearing-read.ts packages/core/src/bearing-read.test.ts
git commit -m "Let a rendered tile say which horizon it belongs to"
```

---

## Task 3: What a tile's panel shows

The rule the spec calls load-bearing: blocks are chosen **per tile, not per family**, because a panel that dumped its whole family would mean Month had been hidden in an accordion rather than dissolved.

**Files:**
- Create: `packages/core/src/bearing-panels.ts`
- Test: `packages/core/src/bearing-panels.test.ts`

**Interfaces:**
- Consumes: `FactFamily` from `bearing-facts.ts`; `TileId`, `BEARING_TILES` from `bearing-tiles.ts`.
- Produces: `PanelBlock`, `PanelChrome`, `PanelSpec`, `panelFor(id: TileId, family: FactFamily): PanelSpec`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/bearing-panels.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { BEARING_TILE_IDS, type TileId } from "./bearing-tiles";
import type { FactFamily } from "./bearing-facts";
import { panelFor } from "./bearing-panels";

const FAMILY_OF: Record<string, FactFamily> = {
  free: "month",
  "savings-rate": "month",
  "inbox-pending": "now",
  "on-hand": "now",
  streak: "run",
  "projected-kept": "ahead",
  "wallet-return": "wallet",
};

describe("panelFor", () => {
  it("gives a month tile the scope chrome, because it is the only family that needs it", () => {
    expect(panelFor("free", "month").chrome).toBe("month-scope");
    expect(panelFor("on-hand", "now").chrome).toBe("none");
    expect(panelFor("wallet-return", "wallet").chrome).toBe("none");
  });

  it("explains one figure, not a whole family", () => {
    const free = panelFor("free", "month").blocks;
    const rate = panelFor("savings-rate", "month").blocks;

    expect(free).toEqual(["spend-strip", "still-to-come"]);
    expect(rate).toEqual(["month-comparison", "spend-strip"]);
    expect(free).not.toEqual(rate);
  });

  it("falls back to the family's own blocks for a tile with no mapping", () => {
    expect(panelFor("wallet-drag", "wallet").blocks).toEqual([
      "wallets",
      "weight-bars",
    ]);
  });

  it("opens the review inbox in place, because that decision is actionable here", () => {
    expect(panelFor("inbox-pending", "now").blocks).toEqual(["review-inbox"]);
  });

  it("keeps the tile's own href for the footer link", () => {
    expect(panelFor("inbox-pending", "now").href).toBe(
      "/transactions?review=inbox",
    );
    expect(panelFor("net-position", "now").href).toBeNull();
  });

  it("answers for every tile the Bearing can show", () => {
    for (const id of BEARING_TILE_IDS) {
      const spec = panelFor(id as TileId, FAMILY_OF[id] ?? "now");
      expect(spec.blocks.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @finance/core test bearing-panels`
Expected: FAIL — `Failed to resolve import "./bearing-panels"`.

- [ ] **Step 3: Write the module**

Create `packages/core/src/bearing-panels.ts`:

```ts
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
  | "spend-strip"
  | "still-to-come"
  | "month-read"
  | "month-comparison"
  | "budget-progress"
  | "close-shelf"
  | "month-score"
  | "trend"
  | "projection"
  | "ingredients"
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
  ahead: ["projection", "ingredients"],
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
  free: ["spend-strip", "still-to-come"],
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
  "projected-balance": ["projection", "ingredients"],
  "projected-kept": ["projection", "ingredients"],
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm --filter @finance/core test bearing-panels`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/bearing-panels.ts packages/core/src/bearing-panels.test.ts
git commit -m "Say what opens under a tile, one figure at a time"
```

---

## Task 4: The web accordion, with nothing in it yet

The spec names this the harder half: a full-width panel has to enter a four-column grid without leaving the holes `HEAD` and `REPEAT` were chosen to avoid. Prove the mechanism before building any panel content.

**Files:**
- Modify: `apps/web/components/finance/bearing/BearingGrid.tsx`
- Modify: `apps/web/components/finance/bearing/Tile.tsx`

**Interfaces:**
- Consumes: `panelFor` (Task 3), `RenderedTile.family` (Task 2), `cssEasing`/`DURATION` (Task 1).
- Produces: `BearingGrid` holding `openTile: TileId | null`; a `<div data-panel-row>` rendered at `grid-column: 1 / -1` after the open tile's row.

- [ ] **Step 1: Read the guide first**

Read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`. `BearingGrid` is already `"use client"`; confirm what that permits before changing it.

- [ ] **Step 2: Hold the open tile**

In `BearingGrid.tsx`, beside the existing `useState` calls:

```tsx
const [openTile, setOpenTile] = useState<TileId | null>(null);

// One at a time. A second open panel doubles the height of an already tall
// screen and means two detail fetches in flight for a figure the reader is
// no longer looking at.
const toggleTile = useCallback((id: TileId) => {
  setOpenTile((current) => (current === id ? null : id));
}, []);
```

- [ ] **Step 3: Close on drag, so the two gestures never compete**

In the existing `handleDragStart`, add as its first statement:

```tsx
setOpenTile(null);
```

- [ ] **Step 4: Insert the panel row**

Where the grid maps `order` to `<SortableTile>`, wrap each in a fragment and emit the panel immediately after the open tile's row ends. Compute the row boundary from the spans, since a row is full at four columns:

```tsx
const SPAN_COLUMNS = { hero: 2, wide: 2, unit: 1 } as const;

/** The index after which a full-width panel may be inserted without a hole. */
function rowEndIndex(tiles: RenderedTile[], openIndex: number): number {
  let columns = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    columns += SPAN_COLUMNS[tiles[i]!.span];
    if (columns % 4 === 0 && i >= openIndex) {
      return i;
    }
  }
  return tiles.length - 1;
}
```

and in the render:

```tsx
const openIndex = openTile
  ? tiles.findIndex((tile) => tile.id === openTile)
  : -1;
const panelRow = openIndex >= 0 ? rowEndIndex(tiles, openIndex) : -1;
```

```tsx
{tiles.map((tile, index) => (
  <Fragment key={tile.id}>
    <SortableTile tile={tile} onOpen={() => toggleTile(tile.id)} ... />
    {index === panelRow ? (
      <div
        data-panel-row
        className="col-span-full overflow-hidden"
        style={{
          transition: reducedMotion
            ? undefined
            : `grid-template-rows ${DURATION.panel}ms ${cssEasing()}`,
        }}
      >
        <Panel tile={tiles.find((t) => t.id === openTile)!} />
      </div>
    ) : null}
  </Fragment>
))}
```

For now `Panel` is a stub returning `<div className="h-24 rounded-3xl border" />`; Task 5 fills it.

- [ ] **Step 5: Make a press expand rather than navigate**

In `Tile.tsx`, replace the stretched `<Link>` overlay with a `<button>` carrying the same stretched positioning, calling a new `onOpen` prop. Keep `tile.href` unused here — it moves to the panel footer in Task 5. Set `aria-expanded={open}` on the button so the state is announced.

- [ ] **Step 6: Verify in the browser**

Run: `pnpm dev:web`, open `/bearing`, press several tiles.
Expected: the panel row opens under the row containing the pressed tile, spans the full width, leaves no gap in the bento at any tile count, and closes when another tile is pressed or a drag begins. Check at 4 columns and at the phone breakpoint (2 columns) — `rowEndIndex` must be given the column count, so parameterise it if the two differ.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/finance/bearing/
git commit -m "Open a row under the tile, without punching a hole in the bento"
```

---

## Task 5: The web panel — chrome, blocks, footer

**Files:**
- Create: `apps/web/components/finance/bearing/Panel.tsx`
- Create: `apps/web/components/finance/bearing/panel-blocks.tsx`
- Create: `apps/web/lib/bearing/panel-detail.ts`
- Create: `apps/web/lib/actions/bearing-panel.ts`

**Interfaces:**
- Consumes: `panelFor`, `PanelBlock`, `PanelChrome` (Task 3); the stub slot from Task 4.
- Produces: `<Panel tile={RenderedTile} />`; `bearingPanelAction(family: FactFamily, scope: { year: number; month: number }): Promise<PanelDetail>`.

- [ ] **Step 1: Read the guide first**

Read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` for how this version wants a Server Function called from a Client Component, and compare it against the existing `apps/web/lib/actions/bearing.ts`, which is the idiom this codebase already uses.

- [ ] **Step 2: Write the server function**

Create `apps/web/lib/actions/bearing-panel.ts`, following `bearing.ts` exactly — `"use server"`, `getAuthUser()` first, a narrow return type, no `revalidatePath` (opening a panel changes nothing):

```ts
"use server";

import type { FactFamily } from "@finance/core/bearing-facts";
import { getAuthUser } from "@/lib/auth/get-user";
import { gatherPanelDetail, type PanelDetail } from "@/lib/bearing/panel-detail";

/**
 * The detail under a tile's figure.
 *
 * Asked for on expand rather than gathered with the page, because a home
 * screen that waited on five families' worth of detail — most of which
 * nobody will open — would be slower for everybody to serve the few who do.
 * The headline is already on screen and already correct; this is only what
 * sits beneath it.
 */
export async function bearingPanelAction(
  family: FactFamily,
  scope: { year: number; month: number },
): Promise<PanelDetail | null> {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }
  return gatherPanelDetail(user.id, family, scope);
}
```

- [ ] **Step 3: Gather the detail, per family**

**The union goes in core, not in the web lib.** Both clients render it — the phone receives it as JSON from the route in Task 6 — so it is shared truth and belongs beside `panelFor`. Add to `packages/core/src/bearing-panels.ts`:

```ts
import type { MonthlySummary } from "./types/database";
import type { MonthComparison } from "./month-comparison";
import type { StillToCome } from "./still-to-come";
import type { CloseHistoryRow, CloseHistorySummary } from "./month-close";
import type { InvestmentPortfolioSummary } from "./investment-positions";

/**
 * What sits under a figure, once somebody asks to see it.
 *
 * Keyed on family so a renderer cannot read a field its branch never
 * fetched — the alternative, one optional field per block, makes every
 * consumer prove at runtime what the type already knows.
 */
export type PanelDetail =
  | { family: "now"; movements: BankMovement[]; inbox: FeedItem[] }
  | { family: "month"; summary: MonthlySummary; comparison: MonthComparison | null; upcoming: StillToCome }
  | { family: "run"; closes: { history: CloseHistoryRow[]; summary: CloseHistorySummary }; trend: number[] }
  | { family: "ahead"; trend: number[] }
  | { family: "wallet"; portfolio: InvestmentPortfolioSummary };
```

Import `BankMovement` and `FeedItem` from wherever `bank-feed.ts` already declares them; if they are only declared in `apps/web/lib/queries/bank.ts`, move those two interfaces to `packages/core/src/bank-feed.ts` first — a type both clients render cannot live in one client.

Then create `apps/web/lib/bearing/panel-detail.ts`, which only gathers:

```ts
import type { PanelDetail } from "@finance/core/bearing-panels";
import type { FactFamily } from "@finance/core/bearing-facts";
import { buildStillToCome } from "@finance/core/still-to-come";
import { getMonthlySummary, getMonthlyTrend } from "@/lib/queries/finance";
import { getMonthComparison } from "@/lib/queries/finance";
import { getMonthCloseOverview } from "@/lib/queries/month-close";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getRecentBankMovements, getPendingFeedItems } from "@/lib/queries/bank";

/**
 * What sits under a figure, fetched only when somebody asks to see it.
 *
 * One branch per family rather than one per tile: two tiles in the same
 * family want the same underlying rows even when `bearing-panels.ts` shows
 * them different blocks, so fetching per tile would ask the database the same
 * question twice for `free` and `savings-rate`.
 */
export async function gatherPanelDetail(
  userId: string,
  family: FactFamily,
  scope: { year: number; month: number },
): Promise<PanelDetail> {
  switch (family) {
    case "now": {
      const [movements, inbox] = await Promise.all([
        getRecentBankMovements(userId),
        getPendingFeedItems(userId),
      ]);
      return { family, movements, inbox };
    }
    case "month": {
      const [summary, comparison] = await Promise.all([
        getMonthlySummary(userId, scope.year, scope.month),
        getMonthComparison(userId, scope.year, scope.month),
      ]);
      return { family, summary, comparison, upcoming: buildStillToCome(summary) };
    }
    case "run": {
      const [closes, trend] = await Promise.all([
        getMonthCloseOverview(userId),
        getMonthlyTrend(userId),
      ]);
      return { family, closes, trend };
    }
    case "ahead":
      return { family, trend: await getMonthlyTrend(userId) };
    case "wallet":
      return { family, portfolio: await getWalletPortfolio(userId) };
  }
}
```

Check each query's real signature before wiring it — several take a locale or a date and the exact arguments are not guessable from the name.

- [ ] **Step 4: Map blocks to components**

Create `panel-blocks.tsx`. Every block already exists under `components/finance/`; this task adds no new visual component:

```tsx
import type { PanelBlock } from "@finance/core/bearing-panels";
import type { PanelDetail } from "@/lib/bearing/panel-detail";
import { SpendStrip } from "@/components/finance/charts";
import { StillToCome } from "@/components/finance/StillToCome";
import { BankInbox } from "@/components/finance/BankInbox";
import { MoneyOnHand } from "@/components/finance/MoneyOnHand";
import { CashAccountsCard } from "@/components/finance/CashAccountsCard";
import { RecentOnAccount } from "@/components/finance/RecentOnAccount";
import { MonthCloseHistory } from "@/components/finance/MonthCloseHistory";
import { MonthScore } from "@/components/finance/MonthScore";
import { ProjectionCard } from "@/components/finance/ProjectionCard";
import { MonthWallets } from "@/components/finance/MonthWallets";
import { WeightBars } from "@/components/finance/WeightBars";
import { FundCostCard } from "@/components/finance/FundCostCard";

/**
 * One block, drawn from the detail its family fetched.
 *
 * Returns null rather than an empty shell when the detail does not carry what
 * a block needs — a panel showing a headed box with nothing in it is worse
 * than a panel one block shorter.
 */
export function PanelBlockView({
  block,
  detail,
}: {
  block: PanelBlock;
  detail: PanelDetail;
}) {
  switch (block) {
    case "spend-strip":
      return detail.family === "month" ? (
        <SpendStrip
          rows={detail.summary.expenseBreakdown}
          total={detail.summary.expenses}
        />
      ) : null;
    case "still-to-come":
      return detail.family === "month" ? (
        <StillToCome {...detail.upcoming} />
      ) : null;
    case "review-inbox":
      return detail.family === "now" ? <BankInbox items={detail.inbox} /> : null;
    case "recent-on-account":
      return detail.family === "now" ? (
        <RecentOnAccount movements={detail.movements} />
      ) : null;
    case "close-shelf":
      return detail.family === "run" ? (
        <MonthCloseHistory rows={detail.closes.history} />
      ) : null;
    case "wallets":
      return detail.family === "wallet" ? (
        <MonthWallets portfolio={detail.portfolio} />
      ) : null;
    // …one arm per PanelBlock. The switch is exhaustive: give it a
    // `default: { const never: never = block; return never; }` so adding a
    // block to the union is a type error here rather than a blank panel.
    default:
      return null;
  }
}
```

Fill in every remaining arm — `money-on-hand`, `cash-accounts`, `month-read`, `month-comparison`, `budget-progress`, `month-score`, `trend`, `projection`, `ingredients`, `weight-bars`, `fund-cost` — against each component's real props before moving on.

- [ ] **Step 5: Write the panel shell**

Create `Panel.tsx`: chrome at the top per `spec.chrome` (`month-scope` renders `MonthPicker` + `BudgetViewToggle`, `streak` renders the streak line, `horizon` renders the range control, `none` renders nothing), the blocks beneath it, and a footer `<Link>` to `spec.href` when it is not null. While detail is loading, render the blocks' skeletons — never a spinner over the headline, which is already correct.

- [ ] **Step 6: Verify**

Run: `pnpm dev:web`, open `/bearing`, expand `free`, `streak`, `on-hand`, `inbox-pending`.
Expected: `free` shows the spend strip and still-to-come under a month picker; `streak` shows the close shelf under a streak header with no picker; `inbox-pending` shows the review list; each footer links where the tile used to navigate.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/finance/bearing/ apps/web/lib/bearing/panel-detail.ts apps/web/lib/actions/bearing-panel.ts
git commit -m "Fill the row under a tile with what explains its figure"
```

---

## Task 6: The phone accordion

Easier than the web's, for the reason `BearingTile.tsx` records: the phone is deliberately a single column, so an open row simply grows.

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/index.tsx:243-258`
- Modify: `apps/mobile/src/components/bearing/BearingTile.tsx`
- Create: `apps/mobile/src/components/bearing/Panel.tsx`
- Create: `apps/mobile/src/components/bearing/panel-blocks.tsx`
- Create: `apps/mobile/src/lib/bearing-panel.ts`

**Interfaces:**
- Consumes: `panelFor`, `RenderedTile.family`, `DURATION`, `EASE_STANDARD`.
- Produces: `BearingTile` gaining `open: boolean` and `onToggle: () => void`.

- [ ] **Step 1: Hold the open tile on the screen**

In `index.tsx`, beside `dragged` and `arranging`:

```tsx
const [openTile, setOpenTile] = useState<TileId | null>(null);
```

Pass `open={item.id === openTile}` and `onToggle={() => setOpenTile((c) => (c === item.id ? null : item.id))}` into `BearingTile` in `renderItem`. In the existing `onDragStart`, add `setOpenTile(null)` as its first statement.

- [ ] **Step 2: Grow the row**

In `BearingTile.tsx`, wrap the card body so the panel is a sibling inside the same `Card`, and animate its height with Reanimated's layout transition rather than a measured height:

```tsx
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

const reduce = useReducedMotion();

<Animated.View
  layout={reduce ? undefined : LinearTransition.duration(DURATION.panel).easing(Easing.bezier(...EASE_STANDARD))}
>
  {/* existing figure */}
  {open ? <Panel tile={tile} /> : null}
</Animated.View>
```

`ReorderableList` already supports variable item heights, so nothing about the list needs changing.

- [ ] **Step 3: Replace the press**

`BearingTile` currently calls `router.push(tile.href)`. Replace that with `onToggle()`, and set `accessibilityState={{ expanded: open }}` on the `Pressable`.

- [ ] **Step 4: Fetch the detail**

Create `apps/mobile/src/lib/bearing-panel.ts`. Follow `apps/mobile/src/lib/bearing.ts` for the bearer header and base-URL handling — read it first, because the phone reaches the web app's routes rather than Supabase directly for this kind of read:

```ts
import type { FactFamily } from "@finance/core/bearing-facts";
import type { PanelDetail } from "@finance/core/bearing-panels";

const cache = new Map<string, PanelDetail>();

function keyOf(family: FactFamily, year: number, month: number): string {
  return `${family}:${year}-${month}`;
}

/**
 * The detail under a figure, fetched once per family per month.
 *
 * Cached for the session because an accordion invites reopening: a reader
 * expands `free`, collapses it to check `streak`, and comes back. Asking the
 * server again for rows that cannot have changed in those four seconds would
 * make the second open slower than the first, which reads as the app
 * getting worse the more you use it.
 */
export async function getPanelDetail(
  family: FactFamily,
  year: number,
  month: number,
): Promise<PanelDetail | null> {
  const key = keyOf(family, year, month);
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  const detail = await bearingFetch<PanelDetail>(
    `/api/bearing/panel?family=${family}&y=${year}&m=${month}`,
  );
  if (detail) {
    cache.set(key, detail);
  }
  return detail;
}

/** Called by `notifyDataChanged` consumers, so a write is not read stale. */
export function clearPanelCache(): void {
  cache.clear();
}
```

Add the matching `GET` route at `apps/web/app/api/bearing/panel/route.ts`, following `apps/web/app/api/bearing/route.ts` for its auth. Wire `clearPanelCache()` into the existing `useDataVersion` effect in `index.tsx` so a recorded transaction does not leave a stale panel behind.

- [ ] **Step 5: Verify on a device**

Run: `pnpm dev:mobile`.
Expected: pressing a tile grows its card smoothly with the detail inside it; pressing another collapses the first; starting a drag closes any open panel; with Reduce Motion enabled in iOS Settings the panel appears without animating.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/bearing/ apps/mobile/src/lib/bearing-panel.ts apps/mobile/src/app/\(tabs\)/index.tsx
git commit -m "Grow the row on the phone, where the column was always single"
```

---

## Task 7: Say it in both languages

**Files:**
- Modify: `packages/core/src/i18n/messages/en.ts` (the `bearing` group, from line 1626)
- Modify: `packages/core/src/i18n/messages/fr.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `bearing.panel.*` keys used by both clients' `Panel.tsx`.

- [ ] **Step 1: Add the English keys**

Inside the existing `bearing:` group in `en.ts`:

```ts
    panel: {
      close: "Close",
      open: "Show what this is made of",
      loading: "Reading…",
      footer: "See the full surface",
      streakHeading: "Your run",
      horizon: "How far ahead",
    },
```

- [ ] **Step 2: Add the French, and let the type checker find any you missed**

The matching block in `fr.ts`:

```ts
    panel: {
      close: "Fermer",
      open: "Voir ce qui compose ce chiffre",
      loading: "Lecture…",
      footer: "Voir la surface complète",
      streakHeading: "Votre série",
      horizon: "Jusqu'où",
    },
```

- [ ] **Step 3: Sweep the surfaces this plan touched for literals**

Run: `grep -rnE '"(Ledger|Plan|reached|Needs you)"' apps/web/components/finance/bearing apps/mobile/src/components/bearing`
Expected: no matches. Any literal found goes through the catalogue instead.

- [ ] **Step 4: Verify**

Run: `pnpm test && pnpm --filter web lint`
Expected: PASS. A missing French key is a type error, not a runtime surprise.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/i18n/messages/
git commit -m "Say the panel in both languages"
```

---

## Task 8: Prove the whole thing still holds

- [ ] **Step 1: Run the full suite**

Run: `pnpm test`
Expected: PASS, including the three new test files.

- [ ] **Step 2: Lint both clients**

Run: `pnpm --filter web lint && pnpm --filter mobile lint`
Expected: no new errors.

- [ ] **Step 3: Confirm no motion literals leaked into the apps**

Run: `grep -rnE '\b(400|420|500|650)\b.*(duration|Duration|ms\b)' apps/web/components apps/mobile/src/components`
Expected: no matches outside imports from `@finance/core/motion`.

- [ ] **Step 4: Walk both clients**

Open `/bearing` on web and the first tab on the phone. Expand a tile from each of the five families. Confirm: one panel open at a time, headline never shows a spinner, footer link goes where the tile used to, drag still reorders, and Month is unchanged and still reachable.

- [ ] **Step 5: Commit any fixes and stop**

Plan 2 retires Month. Do not start it here.

---

## Self-Review Notes

Checked against the spec:

- Panel system, five chromes, per-tile blocks — Task 3
- `family` on the datum being the grouping key — Task 2
- Press expands rather than navigates; `href` demoted to footer — Tasks 4, 5, 6
- One panel at a time — Tasks 4, 6
- Panels open instantly, detail streams — Task 5 step 5, Task 6 step 4
- Shared motion tokens, reduced motion — Tasks 1, 4, 6
- i18n through the catalogues — Task 7

Deferred by design, and covered in later plans: the spine and the ignition ladder (Plan 2), retiring Month and its fourteen references (Plan 2), removing `three`/`ogl` (Plan 2, alongside the first real use of `motion`), the close moment (Plan 3), the year in review (Plan 4).
