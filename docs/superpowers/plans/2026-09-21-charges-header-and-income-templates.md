# Charges header and income templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a salary be a recurring template, and turn the Charges page's single "Committed every month" figure into three aligned figures — Income, Committed every month, What's left — so the forward projection stops telling people to do something the form forbids.

**Architecture:** The projection engine already reads income templates (`projection.ts` counts `incomeCharges` and renders an `income` ingredient whose edit link points at `/recurring`). Only the form blocks creating them. So this is mostly subtraction: remove an exclusion, then make the monthly rollups type-aware so a salary does not land inside a figure named "Committed". The three-part header is presentation over figures the engine already produces.

**Tech Stack:** TypeScript, Next.js 16 App Router (`apps/web`), Expo/React Native (`apps/mobile`), shared domain logic in `packages/core`, vitest, Tailwind v4 with tokens in `apps/web/app/globals.css`.

**Spec:** No separate spec document. The requirements are the three decisions recorded below under Decisions, plus the constraints in `apps/web/PRODUCT.md`, `apps/web/DESIGN.md` and `CONTEXT.md`.

## Decisions already taken

1. **Income comes from recurring templates.** Not an average of past salaries, not a typed-in figure. A salary becomes a template like rent, so it obeys start and end dates, skips, and amount changes, and the existing engine reads it with no new plumbing.
2. **What's left = Income − Committed.** Strictly the two figures beside it, so the row reads as one checkable sentence. Unrecorded spending is *not* folded in.
3. **Plan only.** No code is written from this document until it has been reviewed.

## Global Constraints

- **Every user-facing string goes through the `en`/`fr` catalogues** in `packages/core/src/i18n/messages/`. `fr.ts` is typed as `typeof en`, so a missing French key is a compile error. `aria-label`, `title` and `placeholder` included.
- **WCAG 2.1 AA is a hard requirement.** Contrast, focus order, target size and reduced-motion failures block. Body text ≥ 4.5:1.
- **Every rendered money figure must carry the privacy blur** — `PrivateAmount`, `.privacy-amount` or `.privacy-sensitive`. `DESIGN.md` calls it a first-class state of the design system.
- **The Semantic Amount Rule:** an amount's colour says what *kind* of money it is (income / expense / savings / investment), never whether it is positive or negative, and never good or bad. Direction is carried by a sign, via `components/finance/amount-sign.ts`.
- **The Rare Accent Rule:** Lamplit Gold has exactly four homes — the primary action, the focus ring, a figure that leads a screen, and a savings amount. Adding a fifth means changing the rule's paragraph in `DESIGN.md` first.
- **CONTEXT.md governs vocabulary.** The domain word is **recurring template**, never "rule" or "subscription". Income arriving on a schedule is still a recurring template. Do not introduce the word "salary" as a domain term — it is an example of an income template, not a concept.
- **Tokens only.** No hard-coded hex, no alpha literal where a token exists, no arbitrary `duration-[…]`.
- Run `npx prettier --write` on changed files and re-run `tsc` after.

## The hazard this plan exists to avoid

`estimateMonthlyAmount(template)` in `packages/core/src/recurrence.ts:123` takes only the recurrence and the amount. **It is type-blind.** Both clients roll templates up with it while filtering on `counts_toward_summary` alone:

- `apps/web/components/finance/RecurringView.tsx:292-298`
- `apps/mobile/src/app/(tabs)/recurring.tsx:122`

