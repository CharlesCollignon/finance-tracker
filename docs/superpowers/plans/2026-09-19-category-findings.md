# Category Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/history`'s one-category-at-a-time screen with a band of findings, a grid of small multiples, and a panel that opens in place — over a new pure module that measures what a category's run of months has done.

**Architecture:** A pure core module turns thirty-six months of `CategoryHistory` into typed `CategoryFinding`s that carry an i18n key and parameters, never a sentence. The web screen renders them; the app's own euro ordering leads. Two model calls sit on top, both optional and both capped: one re-ranks the findings, one writes a read for a single category.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest (pure core tests), Next.js App Router (web only), Supabase/Postgres, Mistral through the existing month-read adapter, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-19-category-findings-design.md`

## Global Constraints

- **Tests are pure.** Everything in `packages/core` is tested with no database, no network and no model. Run with `pnpm --filter @finance/core test`; a single file with `pnpm --filter @finance/core exec vitest run src/<file>.test.ts`.
- **New core modules must be added to `packages/core/package.json`'s `exports` map.** The wildcard export was deliberately replaced with an explicit map of 84 subpaths (commit `79b92ff`); a module missing from it cannot be imported and the failure looks like a broken path.
- **No rendered text in `packages/core` findings code.** A finding carries `messageKey: Key` and `params: Vars`, following `attention.ts`. The client calls `t()`.
- **No money inside a finding sentence.** An amount inside prose cannot be blurred by privacy mode and cannot follow the currency toggle. Sentences carry counts and month names; the euro figure is rendered as its own element beside them, through `useFormatCurrency()` and `PrivateAmount`.
- **Every user-facing string goes through `packages/core/src/i18n/messages/{en,fr}.ts`**, including the English currently hardcoded in `CategoryHistoryView.tsx`. `en.ts` is the schema; a missing or extra French key is a type error.
- **Normal is a median, never a mean.** Median of the last twelve non-empty months. The thirty-six-month window serves `every-year` only.
- **Severity is euros per month, always positive.** Direction is carried separately.
- **Every write to a model-budget table goes through a `security definer` function guarded by `acting_for()`** (migration 025), with the default PUBLIC grant revoked in the same breath. Never a client `UPDATE`.
- **Read paths tolerate a migration that has not run**, using the `isMissingSchema` pattern in `apps/web/lib/month-read/store.ts`. "Untracked" stops the model being asked at all.
- **Web only.** Nothing in `apps/mobile` changes.
- Commit after each task. Branch is `category-findings`.

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `packages/core/src/category-findings.ts` | Pure. Turns `CategoryHistory[]` into `CategoryFinding[]`. |
| `packages/core/src/category-findings.test.ts` | Its tests. |
| `packages/core/src/category-facts.ts` | The datum pack for one category. |
| `packages/core/src/category-read.ts` | The read's shape, JSON schema and verification. |
| `packages/core/src/category-read.test.ts` | Its tests. |
| `packages/core/src/category-read-prompt.ts` | What the writer is asked, per language. |
| `packages/core/src/category-selection.ts` | The selection's shape and verification. |
| `packages/core/src/category-selection.test.ts` | Its tests. |
| `packages/core/src/category-selection-prompt.ts` | What the ranker is asked. |
| `apps/web/components/finance/category/FindingBand.tsx` | Layer 1: the strip and the finding rows. |
| `apps/web/components/finance/category/FindingRow.tsx` | One finding, its sentence and its figure. |
| `apps/web/components/finance/category/CategoryGrid.tsx` | Layer 2: the grouped grid and the open-panel slot. |
| `apps/web/components/finance/category/CategoryTile.tsx` | One tile. |
| `apps/web/components/finance/category/CategoryPanel.tsx` | Layer 3: the in-place panel. |
| `apps/web/components/finance/category/CategoryRead.tsx` | The prose inside the panel. |
| `apps/web/lib/category-read/{facts,store,write,client,source}.ts` | The read's plumbing, mirroring `lib/month-read/`. |
| `apps/web/lib/actions/category-read.ts` | The two server actions. |
| `supabase/migrations/035_category_findings.sql` | `category_reads`, `category_selections` and their functions. |

**Modified**

| File | Change |
| --- | --- |
| `packages/core/src/category-history.ts` | Window becomes genuinely variable; `trend` deleted. |
| `packages/core/src/category-history.test.ts` | Drop the `trend` tests; keep the rest. |
| `packages/core/src/i18n/messages/{en,fr}.ts` | A `categoryFindings` group and a `categoryScreen` group. |
| `packages/core/package.json` | Five new entries in `exports`. |
| `packages/core/src/types/database.ts` | `CategoryReadRow`, `CategorySelectionRow`, and the two tables on `Database`. |
| `apps/web/app/(app)/history/page.tsx` | Reads 36 months, computes findings, loads stored reads. |
| `apps/web/components/finance/CategoryHistoryView.tsx` | Moves to `category/`, becomes orchestration only. |
| `CONTEXT.md` | Two new entries. |

---

### Task 1: Vocabulary and the message catalogues

Everything downstream needs these keys to exist, because `Key` is derived from `en.ts` and a finding naming a key that is not there is a type error.

**Files:**
- Modify: `CONTEXT.md`
- Modify: `packages/core/src/i18n/messages/en.ts`
- Modify: `packages/core/src/i18n/messages/fr.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the message keys `categoryFindings.*` and `categoryScreen.*`, usable as `Key`.

- [ ] **Step 1: Add the two vocabulary entries to `CONTEXT.md`**

Insert a new section after "### Words about a month", before "### Where it all stands":

```markdown
### What a category has been doing

**Finding**:
One thing the app noticed in a category's run of months that is worth saying
out loud. Four species only, and each is a measurement rather than an
impression: what has drifted, a month apart, a category gone quiet, and what
happens every year. A finding carries an i18n key and its parameters, never a
sentence — the wording belongs to the client drawing it, in the reader's
language.
_Avoid_: insight, alert, anomaly, signal

**Normal**:
What a category costs in an ordinary month: the median of its non-empty
months, not their mean. A mean is dragged by exceptional months, which are
exactly the ones a finding is looking for, and a threshold that moves with the
anomaly it is meant to detect detects nothing.
_Avoid_: average, baseline, typical
```

- [ ] **Step 2: Add the `categoryFindings` group to `en.ts`**

Add as a new top-level group inside `export const en = {`:

```ts
  /**
   * What a finding says, in words.
   *
   * No amount appears in any of these. A figure inside a sentence cannot be
   * blurred by privacy mode and cannot follow the currency toggle, which is
   * the same reason `month-facts.ts` gives for placeholders. The euro weight
   * is rendered beside the sentence, in its own element.
   *
   * `months` is a count and takes plural forms; French puts zero in the
   * singular, so these cannot be ternaries at the call site.
   */
  categoryFindings: {
    driftUp: {
      one: "has climbed for {months} month running",
      other: "has climbed for {months} months running",
    },
    driftDown: {
      one: "has fallen for {months} month running",
      other: "has fallen for {months} months running",
    },
    oddMonthHigh: "{month} stands well above a normal month here",
    oddMonthLow: "{month} stands well below a normal month here",
    goneQuiet: {
      one: "nothing recorded for {months} month, after a steady run",
      other: "nothing recorded for {months} months, after a steady run",
    },
    appeared: "new since {month}, and steady since",
    everyYear: "{month} runs high here every year",
    weightPerMonth: "{amount} a month",
    weightOnce: "{amount}",
    bandTitle: "What moved",
    bandEmpty: "Nothing has moved enough to be worth a sentence.",
    rerank: "Ask for a reading",
    reranked: "Ordered by a model",
    rerankStale: "The figures have moved since this order was chosen.",
  },
```

- [ ] **Step 3: Add the `categoryScreen` group to `en.ts`**

This replaces the hardcoded English in `CategoryHistoryView.tsx`.

```ts
  /** The by-category screen's own furniture. */
  categoryScreen: {
    empty: "Nothing to look back on yet",
    emptyBody:
      "Once a few months have transactions in them, each category's run shows up here.",
    normal: "{amount} in a normal month",
    normalShifted: "{amount} per pay period",
    periodShifted:
      "These land either side of a month end, so each is counted against the period it belongs to. A month here can differ from the same month in the Ledger.",
    groupExpense: "Going out",
    groupIncome: "Coming in",
    groupSavings: "Set aside",
    groupInvestment: "Invested",
    open: "Open {name}",
    close: "Close",
    behindThisMonth: "Behind {month}",
    seeInLedger: "See all in the Ledger",
    months: "Last {count} months",
  },
```

- [ ] **Step 4: Add the same two groups to `fr.ts`**

```ts
  categoryFindings: {
    driftUp: {
      one: "monte depuis {months} mois",
      other: "monte depuis {months} mois d'affilée",
    },
    driftDown: {
      one: "baisse depuis {months} mois",
      other: "baisse depuis {months} mois d'affilée",
    },
    oddMonthHigh: "{month} sort nettement au-dessus d'un mois normal ici",
    oddMonthLow: "{month} sort nettement en dessous d'un mois normal ici",
    goneQuiet: {
      one: "rien enregistré depuis {months} mois, après une série régulière",
      other: "rien enregistré depuis {months} mois, après une série régulière",
    },
    appeared: "nouveau depuis {month}, et régulier depuis",
    everyYear: "{month} est cher ici toutes les années",
    weightPerMonth: "{amount} par mois",
    weightOnce: "{amount}",
    bandTitle: "Ce qui a bougé",
    bandEmpty: "Rien n'a assez bougé pour mériter une phrase.",
    rerank: "Demander une lecture",
    reranked: "Classé par un modèle",
    rerankStale: "Les chiffres ont bougé depuis ce classement.",
  },

  categoryScreen: {
    empty: "Rien à revoir pour l'instant",
    emptyBody:
      "Dès que quelques mois auront des transactions, la série de chaque catégorie apparaîtra ici.",
    normal: "{amount} dans un mois normal",
    normalShifted: "{amount} par période de paie",
    periodShifted:
      "Ces mouvements tombent de part et d'autre d'une fin de mois : chacun est compté dans la période à laquelle il appartient. Un mois ici peut différer du même mois dans le Ledger.",
    groupExpense: "Ce qui sort",
    groupIncome: "Ce qui entre",
    groupSavings: "Mis de côté",
    groupInvestment: "Investi",
    open: "Ouvrir {name}",
    close: "Fermer",
    behindThisMonth: "Derrière {month}",
    seeInLedger: "Tout voir dans le Ledger",
    months: "{count} derniers mois",
  },
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @finance/core exec tsc --noEmit`
Expected: PASS. A missing or extra key in `fr.ts` fails here, which is the point of `Messages = typeof en`.

Note: `pnpm check:reachability` will report these keys as unused until Task 7. Do not run it as a gate before then.

- [ ] **Step 6: Commit**

```bash
git add CONTEXT.md packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts
git commit -m "Name findings and a normal, and give them words in both languages"
```

---

### Task 2: A normal, a spread, and the `drift` species

**Files:**
- Create: `packages/core/src/category-findings.ts`
- Create: `packages/core/src/category-findings.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: `CategoryHistory` and `buildCategoryHistory` from `./category-history`; `Key`, `Vars` from `./i18n/t`; `CategoryType` from `./types/database`.
- Produces:
  - `type FindingKind = "drift" | "odd-month" | "gone-quiet" | "every-year"`
  - `interface CategoryFinding { id: string; kind: FindingKind; categoryId: string; categoryName: string; type: CategoryType; severity: number; direction: "up" | "down"; months: string[]; messageKey: Key; params: Vars }`
  - `function categoryNormal(points: readonly CategoryMonthPoint[], window?: number): { normal: number; spread: number }`
  - `function buildCategoryFindings(histories: readonly CategoryHistory[]): CategoryFinding[]`
  - The threshold constants listed in Step 3.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/category-findings.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildCategoryHistory } from "./category-history";
