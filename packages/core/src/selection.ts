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
 */

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