Unblocking income templates without fixing those reducers would add a salary *into* the figure labelled "Committed every month" on both clients. Task 1 exists to make that impossible before Task 2 makes it reachable. **Do not reorder these tasks.**

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/recurring-rollup.ts` | **Create.** One type-aware monthly rollup, used by both clients. The single place that decides what "committed" and "income" mean. |
| `packages/core/src/recurring-rollup.test.ts` | **Create.** Proves the split, including the regression this plan prevents. |
| `apps/web/components/finance/RecurringForm.tsx` | **Modify.** Stop excluding income categories. |
| `apps/web/components/finance/RecurringView.tsx` | **Modify.** Three-part header; consume the rollup. |
| `apps/mobile/src/app/(tabs)/recurring.tsx` | **Modify.** Consume the rollup so the phone's figure does not silently gain the salary. |
| `packages/core/src/i18n/messages/en.ts`, `fr.ts` | **Modify.** Three header labels plus the empty-income line. |

---

### Task 1: A type-aware monthly rollup in core

**Files:**
- Create: `packages/core/src/recurring-rollup.ts`
- Create: `packages/core/src/recurring-rollup.test.ts`

**Interfaces:**
- Consumes: `estimateMonthlyAmount` from `./recurrence`, `RecurringTemplateWithCategory` from `./types/database`.
- Produces: `interface RecurringRollup { income: number; committed: number; setAside: number; deployed: number; left: number }` and `export function rollUpRecurring(templates: RecurringTemplateWithCategory[], year?: number, month?: number): RecurringRollup`. Tasks 3 and 4 both call this.

**Definitions, fixed here so the two clients cannot disagree:**
- `income` — active templates whose category type is `income` and which count toward the summary.
- `committed` — active templates whose category type is `expense` and which count toward the summary. Savings and investments are excluded on purpose: `buildRunway`'s doc already states that committed means recurring expenses only, "not savings or investment contributions, which a person under pressure would stop making".
- `setAside` — active `savings` and `investment` templates that count toward the summary.
- `deployed` — active templates with `counts_toward_summary === false`, whatever their type. This is the existing `deploymentMonthly`.
- `left` — `income − committed`. Decision 2. Nothing else is subtracted.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { rollUpRecurring } from "./recurring-rollup";
import type { RecurringTemplateWithCategory } from "./types/database";

function template({
  id,
  amount,
  type = "expense",
  counts = true,
  active = true,
}: {
  id: string;
  amount: number;
  type?: RecurringTemplateWithCategory["categories"]["type"];
  counts?: boolean;
  active?: boolean;
}): RecurringTemplateWithCategory {
  return {
    id,
    amount,
    active,
    recurrence: "monthly",
    day_of_month: 1,
    day_of_week: null,
    month_of_year: null,
    categories: {
      name: type,
      type,
      icon: null,
      counts_toward_summary: counts,
    },
  } as unknown as RecurringTemplateWithCategory;
}

describe("rollUpRecurring", () => {
  it("keeps income out of committed", () => {
    // The regression this module exists to prevent: before income templates
    // could be created, every counting template was summed into one figure
    // labelled "Committed every month". A salary landing in that sum would
    // have read as an outgoing.
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
    ]);

    expect(rollup.income).toBe(3200);
    expect(rollup.committed).toBe(1150);
  });

  it("leaves what income does not commit", () => {
    const rollup = rollUpRecurring([
      template({ id: "salary", amount: 3200, type: "income" }),
      template({ id: "rent", amount: 1150 }),
      template({ id: "power", amount: 90 }),
    ]);

    expect(rollup.left).toBe(1960);
  });

  it("counts savings and investments as set aside, not committed", () => {
    // buildRunway's own doc: committed is recurring expenses only, because a
    // person under pressure stops contributing before they stop paying rent.
    const rollup = rollUpRecurring([
      template({ id: "rent", amount: 1150 }),
      template({ id: "fund", amount: 200, type: "savings" }),
      template({ id: "etf", amount: 150, type: "investment" }),
    ]);

    expect(rollup.committed).toBe(1150);
    expect(rollup.setAside).toBe(350);
  });

  it("keeps a broker transfer out of every summary figure", () => {
    const rollup = rollUpRecurring([
      template({ id: "rent", amount: 1150 }),
      template({
        id: "transfer",
        amount: 500,
        type: "investment",
        counts: false,
      }),
    ]);

    expect(rollup.deployed).toBe(500);
    expect(rollup.setAside).toBe(0);
    expect(rollup.committed).toBe(1150);
  });

  it("ignores a deactivated template", () => {
    const rollup = rollUpRecurring([
      template({ id: "old", amount: 800, type: "income", active: false }),
      template({ id: "rent", amount: 1150 }),
    ]);

    expect(rollup.income).toBe(0);
    expect(rollup.left).toBe(-1150);
  });
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `cd packages/core && npx vitest run src/recurring-rollup`
Expected: FAIL — `Failed to resolve import "./recurring-rollup"`.

- [x] **Step 3: Write the implementation**

```ts
import { estimateMonthlyAmount } from "./recurrence";
import type { RecurringTemplateWithCategory } from "./types/database";

