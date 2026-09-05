/**
 * Selecting several transactions at once.
 *
 * Shared by both platforms and by both the ledger and the calendar, so the
 * four places that offer multi-select agree on what a selection is and what
 * deleting one would actually do.
 *
 * The interesting part is the warning: a transaction that came from a
 * recurring template will be recreated the next time the month is applied, so
 * deleting it is not the same act as deleting a one-off. The user should be
 * told that before they confirm, not after they wonder why it came back.
 *
 * Moving a selection to another category carries a warning of its own, and a
 * stranger one — see `planSelectionMove`.
 */

import { normalizeMerchant } from "./merchant-memory";
import type { CategoryType, TransactionWithCategory } from "./types/database";

export interface SelectionSummary {
  count: number;
  /** Sum of the selected amounts, regardless of type. */
  total: number;
  /** How many came from a recurring template, and so may be recreated. */
  recurringCount: number;
  /** Counts per category type, so the UI can describe a mixed selection. */
  byType: Record<CategoryType, number>;
  /** Every selected row belongs to a recurring template. */
  allRecurring: boolean;
}

const EMPTY_BY_TYPE: Record<CategoryType, number> = {
  income: 0,
  expense: 0,
  savings: 0,
  investment: 0,
};

export function summarizeSelection(
  transactions: TransactionWithCategory[],
  selectedIds: ReadonlySet<string>,
): SelectionSummary {
  const byType = { ...EMPTY_BY_TYPE };
  let count = 0;
  let total = 0;
  let recurringCount = 0;

  for (const tx of transactions) {
    if (!selectedIds.has(tx.id)) {
      continue;
    }
    count += 1;
    total += Number(tx.amount);
    byType[tx.categories.type] += 1;
    if (tx.recurring_template_id) {
      recurringCount += 1;
    }
  }

  return {
    count,
    total: Math.round(total * 100) / 100,
    recurringCount,
    byType,
    allRecurring: count > 0 && recurringCount === count,
  };
}

/** Adds or removes one id, returning a new set rather than mutating. */
export function toggleSelected(
  selected: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * The select-all checkbox state for a list.
 *
 * "Some" drives the indeterminate look, which matters because a half-selected
 * list must not look like an empty one.
 */
export type SelectAllState = "none" | "some" | "all";

export function selectAllState(
  visibleIds: readonly string[],
  selected: ReadonlySet<string>,
): SelectAllState {
  if (visibleIds.length === 0) {
    return "none";
  }
  const chosen = visibleIds.filter((id) => selected.has(id)).length;
  if (chosen === 0) {
    return "none";
  }
  return chosen === visibleIds.length ? "all" : "some";
}

/**
 * Toggling select-all only ever affects what is on screen — a filtered list
 * must not quietly select rows the filter is hiding.
 */
export function toggleSelectAll(
  visibleIds: readonly string[],
  selected: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selected);
  const state = selectAllState(visibleIds, selected);

  if (state === "all") {
    for (const id of visibleIds) {
      next.delete(id);
    }
    return next;
  }

  for (const id of visibleIds) {
    next.add(id);
  }
  return next;
}

/** Drops ids that are no longer on screen, e.g. after a filter or month change. */
export function pruneSelection(
  selected: ReadonlySet<string>,
  availableIds: readonly string[],
): Set<string> {
  const available = new Set(availableIds);
  return new Set([...selected].filter((id) => available.has(id)));
}

/**
 * The sentence shown above the confirm button.
 *
 * Says plainly that recurring entries can come back, because "deleted" meaning
 * "until you next press Apply" is the kind of surprise that makes people
 * distrust a ledger.
 */
export function describeSelectionDeletion(
  summary: SelectionSummary,
): string | null {
  if (summary.count === 0) {
    return null;
  }

  const noun = summary.count === 1 ? "transaction" : "transactions";
  const base = `Delete ${summary.count} ${noun}?`;

  if (summary.recurringCount === 0) {
    return `${base} This cannot be undone.`;
  }

  if (summary.allRecurring) {
    return `${base} ${
      summary.count === 1 ? "It comes" : "They come"
    } from recurring templates, so Apply will recreate ${
      summary.count === 1 ? "it" : "them"
    } unless you skip the date.`;
  }

  return `${base} ${summary.recurringCount} of them come from recurring templates, so Apply will recreate those unless you skip the date.`;
}

/* ------------------------------------------------ moving a selection */

/** How many merchants a sentence will name before it stops listing them. */
const MAX_NAMED_MERCHANTS = 3;

export interface MoveEffect {
  /** Rows whose category type changes, so the month's totals move. */
  typeChanges: number;
  /**
   * Merchants whose next bank row will now be filed to the target, because
   * the newest transaction the app has for them is in this selection.
   */
  rulesRewritten: string[];
  /**
   * Merchants that will keep being filed the old way, because a newer
   * transaction for them was left out of the selection.
   */
  rulesLeftBehind: string[];
  /** Rows from a recurring template, which Apply will keep filing its way. */
  recurringCount: number;
}

