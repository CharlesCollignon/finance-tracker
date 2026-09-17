# The Spine, and Retiring Month — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a fixed spine at the top of the Bearing on both clients — headline figure, ring, flame and action row, with all four ignition states — and then delete the Month screen and its fourteen references, so the app has one home.

**Architecture:** Two new pure modules in `packages/core` carry every judgement: `spine.ts` resolves which ignition state applies as a discriminated union, and `attention.ts` unifies the attention list that the two clients currently build separately and differently. The clients render those unions and nothing more. Month is retired only after the spine ships, because the spine is what replaces the part of Month that never became a panel.

**Tech Stack:** TypeScript, vitest, Next.js 16 (App Router, React 19), Expo / React Native 0.86 with Reanimated 4, NativeWind, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-15-bearing-month-merge-design.md`

**Predecessor:** `docs/superpowers/plans/2026-09-15-bearing-panels.md` (merged at `aa5a162`). This is step 4 and step 5 of the spec's seven-step build order; steps 1-3 are done. Its decisions are recorded in `docs/superpowers/plans/2026-09-15-bearing-panels-decisions.md` — read that before changing anything it explains.

## Global Constraints

- Every user-facing string goes through `packages/core/src/i18n/messages/en.ts` and `fr.ts`. `en.ts` is the schema — `fr.ts` is typed `typeof en`, so a missing French key is a type error. Never ship a literal. This includes pre-existing hardcoded English on any surface you touch.
- **Each task adds its own i18n keys, in the same task that consumes them.** Plan 1 put all the keys in one late task and had to be reordered mid-flight because its consumers type-errored without them. Do not repeat that.
- New judgement goes in `packages/core` as a pure function with a `.test.ts` beside it. The clients only render. No new logic in `apps/`.
- Motion constants come from `@finance/core/motion` only. No duration, easing or delay literal may appear in `apps/`.
- Reduced motion is honoured: `usePrefersReducedMotion()` on web, `useReducedMotion()` from `react-native-reanimated` on mobile.
- Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/` — per `AGENTS.md`, this version differs from training data. Heed deprecation notices.
- Tests run with `pnpm test` (vitest in `@finance/core`).
- **Verification baseline**, established at `aa5a162`. Any deviation is a regression except where you fixed something: `pnpm test` → 1 failed (`still-to-come.test.ts`, pre-existing) / 1207 passed; `@finance/core` tsc → one pre-existing error in `push-routes.test.ts(89,15)`; web tsc → empty; mobile tsc → empty; `pnpm --filter web lint` → 9 errors / 2 warnings; `pnpm --filter mobile lint` → 42 problems (11 errors, 31 warnings).
- **The headline, ring and flame cost no new query.** Each client's gatherer already computes `pulse`, `summary` and `closes.summary` and passes them into `buildBearingFacts` (`apps/web/lib/bearing/facts.ts:210-216`, `apps/mobile/src/lib/bearing.ts:150-187`) — but `BearingFacts`, the pack's *output*, returns only `{asOf, facts, missing, thin}`, so they are computed and then discarded. Widen each gatherer's return to carry them. Do not re-derive them on the page, and do not add a query for them.
- **The action row is the exception, and it is allowed one.** Its inputs (swallowed entries, recurring to apply, proposals) are gathered today by the Month screen, not by the Bearing pack. Moving them is not adding them: once Task 5 deletes Month, those queries run on one screen instead of the other. Scoping the action row down to what the pack happens to hold would silently drop conditions a reader sees today, which is worse than one honest fetch.

---

## File Structure

**Created**

- `packages/core/src/spine.ts` — the ignition ladder as a discriminated union. Pure.
- `packages/core/src/spine.test.ts`
- `packages/core/src/attention.ts` — what is waiting, as ordered keyed items. Pure.
- `packages/core/src/attention.test.ts`
- `apps/web/components/finance/bearing/Spine.tsx` — renders `SpineState`.
- `apps/mobile/src/components/bearing/Spine.tsx` — the same union, the phone's idiom.

**Modified**

- `apps/web/app/(app)/bearing/page.tsx` — mounts the spine above `BearingGrid`.
- `apps/mobile/src/app/(tabs)/index.tsx` — mounts the spine above the list.
- `packages/core/src/i18n/messages/en.ts`, `fr.ts` — spine and attention keys.
- The fourteen Month references (Task 5, enumerated there).