/**
 * What the standing instructions add up to in a month, split by what kind of
 * money each one is.
 *
 * One module because both clients need the same answer and `estimateMonthlyAmount`
 * cannot give it: that function knows a template's rhythm and its amount and
 * nothing about its category, so every caller that wanted a total had to do its
 * own filtering. Both did, both filtered on `counts_toward_summary` alone, and
 * both would therefore have added a salary into a figure labelled "Committed
 * every month" the moment income templates became creatable.
 *
 * `committed` is expenses only. `buildRunway` already draws that line and says
 * why: savings and investment contributions are what a person under pressure
 * stops first, so counting them as committed overstates what a month actually
 * demands.
 */
export interface RecurringRollup {
  /** Income templates, per month. */
  income: number;
  /** Recurring expenses, per month. Not savings, not investments. */
  committed: number;
  /** Savings and investment contributions, per month. */
  setAside: number;
  /** Templates the summary does not count — a transfer into a broker. */
  deployed: number;
  /** What income does not commit: `income - committed`. */
  left: number;
}

export function rollUpRecurring(
  templates: RecurringTemplateWithCategory[],
  year?: number,
  month?: number,
): RecurringRollup {
  let income = 0;
  let committed = 0;
  let setAside = 0;
  let deployed = 0;

  for (const template of templates) {
    if (!template.active) {
      continue;
    }

    const monthly = estimateMonthlyAmount(template, year, month);

    if (template.categories.counts_toward_summary === false) {
      deployed += monthly;
      continue;
    }

    switch (template.categories.type) {
      case "income":
        income += monthly;
        break;
      case "expense":
        committed += monthly;
        break;
      default:
        setAside += monthly;
    }
  }

  return { income, committed, setAside, deployed, left: income - committed };
}
```

- [x] **Step 4: Run the test and watch it pass**

Run: `cd packages/core && npx vitest run src/recurring-rollup`
Expected: PASS, 5 tests.

- [x] **Step 5: Run the whole core suite, to be sure nothing else read these shapes**

Run: `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected: all green.

- [x] **Step 6: Commit**

```bash
git add packages/core/src/recurring-rollup.ts packages/core/src/recurring-rollup.test.ts
git commit -m "Split the monthly rollup by what kind of money it is"
```

---

### Task 2: Let a salary be a recurring template

**Files:**
- Modify: `apps/web/components/finance/RecurringForm.tsx:136` and `:213`

**Interfaces:**
- Consumes: `CategorySelect`'s existing `excludeTypes?: CategoryType[]` prop (`apps/web/components/finance/CategorySelect.tsx:19`). Passing nothing shows every type.
- Produces: nothing new. Income templates begin to exist in the database; `projection.ts:416` already handles them.

**Context for the implementer:** `apps/web/lib/bank/client.ts` is irrelevant here. The only thing standing between a user and an income template is these two lines. `projection.ts` has counted `incomeCharges` since before this plan, and `ProjectionCard`'s `INGREDIENT_HREF.income` already points at `/recurring`.

- [x] **Step 1: Read the surrounding code before editing**

Read `apps/web/components/finance/RecurringForm.tsx:125-220`. Note that `allocCategories` at `:136` is used for the deployment-category check below it, and confirm whether that check needs the income entries present or absent. Write down the answer in the commit message.