import { buildCategoryFindings, categoryNormal } from "./category-findings";
import type { CategoryType, TransactionWithCategory } from "./types/database";

/** One transaction, with only the fields a history needs. */
function tx(
  occurredOn: string,
  amount: number,
  categoryId = "cat-groceries",
  name = "Groceries",
  type: CategoryType = "expense",
): TransactionWithCategory {
  return {
    id: `tx-${occurredOn}-${amount}-${categoryId}`,
    user_id: "u",
    category_id: categoryId,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T00:00:00.000Z`,
    categories: { name, type, icon: null, counts_toward_summary: true },
  };
}

/**
 * One payment on the 4th of each of the months ending at 2026-09, oldest
 * first. `amounts` shorter than the window leaves the earlier months empty.
 */
function run(
  amounts: (number | null)[],
  categoryId = "cat-groceries",
  name = "Groceries",
  type: CategoryType = "expense",
): TransactionWithCategory[] {
  const out: TransactionWithCategory[] = [];
  const count = amounts.length;
  amounts.forEach((amount, index) => {
    if (amount === null) {
      return;
    }
    const back = count - 1 - index;
    const date = new Date(Date.UTC(2026, 8 - back, 4));
    const iso = date.toISOString().slice(0, 10);
    out.push(tx(iso, amount, categoryId, name, type));
  });
  return out;
}

function findingsFor(transactions: TransactionWithCategory[]) {
  return buildCategoryFindings(
    buildCategoryHistory(transactions, 2026, 9, { months: 36 }),
  );
}

describe("categoryNormal", () => {
  it("takes the median, so one monstrous month does not become the normal", () => {
    const [history] = buildCategoryHistory(
      run([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 2000]),
      2026,
      9,
      { months: 36 },
    );

    const { normal } = categoryNormal(history!.points);
    // The mean would be about 258.
    expect(normal).toBe(100);
  });

  it("ignores months with nothing in them", () => {
    const [history] = buildCategoryHistory(
      run([null, null, null, 200, 200, 200]),
      2026,
      9,
      { months: 36 },
    );

    expect(categoryNormal(history!.points).normal).toBe(200);
  });
});

describe("buildCategoryFindings, drift", () => {
  it("reports a category that has climbed for three months", () => {
    const findings = findingsFor(
      run([300, 300, 300, 300, 300, 300, 420, 440, 460]),
    );

    const drift = findings.find((f) => f.kind === "drift");
    expect(drift).toBeDefined();
    expect(drift!.direction).toBe("up");
    expect(drift!.categoryId).toBe("cat-groceries");
    expect(drift!.messageKey).toBe("categoryFindings.driftUp");
    // 440 (median of the last three) against 300: 140 a month.
    expect(drift!.severity).toBe(140);
  });

  it("says nothing about a large percentage of a small amount", () => {
    // 40% up, and four euros a month. Real, and not worth a sentence.
    const findings = findingsFor(run([10, 10, 10, 10, 10, 10, 14, 14, 14]));

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("says nothing about a large amount that barely moved", () => {
    // 60 euros a month on a 1200 baseline: five percent, under the floor.
    const findings = findingsFor(
      run([1200, 1200, 1200, 1200, 1200, 1200, 1260, 1260, 1260]),
    );

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("refuses to call anything normal on two months of history", () => {
    const findings = findingsFor(run([300, 900]));

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("reads a fall as a fall", () => {
    const findings = findingsFor(
      run([400, 400, 400, 400, 400, 400, 240, 230, 250]),
    );

    const drift = findings.find((f) => f.kind === "drift");
    expect(drift!.direction).toBe("down");
    expect(drift!.messageKey).toBe("categoryFindings.driftDown");
  });

  it("puts the heaviest finding first", () => {
    const findings = findingsFor([
      ...run([300, 300, 300, 300, 300, 300, 420, 440, 460]),
      ...run(
        [1000, 1000, 1000, 1000, 1000, 1000, 1500, 1520, 1540],
        "cat-rent",
        "Rent",
      ),
    ]);

    expect(findings[0]!.categoryId).toBe("cat-rent");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: FAIL — `Failed to resolve import "./category-findings"`.

- [ ] **Step 3: Write `category-findings.ts`**

```ts
/**
 * What a category's run of months has been doing.
 *
 * `category-history.ts` draws the series; this reads it. They are different
 * jobs: a screen that states twelve figures and draws no conclusion leaves
 * the reader to do the one thing a computer is better at, which is noticing
 * that a number has been going the same way for five months.
 *
 * Carries no rendered text, only a key and its parameters — the precedent is
 * `attention.ts`, and the reason is the same: a client handed a key cannot
 * introduce a fourth wording, because there is no string here to improvise
 * from.
 *
 * Pure. Testable without a database, a network or a model.
 */

import type { CategoryHistory, CategoryMonthPoint } from "./category-history";
import type { Key, Vars } from "./i18n/t";
import type { CategoryType } from "./types/database";

export type FindingKind = "drift" | "odd-month" | "gone-quiet" | "every-year";

export interface CategoryFinding {
  /** Stable across a render, and what the model names when it re-ranks. */
  id: string;
  kind: FindingKind;
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  /**
   * What it is worth, in currency units a month. Always positive: which way
   * it went is `direction`, and whether that is good news depends on the
   * category type, which is the client's business.
   */
  severity: number;
  direction: "up" | "down";
  /** The months it points at, as `YYYY-MM`, oldest first. */
  months: string[];
  messageKey: Key;
  params: Vars;
}

/**
 * How many months back a normal is taken over.
 *
 * Twelve, not the whole read window. A category that genuinely stepped up a
 * year ago has settled at its new level, and a normal dragged back towards
 * the old one would report a drift that finished twelve months ago as though
 * it were news. The deeper history is for `every-year` and nothing else.
 */
export const NORMAL_WINDOW = 12;

/** The recent side of a drift, and the side it is measured against. */
export const DRIFT_RECENT = 3;
export const DRIFT_BASELINE = 6;

/**
 * Both floors, and why there are two.
 *
 * A relative floor alone lets a four-euro category shout. An absolute floor
 * alone lets a category with a large normal hide a real change inside it.
 */
export const DRIFT_RELATIVE_FLOOR = 0.15;
export const DRIFT_ABSOLUTE_FLOOR = 25;

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What a category costs in an ordinary month, and how much it usually varies.
 *
 * The spread is the median absolute deviation rather than a standard
 * deviation, for the same reason the centre is a median: one monstrous month
 * inflates a standard deviation enough to hide itself inside it.
 */
export function categoryNormal(
  points: readonly CategoryMonthPoint[],
  window: number = NORMAL_WINDOW,
): { normal: number; spread: number } {
  const recent = points.slice(-window).filter((point) => !point.empty);
  const totals = recent.map((point) => point.total);
  const normal = median(totals);
  const spread = median(totals.map((total) => Math.abs(total - normal)));
  return { normal: round(normal), spread: round(spread) };
}

/** Non-empty totals from a slice, for a median that ignores holes. */
function activeTotals(points: readonly CategoryMonthPoint[]): number[] {
  return points.filter((point) => !point.empty).map((point) => point.total);
}

function driftFinding(history: CategoryHistory): CategoryFinding | null {
  const points = history.points;
  const recent = points.slice(-DRIFT_RECENT);
  const baseline = points.slice(
    -(DRIFT_RECENT + DRIFT_BASELINE),
    -DRIFT_RECENT,
  );

  const recentTotals = activeTotals(recent);
  const baselineTotals = activeTotals(baseline);

  // "Normal" needs something to be normal against. Three months either side
  // is the least that can distinguish a run from two coincidences.
  if (recentTotals.length < 3 || baselineTotals.length < 3) {
    return null;
  }

  const before = median(baselineTotals);
  const after = median(recentTotals);
  const gap = after - before;
  const size = Math.abs(gap);

  if (before <= 0) {
    return null;
  }
  if (size < DRIFT_ABSOLUTE_FLOOR || size / before < DRIFT_RELATIVE_FLOOR) {
    return null;
  }

  const direction = gap > 0 ? "up" : "down";
  const months = recent.map((point) => point.monthKey);

  return {
    id: `drift:${history.categoryId}`,
    kind: "drift",
    categoryId: history.categoryId,
    categoryName: history.name,
    type: history.type,
    severity: round(size),
    direction,
    months,
    messageKey:
      direction === "up"
        ? "categoryFindings.driftUp"
        : "categoryFindings.driftDown",
    params: { months: DRIFT_RECENT },
  };
}

/**
 * Every finding across every category, heaviest first.
 *
 * Heaviest in currency units a month, never as a percentage and never as a
 * composite score. Currency units are comparable between categories and
 * percentages are not, and this is the ordering the screen falls back to when
 * no model answers — so it has to stand on its own rather than be a stopgap.
 */
export function buildCategoryFindings(
  histories: readonly CategoryHistory[],
): CategoryFinding[] {
  const findings: CategoryFinding[] = [];

  for (const history of histories) {
    const drift = driftFinding(history);
    if (drift) {
      findings.push(drift);
    }
  }

  return findings.sort((a, b) => b.severity - a.severity);
}
```

- [ ] **Step 4: Add the module to the core package's exports**

In `packages/core/package.json`, inside `"exports"`, keeping the map alphabetical, add after `"./category-history"`:

```json
    "./category-findings": "./src/category-findings.ts",
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/category-findings.ts packages/core/src/category-findings.test.ts packages/core/package.json
git commit -m "Measure a category's normal, and the drift away from it"
```

---

### Task 3: The `odd-month` species

**Files:**
- Modify: `packages/core/src/category-findings.ts`
- Modify: `packages/core/src/category-findings.test.ts`

**Interfaces:**
- Consumes: `categoryNormal`, `CategoryFinding` from Task 2.
- Produces: `ODD_MONTH_SPREADS`, `ODD_MONTH_ABSOLUTE_FLOOR`; findings with `kind: "odd-month"` whose `months` holds exactly one key.

- [ ] **Step 1: Write the failing tests**

Append to `category-findings.test.ts`:

```ts
describe("buildCategoryFindings, odd month", () => {
  it("names the one month that stands apart", () => {
    const findings = findingsFor(
      run([200, 210, 195, 205, 200, 190, 205, 195, 900]),
    );

    const odd = findings.find((f) => f.kind === "odd-month");
    expect(odd).toBeDefined();
    expect(odd!.months).toEqual(["2026-09"]);
    expect(odd!.direction).toBe("up");
    expect(odd!.messageKey).toBe("categoryFindings.oddMonthHigh");
    // 900 against a normal of 200.
    expect(odd!.severity).toBe(700);
  });

  it("is not fooled into hiding the spike inside its own spread", () => {
    // A standard deviation over this run is large enough to swallow the
    // 900. A median absolute deviation is not.
    const findings = findingsFor(
      run([200, 200, 200, 200, 200, 200, 200, 200, 900]),
    );

    expect(findings.some((f) => f.kind === "odd-month")).toBe(true);
  });

  it("says nothing about a small category having a slightly odd month", () => {
    const findings = findingsFor(run([8, 9, 8, 9, 8, 9, 8, 9, 30]));

    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
  });

  it("reports a month well below the normal too", () => {
    const findings = findingsFor(
      run([400, 410, 395, 405, 400, 390, 405, 395, 40]),
    );

    const odd = findings.find((f) => f.kind === "odd-month");
    expect(odd!.direction).toBe("down");
    expect(odd!.messageKey).toBe("categoryFindings.oddMonthLow");
  });

  it("reports at most the oddest month, not every month above normal", () => {
    const findings = findingsFor(
      run([200, 200, 200, 200, 200, 200, 800, 200, 900]),
    );

    expect(findings.filter((f) => f.kind === "odd-month")).toHaveLength(1);
    expect(findings.find((f) => f.kind === "odd-month")!.months).toEqual([
      "2026-09",
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: FAIL — `expected undefined not to be undefined` on the first new test.

- [ ] **Step 3: Implement**

Add to `category-findings.ts`, after the drift constants:

```ts
/**
 * How many spreads from the normal a month has to be before it is worth a
 * sentence, and how many currency units at the least.
 *
 * Three spreads is not an appeal to statistical convention — with a median
 * absolute deviation over twelve points it is simply the width at which the
 * months a person would call unusual start being caught and the ones they
 * would not, stop.
 */
export const ODD_MONTH_SPREADS = 3;
export const ODD_MONTH_ABSOLUTE_FLOOR = 40;
```

And this function, plus its call inside `buildCategoryFindings`:

```ts
function oddMonthFinding(history: CategoryHistory): CategoryFinding | null {
  const { normal, spread } = categoryNormal(history.points);
  if (normal <= 0) {
    return null;
  }

  const window = history.points.slice(-NORMAL_WINDOW).filter((p) => !p.empty);
  if (window.length < 6) {
    return null;
  }

  // A spread of zero means a perfectly flat run, where any departure at all
  // is the odd month. The absolute floor is what keeps that honest.
  const bar = Math.max(spread * ODD_MONTH_SPREADS, ODD_MONTH_ABSOLUTE_FLOOR);

  let worst: CategoryMonthPoint | null = null;
  let worstDistance = 0;
  for (const point of window) {
    const distance = Math.abs(point.total - normal);
    if (distance >= bar && distance > worstDistance) {
      worst = point;
      worstDistance = distance;
    }
  }

  if (!worst) {
    return null;
  }

  const direction = worst.total > normal ? "up" : "down";

  return {
    id: `odd-month:${history.categoryId}:${worst.monthKey}`,
    kind: "odd-month",
    categoryId: history.categoryId,
    categoryName: history.name,
    type: history.type,
    severity: round(worstDistance),
    direction,
    months: [worst.monthKey],
    messageKey:
      direction === "up"
        ? "categoryFindings.oddMonthHigh"
        : "categoryFindings.oddMonthLow",
    params: { month: worst.label },
  };
}
```

In `buildCategoryFindings`, after the drift push:

```ts
    const odd = oddMonthFinding(history);
    if (odd) {
      findings.push(odd);
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/category-findings.ts packages/core/src/category-findings.test.ts
git commit -m "Name the one month that stands apart from a category's normal"
```

---

### Task 4: The `gone-quiet` species

**Files:**
- Modify: `packages/core/src/category-findings.ts`
- Modify: `packages/core/src/category-findings.test.ts`

**Interfaces:**
- Produces: `QUIET_ACTIVE_OF_SIX`, `QUIET_SILENT_MONTHS`; findings with `kind: "gone-quiet"` and `messageKey` of `categoryFindings.goneQuiet` or `categoryFindings.appeared`.

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe("buildCategoryFindings, gone quiet", () => {
  it("reports a steady charge that stopped", () => {
    const findings = findingsFor(
      run([34, 34, 34, 34, 34, 34, null, null, null]),
    );

    const quiet = findings.find((f) => f.kind === "gone-quiet");
    expect(quiet).toBeDefined();
    expect(quiet!.direction).toBe("down");
    expect(quiet!.messageKey).toBe("categoryFindings.goneQuiet");
    expect(quiet!.severity).toBe(34);
  });

  it("says nothing about a category that was never steady", () => {
    const findings = findingsFor(
      run([80, null, null, 90, null, null, null, null, null]),
    );

    expect(findings.filter((f) => f.kind === "gone-quiet")).toEqual([]);
  });

  it("reports a category that has just appeared", () => {
    const findings = findingsFor(
      run([null, null, null, null, null, null, 120, 118, 122]),
    );

    const quiet = findings.find((f) => f.kind === "gone-quiet");
    expect(quiet!.direction).toBe("up");
    expect(quiet!.messageKey).toBe("categoryFindings.appeared");
  });

  it("does not read a salary straddling a month end as a silence", () => {
    // Every one of these periods holds exactly one payment; on a calendar
    // they look like doubles and holes. buildCategoryHistory regroups them.
    const dates = [
      "2025-10-31",
      "2025-12-01",
      "2025-12-31",
      "2026-02-01",
      "2026-02-28",
      "2026-03-31",
      "2026-05-01",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-10-01",
    ];
    const findings = buildCategoryFindings(
      buildCategoryHistory(
        dates.map((date) => tx(date, 4500, "pay", "Salary", "income")),
        2026,
        9,
        { months: 36 },
      ),
    );

    expect(findings.filter((f) => f.kind === "gone-quiet")).toEqual([]);
    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: FAIL on the first new test.

- [ ] **Step 3: Implement**

Constants:

```ts
/**
 * What counts as a run, and what counts as a silence.
 *
 * Four of the six preceding months rather than all six, because a genuinely
 * monthly charge still misses one when a bank holiday moves it. Three silent
 * months rather than one, because a charge that lands on the 2nd has not
 * stopped on the 1st.
 */
export const QUIET_ACTIVE_OF_SIX = 4;
export const QUIET_SILENT_MONTHS = 3;
```

Function and call:

```ts
function goneQuietFinding(history: CategoryHistory): CategoryFinding | null {
  const points = history.points;
  const recent = points.slice(-QUIET_SILENT_MONTHS);
  const before = points.slice(
    -(QUIET_SILENT_MONTHS + 6),
    -QUIET_SILENT_MONTHS,
  );

  const recentActive = recent.filter((point) => !point.empty);
  const beforeActive = before.filter((point) => !point.empty);

  // Stopped: a run, then nothing.
  if (
    recentActive.length === 0 &&
    beforeActive.length >= QUIET_ACTIVE_OF_SIX
  ) {
    return {
      id: `gone-quiet:${history.categoryId}`,
      kind: "gone-quiet",
      categoryId: history.categoryId,
      categoryName: history.name,
      type: history.type,
      severity: round(median(beforeActive.map((point) => point.total))),
      direction: "down",
      months: recent.map((point) => point.monthKey),
      messageKey: "categoryFindings.goneQuiet",
      params: { months: QUIET_SILENT_MONTHS },
    };
  }

  // Appeared: nothing, then a run. The same shape read backwards.
  if (
    beforeActive.length === 0 &&
    recentActive.length === QUIET_SILENT_MONTHS
  ) {
    const first = recent[0]!;
    return {
      id: `gone-quiet:${history.categoryId}`,
      kind: "gone-quiet",
      categoryId: history.categoryId,
      categoryName: history.name,
      type: history.type,
      severity: round(median(recentActive.map((point) => point.total))),
      direction: "up",
      months: recent.map((point) => point.monthKey),
      messageKey: "categoryFindings.appeared",
      params: { month: first.label },
    };
  }

  return null;
}
```

In `buildCategoryFindings`:

```ts
    const quiet = goneQuietFinding(history);
    if (quiet) {
      findings.push(quiet);
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/category-findings.ts packages/core/src/category-findings.test.ts
git commit -m "Say when a steady charge stopped, and when one appeared"
```

---

### Task 5: `every-year`, and the demotion it exists for

This is the task the module is for. Without it the screen cries drift about the energy bill every December, and a screen that cries wolf on schedule is one the reader learns to skip.

**Files:**
- Modify: `packages/core/src/category-findings.ts`
- Modify: `packages/core/src/category-findings.test.ts`

**Interfaces:**
- Produces: `SEASON_YEARS`; `kind: "every-year"` findings, and the demotion rule applied inside `buildCategoryFindings`.

- [ ] **Step 1: Write the failing tests**

Append:

```ts
describe("buildCategoryFindings, every year", () => {
  /** Thirty-six months, with `high` added every December and September. */
  function seasonal(base: number, high: number): TransactionWithCategory[] {
    const out: TransactionWithCategory[] = [];
    for (let back = 35; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(2026, 8 - back, 4));
      const month = date.getUTCMonth() + 1;
      const amount = month === 12 || month === 9 ? high : base;
      out.push(
        tx(
          date.toISOString().slice(0, 10),
          amount,
          "cat-energy",
          "Energy",
          "expense",
        ),
      );
    }
    return out;
  }

  it("does not call a September that is high every year a drift", () => {
    const findings = findingsFor(seasonal(100, 400));

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
  });

  it("says instead that this month runs high every year", () => {
    const findings = findingsFor(seasonal(100, 400));

    const season = findings.find((f) => f.kind === "every-year");
    expect(season).toBeDefined();
    expect(season!.months).toEqual(["2026-09"]);
    expect(season!.messageKey).toBe("categoryFindings.everyYear");
  });

  it("still reports a spike in a month that is not seasonal", () => {
    const transactions = seasonal(100, 400).filter(
      (entry) => !entry.occurred_on.startsWith("2026-07"),
    );
    transactions.push(tx("2026-07-04", 900, "cat-energy", "Energy"));

    const findings = buildCategoryFindings(
      buildCategoryHistory(transactions, 2026, 9, { months: 36 }),
    );

    const odd = findings.find((f) => f.kind === "odd-month");
    expect(odd!.months).toEqual(["2026-07"]);
  });

  it("will not call one year's September a pattern", () => {
    // Twelve months: this September is high, and there is no earlier one to
    // say it is high every year. One occurrence is a month, not a pattern.
    const findings = buildCategoryFindings(
      buildCategoryHistory(seasonal(100, 400), 2026, 9, { months: 12 }),
    );

    expect(findings.some((f) => f.kind === "every-year")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-findings.test.ts`
Expected: FAIL — drift and odd-month findings are still produced for the seasonal run.

- [ ] **Step 3: Implement**

```ts
/**
 * How many years the same calendar month has to behave the same way.
 *
 * Two, which is the least that can be a pattern rather than a coincidence,
 * and the reason the read window is thirty-six months rather than twelve.
 */
export const SEASON_YEARS = 2;

/**
 * The calendar months this category reliably runs away from its normal in.
 *
 * Returned as the set of `YYYY-MM` keys inside the window that belong to
 * those calendar months, because that is the form the demotion needs.
 */
function seasonalMonths(history: CategoryHistory): {
  keys: Set<string>;
  latest: CategoryMonthPoint | null;
  direction: "up" | "down";
} {
  const { normal, spread } = categoryNormal(history.points);
  const bar = Math.max(spread * ODD_MONTH_SPREADS, ODD_MONTH_ABSOLUTE_FLOOR);
  const keys = new Set<string>();
  let latest: CategoryMonthPoint | null = null;
  let direction: "up" | "down" = "up";

  if (normal <= 0) {
    return { keys, latest, direction };
  }

  const byCalendarMonth = new Map<string, CategoryMonthPoint[]>();
  for (const point of history.points) {
    if (point.empty) {
      continue;
    }
    const calendar = point.monthKey.slice(5);
    byCalendarMonth.set(calendar, [
      ...(byCalendarMonth.get(calendar) ?? []),
      point,
    ]);
  }

  for (const [, points] of byCalendarMonth) {
    if (points.length < SEASON_YEARS) {
      continue;
    }
    const up = points.every((point) => point.total - normal >= bar);
    const down = points.every((point) => normal - point.total >= bar);
    if (!up && !down) {
      continue;
    }
    for (const point of points) {
      keys.add(point.monthKey);
    }
    const last = points[points.length - 1]!;
    if (!latest || last.monthKey > latest.monthKey) {
      latest = last;
      direction = up ? "up" : "down";
    }
  }

  return { keys, latest, direction };
}
```

Then rewrite `buildCategoryFindings`:

```ts
export function buildCategoryFindings(
  histories: readonly CategoryHistory[],
): CategoryFinding[] {
  const findings: CategoryFinding[] = [];

  for (const history of histories) {
    const season = seasonalMonths(history);

    // A finding every one of whose months is a month this category always
    // behaves this way in is not news. Demoted rather than listed — see the
    // design note: a screen that cries wolf on schedule is one nobody reads.
    const survives = (finding: CategoryFinding | null) =>
      finding && !finding.months.every((key) => season.keys.has(key))
        ? finding
        : null;

    const kept = [
      survives(driftFinding(history)),
      survives(oddMonthFinding(history)),
      survives(goneQuietFinding(history)),
    ].filter((finding): finding is CategoryFinding => finding !== null);

    // The seasonal note appears only when it silenced everything else, and
    // only about the month on screen now. Said on its own it answers the
    // question the demotion raises: why is this high month not a finding?
    const currentIsSeasonal =
      season.latest !== null &&
      season.latest.monthKey ===
        history.points[history.points.length - 1]?.monthKey;

    if (kept.length === 0 && currentIsSeasonal && season.latest) {
      const { normal } = categoryNormal(history.points);
      findings.push({
        id: `every-year:${history.categoryId}:${season.latest.monthKey}`,
        kind: "every-year",
        categoryId: history.categoryId,
        categoryName: history.name,
        type: history.type,
        severity: round(Math.abs(season.latest.total - normal)),
        direction: season.direction,
        months: [season.latest.monthKey],
        messageKey: "categoryFindings.everyYear",
        params: { month: season.latest.label },
      });
      continue;
    }

    findings.push(...kept);
  }

  return findings.sort((a, b) => b.severity - a.severity);
}
```

- [ ] **Step 4: Run the whole core suite**

Run: `pnpm --filter @finance/core test`
Expected: PASS. The findings file has 21 tests; nothing else should have moved.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/category-findings.ts packages/core/src/category-findings.test.ts
git commit -m "Let a yearly pattern silence the findings it explains"
```

---

### Task 6: A variable window, and the end of `trend`

**Run this task after Task 7, not before it.** `trend`'s only reader is the old `CategoryHistoryView.tsx`, which Task 7 deletes. Deleting the field first would leave the web app failing typecheck for the length of one task, against this plan's promise that every task ends somewhere the screen still works.

**Files:**
- Modify: `packages/core/src/category-history.ts`
- Modify: `packages/core/src/category-history.test.ts`

**Interfaces:**
- Produces: `CategoryHistory` without `trend`. `average` and `peak` stay; the screen stops using `average` in favour of `categoryNormal`.

- [ ] **Step 1: Delete the `trend` tests**

Remove these two tests from `category-history.test.ts`:
- `"reads the latest month against the ones before it"`
- `"says nothing about a trend it cannot support"`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-history.test.ts`
Expected: PASS for the remaining tests — deleting tests does not fail. The failure this task is driven by is a type error, so run this instead:

Run: `pnpm --filter @finance/core exec tsc --noEmit`
Expected: PASS currently; it will fail after Step 3 until the view stops reading `trend`, which Task 7 does. Note the expected error and move on.

- [ ] **Step 3: Delete `trend` from the interface and the builder**

In `category-history.ts`, remove the `trend` field from `CategoryHistory` along with its doc comment, and remove from `buildCategoryHistory` the `latest`, `earlier`, `baseline` locals and the `trend:` property. Replace the deleted interface comment with nothing — the field is gone, not moved.

Add to the module doc comment, after the paragraph about one category at a time:

```
 * A `trend` field lived here and has been removed. It compared the latest
 * month to the mean of the ones before it, which is the same question
 * `category-findings.ts` now answers off a median and two floors. Two answers
 * to one question on one screen is how a reader learns to trust neither.
```

- [ ] **Step 4: Confirm the window is already variable**

`buildCategoryHistory` already takes `{ months = 12 }` and honours it; `monthKeysEndingAt` already crosses year boundaries (there is a test). No change is needed beyond the caller passing 36, which Task 7 does. Verify by reading `monthKeysEndingAt` and confirming the existing test `"crosses a year boundary without losing a month"` passes.

Run: `pnpm --filter @finance/core exec vitest run src/category-history.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/category-history.ts packages/core/src/category-history.test.ts
git commit -m "Retire trend, whose question findings now answer properly"
```

---

### Task 7: The grid, the tiles, and the page

The screen becomes usable in this task even though no model is involved yet: findings ordered by the app, every category visible at once.

**Files:**
- Create: `apps/web/components/finance/category/CategoryGrid.tsx`
- Create: `apps/web/components/finance/category/CategoryTile.tsx`
- Create: `apps/web/components/finance/category/CategoryHistoryView.tsx`
- Delete: `apps/web/components/finance/CategoryHistoryView.tsx`
- Modify: `apps/web/app/(app)/history/page.tsx`

**Interfaces:**
- Consumes: `buildCategoryFindings`, `categoryNormal`, `CategoryFinding` from `@finance/core/category-findings`; `buildCategoryHistory`, `CategoryHistory` from `@finance/core/category-history`; `BarSeries` from `@/components/finance/charts`.
- Produces:
  - `interface CategoryCard { history: CategoryHistory; normal: number; drawn: CategoryMonthPoint[]; findings: CategoryFinding[] }`
  - `<CategoryHistoryView cards={...} findings={...} monthsDrawn={12} />`
  - `<CategoryGrid cards openId onOpen />`, `<CategoryTile card open onOpen />`

- [ ] **Step 1: Widen the page's query and compute the findings**

Rewrite `apps/web/app/(app)/history/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { buildCategoryHistory } from "@finance/core/category-history";
import {
  buildCategoryFindings,
  categoryNormal,
} from "@finance/core/category-findings";
import { getCurrentMonth, shiftMonth } from "@finance/core/constants";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { CategoryHistoryView } from "@/components/finance/category/CategoryHistoryView";
import { getLocale } from "@/lib/locale";

/**
 * How far back the page reads, and how far back it draws.
 *
 * Seasonality cannot be measured inside a twelve-month window — the same
 * calendar month has to appear at least twice — so the query widens and the
 * screen does not. Twenty-four bars in a tile the width of a phone column are
 * a texture rather than a chart.
 */
const MONTHS_READ = 36;
const MONTHS_DRAWN = 12;

export default async function HistoryPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const current = getCurrentMonth();
  const oldest = shiftMonth(current.year, current.month, -(MONTHS_READ - 1));
  const from = `${oldest.year}-${String(oldest.month).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", user.id)
    .gte("occurred_on", from)
    .order("occurred_on", { ascending: false });

  // Bound once: Task 9 reads the same rows to find what is behind a month.
  const rows = (data ?? []) as TransactionWithCategory[];

  const histories = buildCategoryHistory(rows, current.year, current.month, {
    months: MONTHS_READ,
    locale: await getLocale(),
  });

  const findings = buildCategoryFindings(histories);

  const cards = histories.map((history) => ({
    history,
    normal: categoryNormal(history.points).normal,
    drawn: history.points.slice(-MONTHS_DRAWN),
    findings: findings.filter((f) => f.categoryId === history.categoryId),
  }));

  return (
    <>
      <PageHeader titleKey="nav.ledger" />
      <PageContainer>
        <SurfaceTabs tabs={LEDGER_TABS} className="mb-4" />
        <CategoryHistoryView cards={cards} findings={findings} />
      </PageContainer>
    </>
  );
}
```

- [ ] **Step 2: Write `CategoryTile.tsx`**

```tsx
"use client";

import type { CategoryFinding } from "@finance/core/category-findings";
import type {
  CategoryHistory,
  CategoryMonthPoint,
} from "@finance/core/category-history";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { PrivateAmount } from "@/components/layout/PrivateAmount";

export interface CategoryCard {
  history: CategoryHistory;
  normal: number;
  drawn: CategoryMonthPoint[];
  findings: CategoryFinding[];
}

/** Which chart token a category type is drawn in. */
export const TONE: Record<string, string> = {
  expense: "var(--chart-2)",
  income: "var(--chart-3)",
  savings: "var(--chart-4)",
  investment: "var(--chart-1)",
};

interface CategoryTileProps {
  card: CategoryCard;
  open: boolean;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

/**
 * One category's run, small enough that twenty fit on a screen.
 *
 * Scaled against its own twelve months rather than against every category, so
 * what shows is the shape of this run and not the fact that the rent is
 * bigger than the coffee. Same argument `BarSeries` makes, applied to a tile.
 */
export function CategoryTile({
  card,
  open,
  onOpen,
  panelId,
}: CategoryTileProps) {
  const formatMoney = useFormatCurrency();
  const t = useT();
  const { history, normal, drawn, findings } = card;
  const peak = drawn.reduce((max, point) => Math.max(max, point.total), 0) || 1;
  const heaviest = findings[0] ?? null;

  return (
    <button
      type="button"
      onClick={() => onOpen(history.categoryId)}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={t("categoryScreen.open", { name: history.name })}
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border p-3 text-left",
        "transition-colors hover:border-primary-rim",
        open && "border-primary-rim bg-muted/40",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">
          {history.name}
        </span>
        {heaviest ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
              heaviest.direction === "up"
                ? "bg-destructive/15 text-destructive"
                : "bg-success/15 text-success",
            )}
          >
            <PrivateAmount>{formatMoney(heaviest.severity)}</PrivateAmount>
          </span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">
        <PrivateAmount>{formatMoney(normal)}</PrivateAmount>
      </span>
      <span className="mt-1 flex h-10 items-end gap-0.5">
        {drawn.map((point) => (
          <span
            key={point.monthKey}
            className="flex-1"
            style={{
              height: point.empty
                ? "1px"
                : `${Math.max((point.total / peak) * 100, 2)}%`,
              backgroundColor: point.empty
                ? "var(--color-border)"
                : (TONE[history.type] ?? "var(--chart-1)"),
            }}
          />
        ))}
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Write `CategoryGrid.tsx`**

```tsx
"use client";

import { Fragment } from "react";
import type { CategoryType } from "@finance/core/types/database";
import type { Key } from "@finance/core/i18n/t";
import { CategoryTile, type CategoryCard } from "./CategoryTile";
import { useT } from "@/lib/locale-context";

interface CategoryGridProps {
  cards: CategoryCard[];
  openId: string | null;
  onOpen: (categoryId: string) => void;
  /** Rendered full width, immediately after the open tile. */
  panel: React.ReactNode;
  panelId: string;
}

/**
 * The four groups, in the order money moves through them.
 *
 * Grouped rather than filtered: no control, no state, and a salary cannot end
 * up sitting between two spending categories.
 */
const GROUPS: { type: CategoryType; labelKey: Key }[] = [
  { type: "expense", labelKey: "categoryScreen.groupExpense" },
  { type: "income", labelKey: "categoryScreen.groupIncome" },
  { type: "savings", labelKey: "categoryScreen.groupSavings" },
  { type: "investment", labelKey: "categoryScreen.groupInvestment" },
];

/**
 * Every category at once, and the panel that opens inside it.
 *
 * Deliberately not `grid-auto-flow: dense`. The Bearing's grid needs dense
 * backfill because its tiles have different spans, and `bearing-grid.ts`
 * records what that cost: a full-width panel inserted mid-row made the tiles
 * after it flow into the gap, and the arithmetic written to avoid that
 * shipped wrong. These tiles are all one column, so ordinary flow puts the
 * panel on the next row by itself and nothing backfills. The gap left at the
 * end of the row above is honest: it shows where you opened.
 */
export function CategoryGrid({
  cards,
  openId,
  onOpen,
  panel,
  panelId,
}: CategoryGridProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map(({ type, labelKey }) => {
        const group = cards.filter((card) => card.history.type === type);
        if (group.length === 0) {
          return null;
        }
        return (
          <section key={type} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(labelKey)}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.map((card) => (
                <Fragment key={card.history.categoryId}>
                  <CategoryTile
                    card={card}
                    open={card.history.categoryId === openId}
                    onOpen={onOpen}
                    panelId={panelId}
                  />
                  {card.history.categoryId === openId ? (
                    <div className="col-span-full">{panel}</div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write the orchestrating `CategoryHistoryView.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CategoryFinding } from "@finance/core/category-findings";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { CategoryGrid } from "./CategoryGrid";
import type { CategoryCard } from "./CategoryTile";

interface CategoryHistoryViewProps {
  cards: CategoryCard[];
  findings: CategoryFinding[];
}

const PANEL_ID = "category-panel";

/**
 * The by-category screen: what moved, every run at once, and one open panel.
 *
 * Holds one piece of layout state — which category is open — and nothing
 * else. The two buttons that ask a model keep their own pending state, as
 * `MonthRead` does.
 */
export function CategoryHistoryView({
  cards,
  findings,
}: CategoryHistoryViewProps) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <Card className="block w-full">
        <Card.Header>
          <Card.Title>{t("categoryScreen.empty")}</Card.Title>
          <Card.Description>{t("categoryScreen.emptyBody")}</Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CategoryGrid
        cards={cards}
        openId={openId}
        onOpen={(id) => setOpenId((current) => (current === id ? null : id))}
        panel={null}
        panelId={PANEL_ID}
      />
    </div>
  );
}
```

`findings` is unused in this task and wired in Task 8. Prefix it with `_` only if the linter objects; otherwise leave it, because the next task fills it in.

- [ ] **Step 5: Delete the old view**

```bash
git rm apps/web/components/finance/CategoryHistoryView.tsx
```

- [ ] **Step 6: Typecheck and look at the screen**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS. `CategoryHistory.trend` still exists at this point and is simply unused; Task 6 removes it next, once this task has deleted its only reader.

Run: `pnpm dev:web` and open `/history`. Remember this box is WSL: bind and open by LAN address, not `localhost`.
Expected: every category visible as a tile, grouped, with a badge on the ones that have a finding. Clicking a tile highlights it and opens an empty row.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/'(app)'/history/page.tsx apps/web/components/finance/category/
git commit -m "Show every category at once, grouped, with its own twelve months"
```

---

### Task 8: The findings band

**Files:**
- Create: `apps/web/components/finance/category/FindingRow.tsx`
- Create: `apps/web/components/finance/category/FindingBand.tsx`
- Modify: `apps/web/components/finance/category/CategoryHistoryView.tsx`
- Modify: `apps/web/app/(app)/history/page.tsx`

**Interfaces:**
- Consumes: `CategoryFinding`; `SpendStrip` from `@/components/finance/charts`; `CategoryBreakdown` from `@finance/core/types/database`.
- Produces: `<FindingBand findings rows total onOpen openId panelId />`, `<FindingRow finding onOpen ... />`.

- [ ] **Step 1: Build the strip's rows on the server**

In `page.tsx`, after `cards`, add:

```tsx
  /** This month's expense composition, for the strip. `SpendStrip` sorts. */
  const latestKey = `${current.year}-${String(current.month).padStart(2, "0")}`;
  const breakdown = histories
    .filter((history) => history.type === "expense")
    .map((history) => ({
      categoryId: history.categoryId,
      name: history.name,
      total:
        history.points.find((point) => point.monthKey === latestKey)?.total ??
        0,
      icon: null,
    }))
    .filter((row) => row.total > 0);
  const breakdownTotal = breakdown.reduce((sum, row) => sum + row.total, 0);
```

Pass `breakdown={breakdown}` and `breakdownTotal={breakdownTotal}` to `CategoryHistoryView`. Check `CategoryBreakdown` in `packages/core/src/types/database.ts` and match its fields exactly — drop `icon` if it is not part of the type.

- [ ] **Step 2: Write `FindingRow.tsx`**

```tsx
"use client";

import type { CategoryFinding } from "@finance/core/category-findings";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { PrivateAmount } from "@/components/layout/PrivateAmount";

interface FindingRowProps {
  finding: CategoryFinding;
  open: boolean;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

/**
 * One finding: the category, what it did, and what that is worth.
 *
 * The sentence holds no amount. A figure inside prose cannot be blurred by
 * privacy mode and cannot follow the currency toggle — the same argument
 * `month-facts.ts` makes for placeholders — so the weight sits beside it in
 * an element of its own.
 *
 * `gone-quiet` and `every-year` are stated as a rate only when a rate is what
 * they mean; a one-off odd month is worth its distance from normal, once.
 */
export function FindingRow({
  finding,
  open,
  onOpen,
  panelId,
}: FindingRowProps) {
  const formatMoney = useFormatCurrency();
  const t = useT();
  const perMonth = finding.kind !== "odd-month";

  return (
    <button
      type="button"
      onClick={() => onOpen(finding.categoryId)}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        "flex w-full items-baseline gap-3 border-b border-border py-2.5",
        "text-left last:border-0 transition-colors hover:text-primary-ink",
      )}
    >
      <span className="shrink-0 text-sm font-medium">
        {finding.categoryName}
      </span>
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
        {t(finding.messageKey, finding.params)}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          finding.direction === "up" ? "text-destructive" : "text-success",
        )}
      >
        <PrivateAmount>
          {t(
            perMonth
              ? "categoryFindings.weightPerMonth"
              : "categoryFindings.weightOnce",
            { amount: formatMoney(finding.severity) },
          )}
        </PrivateAmount>
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Write `FindingBand.tsx`**

```tsx
"use client";

import type { CategoryFinding } from "@finance/core/category-findings";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { SpendStrip } from "@/components/finance/charts";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { FindingRow } from "./FindingRow";

/** The most rows worth reading before a list becomes a page. */
export const MAX_FINDINGS_SHOWN = 5;

interface FindingBandProps {
  findings: CategoryFinding[];
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  openId: string | null;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

export function FindingBand({
  findings,
  breakdown,
  breakdownTotal,
  openId,
  onOpen,
  panelId,
}: FindingBandProps) {
  const t = useT();
  const shown = findings.slice(0, MAX_FINDINGS_SHOWN);

  return (
    <Card className="block w-full">
      <Card.Header>
        <Card.Title>{t("categoryFindings.bandTitle")}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <SpendStrip rows={breakdown} total={breakdownTotal} />
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("categoryFindings.bandEmpty")}
          </p>
        ) : (
          <div className="flex flex-col">
            {shown.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                open={finding.categoryId === openId}
                onOpen={onOpen}
                panelId={panelId}
              />
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
```

- [ ] **Step 4: Render the band above the grid**

In `CategoryHistoryView.tsx`, accept `breakdown` and `breakdownTotal`, and put `<FindingBand ... />` above `<CategoryGrid ... />` inside the existing flex column.

- [ ] **Step 5: Typecheck and look**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

Open `/history`.
Expected: a composition strip, up to five sentences under it, each with a figure on the right; pressing one highlights that tile in the grid below.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/finance/category/ apps/web/app/'(app)'/history/page.tsx
git commit -m "Say what moved, above the grid, in sentences with no figures in them"
```

---

### Task 9: The panel

**Files:**
- Create: `apps/web/components/finance/category/CategoryPanel.tsx`
- Modify: `apps/web/components/finance/category/CategoryHistoryView.tsx`
- Modify: `apps/web/app/(app)/history/page.tsx`

**Interfaces:**
- Consumes: `BarSeries` from `@/components/finance/charts`; `CategoryCard`; `CategoryFinding`.
- Produces: `<CategoryPanel card behind={PanelTransaction[]} onClose />` and `interface PanelTransaction { id: string; occurredOn: string; note: string | null; amount: number }`.

- [ ] **Step 1: Pass the transactions behind each flagged month from the server**

In `page.tsx`, build a map from category id to the transactions of the month its findings point at — the latest month when they point at none:

```tsx
  const rows = (data ?? []) as TransactionWithCategory[];

  /** The month a category's panel explains, and the entries inside it. */
  const behind = new Map<string, TransactionWithCategory[]>();
  for (const card of cards) {
    const target =
      card.findings[0]?.months[card.findings[0].months.length - 1] ??
      card.drawn[card.drawn.length - 1]?.monthKey;
    if (!target) {
      continue;
    }
    behind.set(
      card.history.categoryId,
      rows
        .filter(
          (row) =>
            row.category_id === card.history.categoryId &&
            row.occurred_on.startsWith(target),
        )
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 5),
    );
  }

  /**
   * A `Map` does not cross the server-component boundary, and neither does a
   * database row shape the panel has no use for. Both are flattened here.
   */
  const behindByCategory = Object.fromEntries(
    [...behind].map(([categoryId, entries]) => [
      categoryId,
      entries.map((entry) => ({
        id: entry.id,
        occurredOn: entry.occurred_on,
        note: entry.note,
        amount: Number(entry.amount),
      })),
    ]),
  );
```

Pass `behind={behindByCategory}` to `CategoryHistoryView`, along with a `behindMonthLabel` map built from the same target months through `formatMonthLabel`.

- [ ] **Step 2: Write `CategoryPanel.tsx`**

```tsx
"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { BarSeries } from "@/components/finance/charts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { TONE, type CategoryCard } from "./CategoryTile";

export interface PanelTransaction {
  id: string;
  occurredOn: string;
  note: string | null;
  amount: number;
}

interface CategoryPanelProps {
  card: CategoryCard;
  behind: PanelTransaction[];
  behindMonthLabel: string;
  onClose: () => void;
  id: string;
}

/**
 * One category, opened in place.
 *
 * Holds every finding for this category rather than only the one that reached
 * the band, because the band is a shortlist and this is the whole answer.
 */
export function CategoryPanel({
  card,
  behind,
  behindMonthLabel,
  onClose,
  id,
}: CategoryPanelProps) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const { history, normal, drawn, findings } = card;

  return (
    <section
      id={id}
      className={cn(
        "mt-2 flex flex-col gap-4 rounded-2xl border border-primary-rim p-4",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold">{history.name}</h3>
          <p className="text-sm text-muted-foreground">
            {t(
              history.periodShifted
                ? "categoryScreen.normalShifted"
                : "categoryScreen.normal",
              { amount: formatMoney(normal) },
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("categoryScreen.close")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X size={ICON.sm} />
        </button>
      </header>

      {findings.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {findings.map((finding) => (
            <li key={finding.id} className="text-sm text-muted-foreground">
              {t(finding.messageKey, finding.params)}
            </li>
          ))}
        </ul>
      ) : null}

      {history.periodShifted ? (
        <p className="text-xs text-muted-foreground">
          {t("categoryScreen.periodShifted")}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("categoryScreen.months", { count: drawn.length })}
      </p>

      <BarSeries
        color={TONE[history.type] ?? "var(--chart-1)"}
        points={drawn.map((point) => ({
          key: point.monthKey,
          label: point.shortLabel,
          value: point.total,
          empty: point.empty,
        }))}
      />

      {behind.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("categoryScreen.behindThisMonth", { month: behindMonthLabel })}
          </h4>
          <ul className="flex flex-col">
            {behind.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0"
              >
                <span className="min-w-0 truncate">
                  {entry.note ?? entry.occurredOn}
                </span>
                <span className="shrink-0 tabular-nums">
                  <PrivateAmount>{formatMoney(entry.amount)}</PrivateAmount>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link
        href={`/transactions?category=${history.categoryId}`}
        className="text-sm font-medium text-primary-ink hover:underline"
      >
        {t("categoryScreen.seeInLedger")}
      </Link>
    </section>
  );
}
```

Before writing the `Link`, check how `/transactions` reads its filters and use the parameter name it actually accepts. If it has none, link to `/transactions` plain rather than inventing a parameter the page ignores.

- [ ] **Step 3: Wire the panel into the view**

In `CategoryHistoryView.tsx`, build the panel for the open card and pass it into `CategoryGrid`'s `panel` prop, replacing the `null` from Task 7.

- [ ] **Step 4: Honour a reader who has asked for less motion**

The panel's opening is the only animation on this screen, and it must not play for somebody who has turned motion down. In `CategoryPanel.tsx`:

```tsx
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
```

and inside the component:

```tsx
  const reducedMotion = usePrefersReducedMotion();
```

then on the `<section>`'s `className`, add:

```tsx
        !reducedMotion && "motion-safe:animate-in motion-safe:fade-in",
```

Verify by setting the OS preference to "reduce motion" and reopening a tile: the panel must appear with no transition rather than a faster one.

- [ ] **Step 5: Typecheck and look**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

Open `/history`, press a tile, then press a finding row.
Expected: the panel opens on the row below the tile, the tiles after it flow on rather than jumping into the gap, and the page does not scroll to the top.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/finance/category/ apps/web/app/'(app)'/history/page.tsx
git commit -m "Open a category in place, with the months and the entries behind them"
```

---

### Task 10: The two tables

**Files:**
- Create: `supabase/migrations/035_category_findings.sql`
- Modify: `packages/core/src/types/database.ts`

**Interfaces:**
- Produces: tables `category_reads`, `category_read_tallies` and `category_selections`; functions `reserve_category_read`, `store_category_read`, `refund_category_read`, `reserve_category_selection`, `store_category_selection`; types `CategoryReadRow`, `CategoryReadTallyRow`, `CategorySelectionRow` on `Database`.

**Divergence from the spec, deliberate.** The spec's table lists two tables. There are three, because the spec also says the allowance is one for all the reads on the screen rather than five per category — and an allowance counted across categories cannot live in a table keyed by category. `category_read_tallies` is where "how many times this month" is counted. Nothing else about the spec changes; update the spec's table when this lands.

- [ ] **Step 1: Write the migration**

Model it line for line on `024_month_reads.sql` and `029_bearing.sql`. The shape:

```sql
-- One written read per category, and one model-chosen order per user.
--
-- Same argument as 024: the prose holds figure placeholders and never
-- figures, because the display currency is a browser preference no server
-- knows and privacy mode blurs one element at a time. And the same argument
-- as 029 for the tally: a counter a client may UPDATE is a counter a client
-- may set back to zero, and a serverless function holds no memory between
-- invocations to keep it in.
--
-- Two tables rather than one, because the two calls cost differently and
-- fail differently. A month spent reading categories must not leave the band
-- at the top unable to reorder itself.

create table category_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,

  writes smallint not null default 0 check (writes >= 0),
  refused smallint not null default 0 check (refused >= 0),
  last_written_at timestamptz,
  pending_since timestamptz,

  read jsonb,
  facts jsonb,
  facts_digest text,
  trimmed smallint not null default 0 check (trimmed >= 0),
  model text,
  prompt_version smallint,
  written_at timestamptz,
  -- Here from the first migration rather than added later: 028 already paid
  -- for leaving it out of month_reads.
  locale text,

  primary key (user_id, category_id)
);

-- The allowance is for the screen, not for each category. Twenty categories
-- at five writes each is a hundred calls inside the ceiling, which is not a
-- ceiling — so the tally is counted across the table, per calendar month.
create table category_read_tallies (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  writes smallint not null default 0 check (writes >= 0),
  primary key (user_id, month)
);

create table category_selections (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- The chosen finding ids in order, with an optional remark each.
  selection jsonb,
  -- The digest of the findings it was chosen from. When this stops matching,
  -- the app's own order leads again rather than a stale ranking claiming to
  -- describe figures that have changed.
  findings_digest text,

  -- The tally carries the month it belongs to and resets when the month
  -- turns, in the same statement that takes the reservation, so nothing has
  -- to remember to do it. 029's reserve_bearing_arrangement does this.
  tally_month date,
  writes smallint not null default 0 check (writes >= 0),
  refused smallint not null default 0 check (refused >= 0),
  last_written_at timestamptz,
  pending_since timestamptz,
  model text,
  prompt_version smallint,
  written_at timestamptz
);

alter table category_reads enable row level security;
alter table category_read_tallies enable row level security;
alter table category_selections enable row level security;

create policy "category_reads_select_own"
  on category_reads for select using (auth.uid() = user_id);
create policy "category_read_tallies_select_own"
  on category_read_tallies for select using (auth.uid() = user_id);
create policy "category_selections_select_own"
  on category_selections for select using (auth.uid() = user_id);
```

Then the five functions. Each is `language plpgsql security definer set search_path = public`, each opens with

```sql
  if not acting_for(target_user) then
    raise exception '<function name>: not permitted for that user';
  end if;
```

and each is followed immediately by

```sql
revoke all on function <name>(<signature>) from public;
grant execute on function <name>(<signature>) to authenticated, service_role;
```

`reserve_category_read(target_user uuid, target_category uuid, allowance smallint, cooldown_seconds int, reservation_seconds int)` takes the reservation in one statement so two simultaneous presses serialise — copy the `insert ... on conflict do update ... where` body of `reserve_month_read`, with the allowance checked against `category_read_tallies` for the current month rather than against the row's own `writes`, and the tally bumped in the same statement.

`store_category_read(...)` and `refund_category_read(...)` mirror `store_month_read` and `refund_month_read` exactly, with `locale` added to the stored columns and the tally decremented on refund.

`reserve_category_selection(target_user uuid, allowance smallint, cooldown_seconds int, reservation_seconds int)` and `store_category_selection(target_user uuid, new_selection jsonb, new_digest text, new_model text, new_prompt_version smallint, refused_delta smallint)` mirror 029's pair, resetting `writes` to zero when `tally_month` is not the current month.

- [ ] **Step 2: Add the row types**

In `packages/core/src/types/database.ts`, follow however `MonthReadRow` is declared and add `CategoryReadRow`, `CategoryReadTallyRow` and `CategorySelectionRow`, plus the three tables on the `Database` interface with their `Row`, `Insert` and `Update` shapes.

- [ ] **Step 3: Apply and verify**

Run: `supabase db reset` (or the project's usual migration command — check `README.md`).
Expected: the migration applies with no error.

Verify the grant was actually removed:

```sql
select proname, proacl from pg_proc where proname like 'reserve_category%';
```
Expected: no `=X/` entry for PUBLIC.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @finance/core exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/035_category_findings.sql packages/core/src/types/database.ts
git commit -m "Store a category read and a model-chosen order, each capped separately"
```

---

### Task 11: The category read

**Files:**
- Create: `packages/core/src/category-facts.ts`
- Create: `packages/core/src/category-read.ts`
- Create: `packages/core/src/category-read.test.ts`
- Create: `packages/core/src/category-read-prompt.ts`
- Create: `apps/web/lib/category-read/{facts,store,write,client,source}.ts`
- Create: `apps/web/lib/actions/category-read.ts`
- Create: `apps/web/components/finance/category/CategoryRead.tsx`
- Modify: `packages/core/package.json`, `apps/web/components/finance/category/CategoryPanel.tsx`

**Interfaces:**
- Consumes: `factLines` from `./month-read-prompt`; `MonthFact`, `MissingFact`, `FactPack`, `formatFact`, `factsDigest` from `./month-facts`; `verifyMonthRead`'s structure as the model for `verifyCategoryRead`.
- Produces:
  - `function buildCategoryFacts(input: CategoryFactsInput): CategoryFacts`
  - `function verifyCategoryRead(raw, facts, locale): CategoryReadVerdict`
  - `function renderCategoryRead(read, facts, formatMoney, locale): RenderedRead`
  - `const CATEGORY_READ_PROMPT_VERSION = 1`
  - `CATEGORY_READ_WRITES_PER_MONTH = 10`

- [ ] **Step 1: Write `category-facts.ts`**

The two types the rest of the task is written against:

```ts
export interface CategoryFactsInput {
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  /** The median month. */
  normal: number;
  /** The month on screen, or null when nothing was recorded in it. */
  latest: number | null;
  monthsActive: number;
  /** "September 2026", already formatted by the caller in the read's locale. */
  monthLabel: string;
  /** Signed: positive is up. Null when there is no drift finding. */
  drift: number | null;
  /** Distance from normal, signed. Null when there is no odd month. */
  oddMonth: number | null;
  /** This category's share of the month's expenses, 0 to 1. */
  shareOfMonth: number | null;
  /** The category's cap, or null when it has none. */
  cap: number | null;
}

export interface CategoryFacts extends FactPack {
  categoryId: string;
  categoryName: string;
  monthLabel: string;
  /** Too little recorded to be worth a read; the writer is not asked. */
  thin: boolean;
}
```

`CategoryFacts` extends `FactPack` rather than paralleling it, so `factLines` accepts it unchanged. The datums, each with `id`, `label`, `unit`, `value`, `sense`:

| id | what | unit | sense |
| --- | --- | --- | --- |
| `normal` | the median month | money | neutral |
| `latest` | the month on screen | money | up-is-bad for expense, up-is-good for income and savings |
| `drift` | the size of the drift, when there is one | money | as above |
| `odd-month` | the flagged month's distance from normal | money | as above |
| `months-active` | non-empty months in the window | count | neutral |
| `share-of-month` | this category's share of the month's expenses | percent | up-is-bad |
| `cap` | the category's budget cap, through `budget-limits.ts` | money | neutral |

Absent values become `MissingFact` with a reason — `no-cap` where there is no cap, `not-recorded` where the month is empty. Never a zero: "you spent 0 € on groceries" from a user who simply has not recorded any is the exact failure `month-facts.ts` exists to avoid.

- [ ] **Step 2: Write the failing tests for verification**

`packages/core/src/category-read.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { verifyCategoryRead } from "./category-read";
import { buildCategoryFacts } from "./category-facts";

const facts = buildCategoryFacts({
  categoryId: "cat-groceries",
  categoryName: "Groceries",
  type: "expense",
  normal: 412,
  latest: 486,
  monthsActive: 12,
  monthLabel: "September 2026",
  drift: 74,
  oddMonth: null,
  shareOfMonth: 0.19,
  cap: null,
});

function answer(overrides: Record<string, unknown> = {}) {
  return {
    observations: [
      {
        text: "Groceries have climbed steadily, to {{fact:latest}}.",
        basis: ["latest"],
        tone: "watch",
      },
    ],
    suggestions: [],
    ...overrides,
  };
}

describe("verifyCategoryRead", () => {
  it("accepts a claim whose every figure is a placeholder", () => {
    const verdict = verifyCategoryRead(answer(), facts);

    expect(verdict.ok).toBe(true);
  });

  it("refuses a read that writes a figure of its own", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "Groceries have climbed to 486 euros.",
            basis: ["latest"],
            tone: "watch",
          },
        ],
      }),
      facts,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("invented-figure");
  });

  it("refuses a read resting on a datum it was never sent", () => {
    const verdict = verifyCategoryRead(
      answer({
        observations: [
          {
            text: "Well under {{fact:unrecorded-allowance}}.",
            basis: ["unrecorded-allowance"],
            tone: "good",
          },
        ],
      }),
      facts,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("unknown-datum");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-read.test.ts`
Expected: FAIL — `Failed to resolve import "./category-read"`.

- [ ] **Step 4: Write `category-read.ts`**

The shape, so later steps and the store agree on it:

```ts
export interface CategoryRead {
  observations: { text: string; basis: string[]; tone: ClaimTone }[];
  suggestions: { text: string; basis: string[]; effort: SuggestionEffort }[];
}

export type CategoryReadVerdict =
  | { ok: true; read: CategoryRead; trimmed: TrimmedClaim[] }
  | { ok: false; reason: MonthReadRefusal; detail: string };

export const MAX_CATEGORY_OBSERVATIONS = 2;
export const MAX_CATEGORY_SUGGESTIONS = 2;
export const CATEGORY_READ_WRITES_PER_MONTH = 10;
export const CATEGORY_READ_COOLDOWN_SECONDS = 60;
export const CATEGORY_READ_RESERVATION_SECONDS = 120;
```

`ClaimTone`, `SuggestionEffort`, `TrimmedClaim` and `MonthReadRefusal` are imported from `./month-read`, not redeclared — the refusal reasons are the same reasons and a second enum would drift.

Mirror `month-read.ts`, dropping what a single category does not need: **no headline** (the panel already carries the category's name), at most two observations and two suggestions, `MAX_CLAIM_LENGTH` reused as it stands. Reuse `visibleLength`, `citedIds` and `writesAFigure` by importing them from `./month-read` rather than copying them — they are already exported, and two copies of the digit rule is two rules to keep in step.

`verifyCategoryRead` returns the same `{ ok: true; read; trimmed } | { ok: false; reason; detail }` shape, with the same fatal/trim split: an invented figure or an unknown datum is fatal, an over-long claim is trimmed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/category-read.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write `category-read-prompt.ts`**

`CATEGORY_READ_PROMPT_VERSION = 1`. Reuse `factLines()` from `./month-read-prompt` — it is already exported widened past `MonthFacts` precisely so a second prompt can use it, and this is the third caller.

Carry the figure rule and the naming rule in both positions, first and last, as `month-read-prompt.ts` does and for the reason its comment gives: instruction adherence decays across a long system message, and position is doing more work than wording. Carry the same `CONTEXT.md` vocabulary block, extended with one line: a normal is a normal, and nothing here is an "anomaly" or an "alert".

- [ ] **Step 7: Write the web plumbing**

Copy the five files under `apps/web/lib/month-read/` into `apps/web/lib/category-read/` and adapt: `client.ts` reuses the same Mistral configuration, `source.ts` is two lines, `facts.ts` gathers one category's figures, `store.ts` calls the three `category_read` functions and keeps the `isMissingSchema` tolerance verbatim, `write.ts` follows the same order of operations and returns `{ written, message, writesLeft }`.

`apps/web/lib/actions/category-read.ts` mirrors `lib/actions/month-read.ts`, revalidating `/history` rather than `/bearing`.

- [ ] **Step 8: Write `CategoryRead.tsx` and put it in the panel**

Mirror `components/finance/MonthRead.tsx`: the `Sparkle` heading that says plainly a model wrote this, the write button with its remaining-writes count, the `useTransition` pending state, the "written in another language" notice, and `renderCategoryRead` against the *current* facts so a figure here can never contradict the bars above it. Render it at the bottom of `CategoryPanel`.

- [ ] **Step 9: Add the three modules to the exports map**

```json
    "./category-facts": "./src/category-facts.ts",
    "./category-read": "./src/category-read.ts",
    "./category-read-prompt": "./src/category-read-prompt.ts",
```

- [ ] **Step 10: Run everything**

Run: `pnpm --filter @finance/core test && pnpm --filter web exec tsc --noEmit`
Expected: PASS.

Open `/history`, open a category, press the write button.
Expected: with no model key, the button is absent and nothing is broken. With one, a paragraph appears whose figures match the bars.

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/category-facts.ts packages/core/src/category-read.ts packages/core/src/category-read.test.ts packages/core/src/category-read-prompt.ts packages/core/package.json apps/web/lib/category-read/ apps/web/lib/actions/category-read.ts apps/web/components/finance/category/
git commit -m "Write a read for one category, with the app's figures and the model's words"
```

---

### Task 12: The model's order

**Files:**
- Create: `packages/core/src/category-selection.ts`
- Create: `packages/core/src/category-selection.test.ts`
- Create: `packages/core/src/category-selection-prompt.ts`
- Modify: `apps/web/lib/actions/category-read.ts`, `FindingBand.tsx`, `page.tsx`, `packages/core/package.json`

**Interfaces:**
- Produces:
  - `function findingsDigest(findings: readonly CategoryFinding[]): string`
  - `function verifyCategorySelection(raw: unknown, findings: readonly CategoryFinding[]): CategorySelectionVerdict`
  - `function applySelection(findings, selection): CategoryFinding[]`
  - `const CATEGORY_SELECTION_PROMPT_VERSION = 1`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import {
  applySelection,
  verifyCategorySelection,
} from "./category-selection";
import type { CategoryFinding } from "./category-findings";

const findings: CategoryFinding[] = [
  {
    id: "drift:a",
    kind: "drift",
    categoryId: "a",
    categoryName: "Rent",
    type: "expense",
    severity: 300,
    direction: "up",
    months: ["2026-09"],
    messageKey: "categoryFindings.driftUp",
    params: { months: 3 },
  },
  {
    id: "drift:b",
    kind: "drift",
    categoryId: "b",
    categoryName: "Restaurants",
    type: "expense",
    severity: 30,
    direction: "up",
    months: ["2026-09"],
    messageKey: "categoryFindings.driftUp",
    params: { months: 3 },
  },
];

describe("verifyCategorySelection", () => {
  it("keeps the order the model asked for", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:b" }, { id: "drift:a" }] },
      findings,
    );

    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.selection.picks.map((p) => p.id)).toEqual([
      "drift:b",
      "drift:a",
    ]);
  });

  it("drops an id it was never given, and keeps the rest", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:invented" }, { id: "drift:a" }] },
      findings,
    );

    expect(verdict.ok && verdict.selection.picks.map((p) => p.id)).toEqual([
      "drift:a",
    ]);
  });

  it("drops a remark with a figure in it and keeps the pick", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "drift:a", remark: "up by 300 a month" }] },
      findings,
    );

    const pick = verdict.ok ? verdict.selection.picks[0] : null;
    expect(pick?.id).toBe("drift:a");
    expect(pick?.remark).toBeUndefined();
    expect(verdict.ok && verdict.trimmed).toBe(1);
  });

  it("refuses an answer with no usable pick at all", () => {
    const verdict = verifyCategorySelection(
      { picks: [{ id: "nope" }] },
      findings,
    );

    expect(verdict.ok).toBe(false);
  });
});

describe("applySelection", () => {
  it("puts the chosen findings first and leaves the rest behind them", () => {
    const ordered = applySelection(findings, {
      picks: [{ id: "drift:b" }],
    });

    expect(ordered.map((f) => f.id)).toEqual(["drift:b", "drift:a"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @finance/core exec vitest run src/category-selection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `category-selection.ts`**

The remark rule, stated in the module comment: a remark may contain no figure at all, because the figure is already in the element beside it and what this call buys is the judgement, not the arithmetic. Detect a figure with `writesAFigure` imported from `./month-read` — the same digit-and-quantity-word net, not a second one. A remark that trips it is dropped and counted in `trimmed`; the pick survives. An answer with no surviving pick is `{ ok: false }` and the app's order leads.

`findingsDigest` hashes the findings' ids and severities the way `factsDigest` hashes a pack, so a selection can tell whether the figures under it have moved.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @finance/core exec vitest run src/category-selection.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the prompt, the action and the button**

`category-selection-prompt.ts` hands over the full finding list — id, species, category, direction, weight — and asks for up to five ids in order with an optional remark each. It states the closed-catalogue rule the way `wallet-read-prompt.ts` does: name only what you were given.

Add `rerankFindingsAction` to `apps/web/lib/actions/category-read.ts`, going through `reserve_category_selection` / `store_category_selection` and revalidating `/history`.

In `FindingBand`, add the button labelled `categoryFindings.rerank`, and when a stored selection exists whose digest matches, order the rows with `applySelection` and show `categoryFindings.reranked`. When it exists and the digest does not match, ignore it and show `categoryFindings.rerankStale`.

- [ ] **Step 6: Run everything and check the fallback**

Run: `pnpm --filter @finance/core test && pnpm --filter web exec tsc --noEmit`
Expected: PASS.

Run: `pnpm check:reachability`
Expected: PASS — every key added in Task 1 now has a user, and no export is dead.

With the model key removed from the environment, open `/history`.
Expected: the findings are ordered by weight, the re-rank button is absent, and nothing on the page is broken.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/category-selection.ts packages/core/src/category-selection.test.ts packages/core/src/category-selection-prompt.ts packages/core/package.json apps/web/
git commit -m "Let a model choose which findings lead, and fall back to weight"
```

---

## Verification before calling this done

- [ ] `pnpm --filter @finance/core test` — green.
- [ ] `pnpm --filter web exec tsc --noEmit` — green.
- [ ] `pnpm check:reachability` — green, which proves no orphaned message key and no dead export.
- [ ] `/history` with no model key configured: findings ordered by weight, no model buttons, no broken UI.
- [ ] `/history` with migration 035 not applied: the page renders, and the model buttons are absent rather than throwing.
- [ ] Privacy mode on: every amount on the screen blurs, including the weights beside the findings and the amount in the panel's entries.
- [ ] Currency toggled to something other than euro: every amount follows, including inside the category read's prose.
- [ ] A phone-width viewport: two tile columns, the panel full width, no horizontal scroll.