**Deleted**

- `apps/web/app/(app)/dashboard/page.tsx`, `loading.tsx`
- `apps/mobile/src/app/(tabs)/month.tsx`
- `apps/web/components/finance/MonthAttention.tsx` and `apps/mobile/src/components/MonthAttention.tsx` — absorbed into the spine's action row.

---

## Task 1: The ignition ladder, as a union

**Files:**
- Create: `packages/core/src/spine.ts`, `packages/core/src/spine.test.ts`

**Interfaces:**
- Consumes: `MonthPulse` and `MonthStanding` from `./month-pulse`; `MIN_CLOSES_FOR_CAP` from `./month-close`.
- Produces: `resolveSpine(input: SpineInput): SpineState`, plus the exported types `SpineInput`, `SpineState`, `SpineRing`.

The four states come from the spec's "ignition ladder" verbatim. Two edges are non-negotiable and each gets its own test: when `pulse.overRecorded` the ring is **absent** (not dark — absent), and with no cap the ring is **never green**, which the union enforces structurally by giving the unproportioned arc no tone field at all.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveSpine } from "./spine";
import type { MonthPulse } from "./month-pulse";

const pulse = (over: Partial<MonthPulse> = {}): MonthPulse =>
  ({
    free: 400,
    overRecorded: false,
    capRatio: 0.5,
    overCap: false,
    standing: "clear",
    ...over,
  }) as MonthPulse;