- [x] **Step 2: Remove the exclusion from the picker**

At `:213`, delete the `excludeTypes={["income"]}` prop so the select offers every category type.

- [x] **Step 3: Decide `allocCategories` deliberately**

At `:136`, `const allocCategories = categories.filter((c) => c.type !== "income");` feeds `selectedCategory`, which drives `isDeploymentCategory`. An income category can never be a deployment category, so the filter is harmless — but it now means `selectedCategory` is `undefined` whenever an income category is chosen, which would silently disable any behaviour keyed off it. Change it to `categories` and let `isDeploymentCategory` narrow on `type === "investment"` as it already does. Leave a comment saying why the filter went.

- [x] **Step 4: Check the share-priced branch**

A share-priced template takes its amount from an instrument quote. Confirm by reading whether that branch is reachable with an income category selected, and if it is, decide whether it should be. An income that tracks a share price is not a concept `CONTEXT.md` has. If it should not be reachable, gate it on the selected category's type rather than reinstating a picker-level exclusion, and say so in a comment.

- [x] **Step 5: Typecheck and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint components/finance/RecurringForm.tsx`
Expected: clean. Compare any lint output against a clean tree before assuming you introduced it.

- [x] **Step 6: Commit**

```bash
git add apps/web/components/finance/RecurringForm.tsx
git commit -m "Let an income category carry a recurring template"
```

---

### Task 3: The three-part header on Charges

**Files:**
- Modify: `apps/web/components/finance/RecurringView.tsx:292-298` (the reducers) and `:361-378` (the header section)
- Modify: `packages/core/src/i18n/messages/en.ts`, `packages/core/src/i18n/messages/fr.ts`

**Interfaces:**
- Consumes: `rollUpRecurring` from Task 1.
- Produces: nothing other tasks read.

**Copy.** Add to the `charges` group in both catalogues, keeping the existing `charges.committedEveryMonth` as the middle label:

```ts
// en.ts, in the charges group
incomeEveryMonth: "Income every month",
leftEveryMonth: "What's left",
noIncomeYet: "No income template yet — add one and this fills in.",
```

```ts
// fr.ts, same position in the charges group
incomeEveryMonth: "Revenus chaque mois",
leftEveryMonth: "Ce qu'il reste",
noIncomeYet: "Aucun revenu récurrent — ajoutez-en un et ceci se remplira.",
```

**Layout.** Three equal columns on a row, stacking on a phone. The existing section is `flex flex-col gap-1 rounded-card border border-border bg-card p-5`. Replace its body with a three-column grid inside the same card, so it stays one surface rather than becoming three:

```tsx
<section className="rounded-card border border-border bg-card p-5">
  <div className="grid gap-5 sm:grid-cols-3 sm:gap-4">
    {/* Income, Committed, What's left — each a label over a figure */}
  </div>
  {/* the existing "plus moved into the broker" line stays below the grid */}