/**
 * What moving this selection would actually do.
 *
 * The obvious half is the category change. The half worth computing is what
 * it teaches the app, and that turns on something easy to miss:
 * `buildMerchantIndex` is derived from transaction history rather than stored,
 * and it keeps the category of the *most recent* transaction per merchant. So
 * correcting the past corrects what the next bank sync files — but only if the
 * newest row for that merchant is among the ones being corrected.
 *
 * Fix twenty old Carrefour rows and leave last week's alone, and the next sync
 * files Carrefour the old way again. The work is undone silently, by design,
 * and nothing on screen would have said so. That is what `rulesLeftBehind` is
 * for, and it is the reason this takes the whole transaction list rather than
 * just the selection: "is there a newer one I did not select" cannot be
 * answered from the selection alone.
 *
 * Merchants are keyed with `normalizeMerchant`, the same function the index
 * uses, so the two cannot disagree about what counts as the same shop.
 */
export function planSelectionMove(
  transactions: TransactionWithCategory[],
  selectedIds: ReadonlySet<string>,
  target: { id: string; type: CategoryType },
): MoveEffect {
  // The newest transaction per merchant, over everything — which is exactly
  // what decides the rule.
  const newest = new Map<string, TransactionWithCategory>();
  for (const tx of transactions) {
    const key = normalizeMerchant(tx.note);
    if (key === "") {
      continue;
    }
    const held = newest.get(key);
    if (!held || tx.occurred_on > held.occurred_on) {
      newest.set(key, tx);
    }
  }

  let typeChanges = 0;
  let recurringCount = 0;
  const rewritten = new Set<string>();
  const leftBehind = new Set<string>();

  for (const tx of transactions) {
    if (!selectedIds.has(tx.id)) {
      continue;
    }

    if (tx.categories.type !== target.type) {
      typeChanges += 1;
    }
    if (tx.recurring_template_id !== null) {
      recurringCount += 1;
    }

    const key = normalizeMerchant(tx.note);
    if (key === "") {
      continue;
    }

    const decider = newest.get(key);
    if (!decider) {
      continue;
    }

    // A merchant already filed to the target learns nothing from this move,
    // and saying so would be noise.
    if (decider.category_id === target.id) {
      continue;
    }

    const label = decider.note?.trim() || key;
    if (selectedIds.has(decider.id)) {
      rewritten.add(label);
    } else {
      leftBehind.add(label);
    }
  }

  return {
    typeChanges,
    rulesRewritten: [...rewritten].sort(),
    rulesLeftBehind: [...leftBehind].sort(),
    recurringCount,
  };
}

function nameList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED_MERCHANTS);
  const rest = names.length - shown.length;
  const joined =
    shown.length === 1
      ? shown[0]!
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${joined} and ${rest} more` : joined;
}

/**
 * The sentences shown before a move is made.
 *
 * Ordered by how surprising each one is rather than by how serious it sounds.
 * A changed total is visible the moment the page reloads; a merchant rule that
 * silently stayed wrong is not visible until a bank sync a fortnight later
 * puts the row back where it was.
 *
 * Returns null when there is nothing worth saying, which is the common case:
 * most moves are one category to another of the same type, and a sentence
 * confirming that nothing unusual will happen is a sentence nobody reads.
 */
export function describeSelectionMove(
  effect: MoveEffect,
  summary: SelectionSummary,
  targetName: string,
): string | null {
  if (summary.count === 0) {
    return null;
  }

  const lines: string[] = [];

  if (effect.typeChanges > 0) {
    const all = effect.typeChanges === summary.count;
    lines.push(
      `${
        all
          ? summary.count === 1
            ? "This one"
            : "All of them"
          : `${effect.typeChanges} of them`
      } move to a different kind of category, so past months' totals and unrecorded spending will change.`,
    );
  }

  if (effect.rulesLeftBehind.length > 0) {
    lines.push(
      `${nameList(
        effect.rulesLeftBehind,
      )} will still be filed the old way, because a newer entry for ${
        effect.rulesLeftBehind.length === 1 ? "it" : "them"
      } is not selected.`,
    );
  } else if (effect.rulesRewritten.length > 0) {
    lines.push(
      `From now on ${nameList(
        effect.rulesRewritten,
      )} will be filed as ${targetName}.`,
    );
  }

  if (effect.recurringCount > 0) {
    lines.push(
      `${effect.recurringCount} came from recurring templates, which will keep using their own category.`,
    );
  }

  return lines.length > 0 ? lines.join(" ") : null;
}
