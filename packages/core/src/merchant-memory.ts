/**
 * What the app remembers about the places money goes.
 *
 * Derived entirely from transactions the user has already entered — there is
 * no rules table to keep in sync, and a habit that changes corrects itself as
 * soon as the newer entries outnumber the older ones. The note field is the
 * only merchant signal the app has, so this is what turns "Franprix" typed for
 * the fourth time into a prefilled category and amount.
 */

import type { CategoryType, TransactionWithCategory } from "./types/database";

/** Bank statements shout, pad, and staple references onto the merchant. */
const NOISE_PATTERNS: RegExp[] = [
  /\bcarte\b/gi,
  /\bcb\b/gi,
  /\bpaiement\b/gi,
  /\bachat\b/gi,
  /\bvirement\b/gi,
  /\bprelevement\b/gi,
  /\bprlv\b/gi,
  /\bfacture\b/gi,
  /\bsepa\b/gi,
  /\bref\.?\s*\S+/gi,
  /\bdu\s+\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?/gi,
  /\b\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\b/g,
  /\b\d{4,}\b/g,
];

/**
 * A comparison key for two descriptions that mean the same merchant.
 * Accents, case, card-network noise and trailing reference numbers all go.
 */
export function normalizeMerchant(note: string | null | undefined): string {
  if (!note) {
    return "";
  }

  let value = note
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  for (const pattern of NOISE_PATTERNS) {
    value = value.replace(pattern, " ");
  }

  return value
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MerchantRule {
  /** Normalized key this rule answers to. */
  key: string;
  /** The most recent spelling the user actually typed, for display. */
  label: string;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  /** Amount on the most recent transaction, offered as a starting point. */
  lastAmount: number;
  lastUsedOn: string;
  /** How many transactions back this rule, used to rank suggestions. */
  count: number;
}

export type MerchantIndex = Map<string, MerchantRule>;

/**
 * Builds the index newest-first. Ties on recency go to the more frequent
 * merchant, so a one-off never outranks a weekly habit in the suggestions.
 */
export function buildMerchantIndex(
  transactions: TransactionWithCategory[],
): MerchantIndex {
  const index: MerchantIndex = new Map();

  for (const tx of transactions) {
    const key = normalizeMerchant(tx.note);
    if (key === "") {
      continue;
    }

    const existing = index.get(key);

    if (!existing) {
      index.set(key, {
        key,
        label: tx.note?.trim() ?? key,
        categoryId: tx.category_id,
        categoryName: tx.categories.name,
        categoryType: tx.categories.type,
        lastAmount: Number(tx.amount),
        lastUsedOn: tx.occurred_on,
        count: 1,
      });
      continue;
    }

    existing.count += 1;

    // Only a strictly newer transaction may rewrite what the rule suggests.
    if (tx.occurred_on > existing.lastUsedOn) {
      existing.label = tx.note?.trim() ?? existing.label;
      existing.categoryId = tx.category_id;
      existing.categoryName = tx.categories.name;
      existing.categoryType = tx.categories.type;
      existing.lastAmount = Number(tx.amount);
      existing.lastUsedOn = tx.occurred_on;
    }
  }

  return index;
}

function rank(left: MerchantRule, right: MerchantRule): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  return right.lastUsedOn.localeCompare(left.lastUsedOn);
}

/** Exact-merchant lookup, for the moment a note is committed. */
export function lookupMerchant(
  index: MerchantIndex,
  note: string | null | undefined,
): MerchantRule | null {
  const key = normalizeMerchant(note);
  return key === "" ? null : (index.get(key) ?? null);
}

/**
 * Prefix and substring matches for a note being typed. Prefix matches come
 * first because that is what the user is steering towards; within each group
 * the more-used merchant wins.
 */
export function suggestMerchants(
  index: MerchantIndex,
  query: string,
  limit = 5,
): MerchantRule[] {
  const key = normalizeMerchant(query);
  if (key === "") {
    return [];
  }

  const prefix: MerchantRule[] = [];
  const contains: MerchantRule[] = [];

  for (const rule of index.values()) {
    if (rule.key === key) {
      continue;
    }
    if (rule.key.startsWith(key)) {
      prefix.push(rule);
    } else if (rule.key.includes(key)) {
      contains.push(rule);
    }
  }

  prefix.sort(rank);
  contains.sort(rank);

  return [...prefix, ...contains].slice(0, limit);
}

/**
 * Best category guess for an imported statement line.
 *
 * Import descriptions are noisier than anything the user types, so an exact
 * key match is rare and a containment match in either direction is the useful
 * signal: "CARTE 12/03 FRANPRIX 1234" normalizes to something that contains
 * the remembered "franprix". Longer keys are tried first, because a match on
 * "franprix bastille" says more than a match on "sncf".
 */
export function guessCategoryForDescription(
  index: MerchantIndex,
  description: string,
): MerchantRule | null {
  const key = normalizeMerchant(description);
  if (key === "") {
    return null;
  }

  const exact = index.get(key);
  if (exact) {
    return exact;
  }

  const candidates = [...index.values()]
    // A two-character key would match almost every line.
    .filter((rule) => rule.key.length >= 3)
    .filter((rule) => key.includes(rule.key) || rule.key.includes(key))
    .sort((left, right) => {
      if (left.key.length !== right.key.length) {
        return right.key.length - left.key.length;
      }
      return rank(left, right);
    });

  return candidates[0] ?? null;
}