</section>
```

Each cell is a label in `text-sm text-muted-foreground` over a figure in `privacy-amount font-head text-3xl leading-none tabular-nums md:text-4xl` — the treatment the current single figure already uses. **Keep `privacy-amount` on all three.** Do not colour any of them: the Semantic Amount Rule forbids colouring by good or bad, and "what's left" being small is not a category type. Where `rollup.income` is zero, show `t("charges.noIncomeYet")` in `text-sm text-muted-foreground` in place of the figure, not a `0 €` that looks measured.

- [x] **Step 1: Replace the two reducers with the rollup**

Delete `budgetMonthly` and `deploymentMonthly` at `:292-298` and call `rollUpRecurring(templates)` once. Map `rollup.committed` to where `budgetMonthly` was used and `rollup.deployed` to where `deploymentMonthly` was.

**Note the behaviour change and check it is wanted:** `budgetMonthly` previously summed expenses *and* savings *and* investments. `rollup.committed` is expenses only. If the existing figure was meant to include contributions, use `rollup.committed + rollup.setAside` and say so in a comment — but read `buildRunway`'s doc first, because the rest of the app draws the line at expenses.

- [x] **Step 2: Add the catalogue keys**

Add the three keys above to both files, in the same position in each so a reader diffing them sees one shape.

- [x] **Step 3: Build the three-column header**

Replace `:361-378`'s single label-and-figure with the grid. Keep the "plus moved into the broker" line below it unchanged, including its two-fragment structure — its comment explains that the figure is its own element so the blur covers the amount without covering the sentence.

- [x] **Step 4: Verify**

Run: `cd apps/web && npx tsc --noEmit && npx eslint components/finance/RecurringView.tsx`
Run: `cd packages/core && npx tsc --noEmit && npx vitest run src/i18n`
Expected: all clean; the i18n suite proves the French side is complete and that no key is orphaned.

- [x] **Step 5: Check it at 375px**

The three columns stack below `sm`. Confirm no horizontal scroll and that the figures do not wrap mid-number. `md:text-4xl` on a stacked phone column is fine; on the three-up desktop row, check the widest plausible figure still fits its column at the narrowest desktop width.

- [x] **Step 6: Commit**

```bash
git add apps/web/components/finance/RecurringView.tsx packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts
git commit -m "Say what comes in, what is committed, and what that leaves"
```

---

### Task 4: Keep the phone honest

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/recurring.tsx:122`

**Interfaces:**
- Consumes: `rollUpRecurring` from Task 1.

**Why this is its own task:** the phone runs the same reducer against the same data. The moment Task 2 ships, a salary exists; if the phone still sums every counting template, its figure gains the salary and disagrees with the web's. `CONTEXT.md`'s whole premise is that the clients share one ledger — a figure that differs by client is the failure that premise exists to prevent.

- [x] **Step 1: Read what the phone currently renders**

Read `apps/mobile/src/app/(tabs)/recurring.tsx:110-140`. Establish which label sits above the figure and whether the phone shows a deployment line like the web's.

- [x] **Step 2: Replace the reducer with the rollup**

Swap the `estimateMonthlyAmount` reduce for `rollUpRecurring(templates)`, using `rollup.committed` where the old sum was used.

- [x] **Step 3: Decide whether the phone gets the three-part header too**

This plan does not require it. Decide deliberately and record the decision: matching the web is more consistent, but the phone's column is narrower and three figures across it may not fit at `text-3xl`. If you defer it, leave a comment naming this plan so the next reader knows it was a choice.