describe("resolveSpine", () => {
  it("falls back to remaining, and says so, when no balance is readable", () => {
    const state = resolveSpine({
      pulse: pulse({ free: null, standing: "unknown", capRatio: null }),
      closes: null,
      remaining: 250,
    });
    expect(state.step).toBe("no-balance");
    expect(state.headline).toEqual({ figure: "remaining", value: 250 });
    expect(state.ring).toEqual({ kind: "dark" });
  });

  it("leads with free but keeps the ring dark until something has closed", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null }),
      closes: null,
      remaining: 250,
    });
    expect(state.step).toBe("no-close");
    expect(state.headline).toEqual({ figure: "free", value: 400 });
    expect(state.ring).toEqual({ kind: "dark" });
  });

  it("draws an unproportioned arc at one close, because there is no cap yet", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null }),
      closes: { streak: 1, bestStreak: 1, sample: 1 },
      remaining: 250,
    });
    expect(state.step).toBe("measuring");
    expect(state.ring).toEqual({ kind: "arc" });
  });

  it("lights fully once a cap exists", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: 0.4, standing: "tight" }),
      closes: { streak: 3, bestStreak: 5, sample: 4 },
      remaining: 250,
    });
    expect(state.step).toBe("lit");
    expect(state.ring).toEqual({
      kind: "proportion",
      ratio: 0.4,
      tone: "tight",
      over: false,
    });
    expect(state.flame).toEqual({ streak: 3, best: 5 });
  });

  it("removes the ring entirely when the account holds more than the ledger allows", () => {
    const state = resolveSpine({
      pulse: pulse({ overRecorded: true }),
      closes: { streak: 3, bestStreak: 5, sample: 4 },
      remaining: 250,
    });
    expect(state.ring).toEqual({ kind: "absent" });
  });

  it("never gives the capless arc a tone, so it can never read as a verdict", () => {
    const state = resolveSpine({
      pulse: pulse({ capRatio: null, standing: "clear" }),
      closes: { streak: 1, bestStreak: 1, sample: 1 },
      remaining: 250,
    });
    expect(state.ring).not.toHaveProperty("tone");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @finance/core exec vitest run src/spine.test.ts`
Expected: FAIL — `Failed to resolve import "./spine"`.

- [ ] **Step 3: Write `spine.ts`**

Write the module with a doc comment explaining *why* the arc has no tone (a measurement with no target cannot be a verdict) and why `overRecorded` removes rather than darkens the ring (a records gap is a different finding from spending, and `month-pulse.ts` is emphatic that these are not the same). The union:

```ts
export type SpineRing =
  | { kind: "absent" }
  | { kind: "dark" }
  | { kind: "arc" }
  | { kind: "proportion"; ratio: number; tone: MonthStanding; over: boolean };

export interface SpineState {
  step: "no-balance" | "no-close" | "measuring" | "lit";
  headline: { figure: "free" | "remaining"; value: number };
  ring: SpineRing;
  flame: { streak: number; best: number } | null;
}
```

Resolution order matters and must be exactly this: no readable `free` → `no-balance`; else nothing closed → `no-close`; else `capRatio === null` → `measuring`; else `lit`. Then `overRecorded` overrides whatever ring the step chose with `{ kind: "absent" }`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @finance/core exec vitest run src/spine.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/spine.ts packages/core/src/spine.test.ts
git commit -m "Say which rung of the ladder a reader is standing on"
```

---

## Task 2: What is waiting, said once instead of twice

**Files:**
- Create: `packages/core/src/attention.ts`, `packages/core/src/attention.test.ts`
- Modify: `packages/core/src/i18n/messages/en.ts`, `packages/core/src/i18n/messages/fr.ts`

**Interfaces:**
- Produces: `buildAttention(input: AttentionInput): AttentionItem[]`, and the types `AttentionItem`, `AttentionId`, `AttentionInput`.

**Why this task exists.** The two clients build this list independently today — `apps/web/app/(app)/dashboard/page.tsx:136-190` pushes five kinds of item, `apps/mobile/src/app/(tabs)/month.tsx:474-520` pushes three. They disagree about what deserves attention, which is a bug nobody has noticed because the two screens are never seen side by side. The spine shows the first item and `+N` for the rest, so *which* item is first becomes load-bearing and the disagreement stops being survivable.

Items carry i18n **keys and params**, never rendered text — the clients call `t()`. This is what lets one module serve both.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildAttention } from "./attention";

const none = {
  swallowed: 0,
  pendingInbox: 0,
  recurringToApply: 0,
  readyToClose: null,
  proposals: 0,
};

describe("buildAttention", () => {
  it("says nothing when nothing is waiting", () => {
    expect(buildAttention(none)).toEqual([]);
  });

  it("puts what is wrong ahead of what is merely outstanding", () => {
    const items = buildAttention({
      ...none,
      swallowed: 2,
      pendingInbox: 3,
    });
    expect(items.map((item) => item.id)).toEqual(["swallowed", "inbox"]);
    expect(items[0]!.tone).toBe("wrong");
    expect(items[1]!.tone).toBe("waiting");
  });

  it("carries keys and params, never rendered text", () => {
    const [item] = buildAttention({ ...none, pendingInbox: 4 });
    expect(item).toMatchObject({
      id: "inbox",
      messageKey: "month.attentionInbox",
      params: { count: 4 },
      href: "/transactions?review=inbox",
    });
    expect(item).not.toHaveProperty("text");
  });

  it("orders the full set the same way every time", () => {
    const items = buildAttention({
      swallowed: 1,
      pendingInbox: 1,
      recurringToApply: 1,
      readyToClose: { monthLabel: "August" },
      proposals: 1,
    });
    expect(items.map((item) => item.id)).toEqual([
      "swallowed",
      "close",
      "inbox",
      "apply",
      "proposals",
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @finance/core exec vitest run src/attention.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `attention.ts` and its catalogue keys**

The ordering rule, which the doc comment must state and defend: tone `wrong` first, then closing the month, then the three errands in a fixed order. Closing ranks above the errands because it is the ritual the whole loop is built on, and below `wrong` because a records gap makes a close inaccurate.

Reuse the existing `month.attention*` keys already in `en.ts:839-856` — do not invent parallel ones. Add only what the phone was missing (`close` and `proposals` had no mobile equivalent). Add matching French.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @finance/core exec vitest run src/attention.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/attention.ts packages/core/src/attention.test.ts packages/core/src/i18n
git commit -m "Agree, once, on what is actually waiting"
```

---

## Task 3: The spine on the web

**Files:**
- Create: `apps/web/components/finance/bearing/Spine.tsx`
- Modify: `apps/web/app/(app)/bearing/page.tsx`, `packages/core/src/i18n/messages/en.ts`, `fr.ts`

**Interfaces:**
- Consumes: `resolveSpine`, `SpineState` (Task 1); `buildAttention`, `AttentionItem` (Task 2).

Fixed, always at the top, never reordered — it is not a tile and must not enter `BearingGrid`'s `order`. Render it between the `PageHeader` and the existing `<div>` that carries the as-of line, so it sits above the bento without disturbing the drag surface.

- [ ] **Step 1: Build the component against all four states**

One component, four ring renderings, driven by `state.ring.kind` — `absent` renders no ring element at all, `dark` an unlit track, `arc` a complete blue arc, `proportion` the ring at `ratio` toned by `tone`. Reduced motion via `usePrefersReducedMotion()`. All durations and easings from `@finance/core/motion`.

- [ ] **Step 2: Mount it in the page**

The figures come from the fact pack already gathered at `page.tsx:66-71`; add no query. If a figure the spine needs is not on the pack, that is a finding to report, not a query to add.

- [ ] **Step 3: Type-check and lint**

Run: `pnpm --filter web exec tsc --noEmit` (expect empty) and `pnpm --filter web lint` (expect the 9/2 baseline, with no new entry in a file you touched).

- [ ] **Step 4: Commit**

```bash
git add apps/web packages/core/src/i18n
git commit -m "Stand the spine at the top of the web home"
```

---

## Task 4: The spine on the phone

**Files:**
- Create: `apps/mobile/src/components/bearing/Spine.tsx`
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: the same `SpineState` and `AttentionItem` as Task 3. The union is the contract; the two components share no code and must agree on nothing else.

The spine sits **above** the `ReorderableList`, outside it — not as a list header that scrolls into the reorder surface. Opening a panel must not move it, and dragging a tile must not be able to displace it.

Footer and action-row links go through `phoneHref` from `@finance/core/bearing-tiles` (added by Plan 1 for exactly this reason — 15 of 26 web routes do not exist on the phone). An attention item's `href` is a **web** route; do not navigate to it raw.

- [ ] **Step 1: Build the component**
- [ ] **Step 2: Mount it above the list**
- [ ] **Step 3: Type-check and lint**

Run: `pnpm --filter mobile exec tsc --noEmit` (expect empty) and `pnpm --filter mobile lint` (expect the 42-problem baseline).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "Stand the same spine on the phone"
```

---

## Task 5: Retire Month

**Do not start this task until Tasks 3 and 4 are reviewed and complete.** Month is the fallback while the spine is unproven; deleting it first removes the thing a reader would fall back to.

**Files:**
- Delete: `apps/web/app/(app)/dashboard/page.tsx`, `apps/web/app/(app)/dashboard/loading.tsx`, `apps/mobile/src/app/(tabs)/month.tsx`, `apps/web/components/finance/MonthAttention.tsx`, `apps/mobile/src/components/MonthAttention.tsx`
- Modify, all verified present at `aa5a162`:
  - 8 × `revalidatePath("/dashboard")` across `apps/web/lib/revalidate-paths.ts` (2, lines 14 and 39), `lib/actions/phase4.ts`, `lib/actions/profile.ts`, `lib/actions/bank.ts`, `lib/actions/month-read.ts`, `lib/actions/month-close.ts`
  - `apps/web/lib/supabase/middleware.ts:19` (`MONTH_SCOPED`) and `:118`
  - `apps/web/lib/navigation.ts:59` — the Bearing's `children` entry
  - `packages/core/src/push-digest.ts:91` and `:107` — both write `url: "/dashboard"`
  - `packages/core/src/push-routes.ts:37` — the `RENAMED` map
  - `packages/core/src/bearing-tiles.ts` — the `on-hand`, `free` and `savings-rate` hrefs
  - `apps/mobile/src/components/ProjectionCard.tsx` — routes to `/(tabs)/month`

- [ ] **Step 1: Make `/dashboard` redirect to `/bearing`**

Bookmarks and already-delivered push notifications point there. The spec requires the redirect, so the route directory does not simply vanish. Read `node_modules/next/dist/docs/` for this version's redirect mechanism before writing it.

- [ ] **Step 2: Update the fourteen references, then prove none remain**

Run: `grep -rn '"/dashboard"\|/(tabs)/month' apps packages --include='*.ts' --include='*.tsx' | grep -v node_modules`
Expected: only the redirect itself.

- [ ] **Step 3: Fix `push-routes.ts`'s stale comment**

It claims "Month is `/dashboard` on the web and `/` on the phone". Mobile `/` is already the Bearing, so the comment is stale today and this change makes the mapping honest. Correct the comment in the same commit as the code — Plan 1's C1 was caused by a false comment nobody corrected.

- [ ] **Step 4: Delete the route files and the two `MonthAttention` components**
- [ ] **Step 5: Full gate run**

All six gates at baseline. `pnpm test` should still be 1 failed / 1207 passed unless you added tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Retire Month, now that everything it said is said at home"
```

---

## Task 6: The debts Plan 1 left, in the code this plan is already in

Plan 1's final review parked these deliberately, ruling that Plan 2 would be touching the same files. Each is small; they are one task because they share a review surface. Full context for each is in `docs/superpowers/plans/2026-09-15-bearing-panels-decisions.md`.

- [ ] **Step 1: The no-op chrome press**

`apps/web/components/ui/SegmentedControl.tsx:82` fires `onChange` even for the already-active segment, so pressing the current view blanks the panel to skeletons and re-resolves the same figures. Guard the setter on identity, both clients. This is the one residual a user actually meets.

- [ ] **Step 2: Locale, all three instances together**

Fixing one alone implies the surface is right when it is not: (a) the panel's reset guard keys on `scope` but not `locale`; (b) the mobile panel cache key at `apps/mobile/src/lib/bearing-panel.ts:710-717` omits `locale`, so detail fetched in one language is served in the other; (c) `apps/web/components/finance/bearing/Panel.tsx:127`'s fetch effect has no `locale` dep at all.

- [ ] **Step 3: The latent seam formulation**

`packages/core/src/bearing-grid.ts:168` tests the suffix with each tile's **end** row while the test oracle's `seamFor` uses its **start** row. Unreachable today because `slotSpan` puts the only multi-row span at index 0 — and reachable the moment a second multi-row span is added, as a C1-shaped bug the current test would not catch. Make the two agree and add the case that distinguishes them.

- [ ] **Step 4: Remove the dead dependencies**

`three`, `ogl` and `@types/three` have zero imports in `apps/web` — verified at `aa5a162`. Remove all three from `apps/web/package.json` and run `pnpm install`. **Keep `motion`**: it is also unimported today, but the spec's close sequence (Plan 3) is committed to using it, and the spec says keep it.

- [ ] **Step 5: Gates, then commit**

```bash
git add -A
git commit -m "Pay the small debts in the code this plan already had open"
```

---

## Task 7: Prove it, and write down what no command can check

- [ ] **Step 1: Run all six gates and record each against the baseline**
- [ ] **Step 2: Sweep for motion literals** in every file this plan touched — no duration, easing or delay literal in `apps/`.
- [ ] **Step 3: Confirm no new query** was added for the spine: `git diff` the two client page files and check for added data fetching.
- [ ] **Step 4: Write the human checklist**

To `docs/superpowers/plans/2026-09-17-spine-and-month-retirement-human-checks.md`, in the voice of its predecessor: background, what to do, what you should see, what it would mean otherwise. It must cover, at minimum: all four ignition states and how to reach each; the ring being **absent** rather than dark when over-recorded; the flame against a best streak; the action row's first item and its `+N`; `/dashboard` redirecting rather than 404ing; every phone attention link landing on a real screen; and both languages on the whole spine.

State plainly which claims you did not verify yourself. Plan 1's most serious defect was invisible to a green suite *and* to a checklist that asked the reader to look for the wrong thing.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "Ask the reader what the commands could not"
```

---

## Self-Review Notes

**Spec coverage.** Spec step 4 (the spine, all four ignition states) → Tasks 1, 3, 4. Step 5 (retiring Month, fourteen references) → Task 5. Dead dependency removal → Task 6 step 4. The `run` shelf is already served by the `run` family panel Plan 1 shipped. The close moment (step 6) and the year in review (step 7) are Plans 3 and 4 and are deliberately absent here.

**Resolved without work:** Plan 1's finding `I1` (web's `now` panel lacking a budget-view toggle mobile has) is **not a defect**. `packages/core/src/bearing-panels.ts:59` sets `now: "none"` and both clients render chrome from that map, so neither has a toggle there — which is what the spec's family table requires. No task needed; recorded so it is not re-raised.

**Still open, and not this plan's:** the panel's close is a hard jump cut after an animated open; the suggested fix is a short opacity fade before unmount. It belongs with the close-moment motion work in Plan 3.

**Ordering.** Task 2 must precede Tasks 3 and 4 (both consume `buildAttention`). Task 5 must follow Tasks 3 and 4 — the spine is what makes Month redundant, so deleting Month first would leave a gap. Task 6 is independent and may run any time after Task 1.