- [x] **Step 4: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/recurring.tsx
git commit -m "Give the phone the same split the web now draws"
```

---

### Task 5: Make the projection's invitation true

**Files:**
- Modify: `packages/core/src/i18n/messages/en.ts`, `fr.ts` — whichever key `ProjectionCard` renders for an income ingredient with zero charges.

**Interfaces:**
- Consumes: nothing. This is copy.

**Why:** `ProjectionCard` renders an income ingredient and links it to `/recurring`. Before Task 2 that link led to a form that would not let you comply. It does now, so read the current wording and check it still says the right thing — it may have been written to hedge around the fact that the destination did not work.

- [x] **Step 1: Find the copy**

Read `apps/web/components/finance/ProjectionCard.tsx:220-260` and follow `t("projection.income")` and any zero-charges branch into the catalogues.

- [x] **Step 2: Correct it if it hedges**

If the wording avoids telling the user to add an income template, make it say so plainly, in both languages. If it already does, change nothing and record that in the commit message.

- [x] **Step 3: Verify and commit**

Run: `cd packages/core && npx vitest run src/i18n && npx tsc --noEmit`

```bash
git add packages/core/src/i18n/messages/en.ts packages/core/src/i18n/messages/fr.ts
git commit -m "Say plainly where an income figure comes from"
```

---

## Out of scope, deliberately

- **Averaging past salaries.** Decision 1 chose templates. An average is a reasonable later addition as a *suggestion* when no income template exists, but it is a second source of truth and does not belong in the first pass.
- **Subtracting unrecorded spending from What's left.** Decision 2. The measured figure already has a home on the Plan page.
- **The Plan page's own layout.** This plan changes what Charges shows and what core exposes. The Plan page reads the projection, which already had income in it.
- **A `salary` concept.** `CONTEXT.md` has no such term and this plan does not add one.

## Self-review notes

- Task 1 must land before Task 2, or the salary pollutes the committed figure on both clients. The hazard section says so and Task 2's header repeats it.
- `rollUpRecurring` is named for what it does rather than after either client, because both call it.
- Task 3 Step 1 flags a real behaviour change (`committed` narrowing to expenses) rather than hiding it, and points at `buildRunway`'s doc as the precedent.
- Every string added is in both catalogues, in the same position.
- No task adds a fifth home for the accent, and no figure is coloured by sign or by outcome.


---

## Execution record

All five tasks executed 2026-09-21. Commits on `plan-income-header`:

| Task | Commit | Note |
|---|---|---|
| 1 | `1572f5d` | `rollUpRecurring` + 5 tests. Landed before Task 2, as required. |
| 2 | `5db9dee` | Income unblocked. Both flagged questions answered from the code — see below. |
| 3 | `b6e3759` | Three-part header, plus a set-aside line the plan did not anticipate. |
| 4 | `c4be70e` | Phone rollup, plus a hardcoded English label the plan did not know about. |
| 5 | — | **No change needed.** See below. |

### What the plan got wrong, and what it missed

**Task 2's two open questions both resolved to "no new code".** `allocCategories`
filtering income out only made `selectedCategory` come back `undefined`, so the
four flags beneath it were right by accident rather than by their own type
checks; removing the filter makes them right for their own reasons. And a
share-priced income template was already unreachable, because `supportsShares`
requires an investment category. The plan asked for a gate that turned out to
already exist.

**Task 3 needed a fourth figure the plan did not specify.** Narrowing
`committed` to expenses is correct — it is what `buildRunway` and the Bearing
already mean — but it drops savings and investment contributions out of the
only figure that was carrying them, and the plan said nothing about where they
go. They are now a set-aside line beneath the three, matching the broker line
already there. Two catalogue keys were added for it that the plan did not list.

**Task 4 found an i18n defect the plan did not know about.** The phone's card
label was the hardcoded English string `Committed every month`, never routed
through the catalogue — on a screen a French reader reaches from a French tab
bar. Fixed while in the file.

**Task 5 was already true.** `projection.noIncomeCharge` reads "No charge
brings money in, so your pay is in none of this. Add it under Charges and
every figure here changes." It never hedged around the broken destination; it
was simply wrong, and Task 2 made it right. Changing it would have been
churn.

### Not done, deliberately

- The three-across header is web-only. Three figures at the phone's type size
  do not fit its column, and the goal was agreement about the numbers.
- `packages/core` gained an exports entry for the new module. No other
  packaging changed.


---

## Decision 2 reversed, same day

**`left` is `income − committed − setAside`, not `income − committed`.**

The plan chose the narrower arithmetic so the third figure would be checkable
against the two beside it. That was the wrong trade. Contributions are not
spending, but they are not free either, and leaving them out reports a saver
as having more room than a spender on the same income with the same rent —
when they have the same room and one of them has already used it.

Making the figure honest made a hidden subtrahend, so the row grew a fourth
tile: **Income · Committed · Set aside · Left**. Every term of the arithmetic
is now on screen beside its result, which is what the plan was trying to buy
with the narrower formula in the first place.

The header is four bare tiles rather than one card in columns — a word and a
figure each, at the type scale's documented card-level step, with nothing
else in them. The set-aside sentence that used to sit beneath the row is gone,
because the figure it named now has a tile of its own.

The phone keeps its single committed figure and its set-aside line. Four
tiles do not fit its column, and it does not render `left`, so the arithmetic
change does not reach it.
