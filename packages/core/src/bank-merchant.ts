/**
 * Matching a merchant as a bank spells it.
 *
 * `merchant-memory` matches on the whole normalised note, which is right for
 * what the user typed themselves: they wrote "Franprix" both times, so exact
 * is exact. A bank writes the same shop differently every visit —
 *
 *   PAIEMENT PAR CARTE X7322 BITSTACK SAS MEYREUI 30/08
 *   PAIEMENT PAR CARTE X7322 Bitstack 100 Impasse  12/07
 *
 * — because the trailing branch, street and town belong to the terminal, not
 * the merchant. Measured against 256 real card payments, exact matching
 * answered for 65% of them and the first meaningful word for 85%: the same
 * shop split across keys was most of the gap.
 *
 * So the feed gets a coarser key of its own rather than blunting the one
 * hand-entry relies on. Coarser means likelier to collide, which is why
 * nothing is filed automatically on this key unless every past transaction
 * under it agreed on the category — see `bank-feed`.
 */

import { normalizeMerchant } from "./merchant-memory";

/**
 * Noise a French bank staples onto a merchant. The card token is the same on
 * every row of the statement and the hash is unique to each, so both are
 * useless for telling shops apart.
 */
const CARD_NOISE: RegExp[] = [
  /\bpaiement par carte\b/gi,
  /\bx\d{3,}\b/gi,
  /\b[0-9a-f]{16,}\b/gi,
];

/**
 * Words that are never the merchant. Leading articles are the dangerous ones:
 * without this, "LE BISTROT" and "L'EPICERIE" become one key and start
 * answering for each other.
 */
const NOT_A_MERCHANT = new Set([
  "le",
  "la",
  "les",
  "l",
  "un",
  "une",
  "du",
  "de",
  "des",
  "au",
  "aux",
  "chez",
  "sa",
  "sas",
  "sarl",
  "eurl",
  "sasu",
  "the",
  "and",
  "et",
]);

/** The shortest word that can identify a merchant on its own. */
const MIN_WORD = 3;

/**
 * A coarse key for one bank description, or "" when nothing usable is left.
 *
 * Two words rather than one where the first is short or generic, so
 * "AU BUREAU" does not become "bureau" and collect every stationer.
 */
export function bankMerchantKey(
  description: string | null | undefined,
): string {
  if (!description) {
    return "";
  }

  let value = description;
  for (const pattern of CARD_NOISE) {
    value = value.replace(pattern, " ");
  }

  const words = normalizeMerchant(value)
    .split(" ")
    .filter((word) => word.length > 0);

  const meaningful: string[] = [];
  for (const word of words) {
    // A single letter is a leftover, not a name: "BIO C BON" should key on
    // "bio bon", not on "bio c".
    if (word.length < 2 || NOT_A_MERCHANT.has(word)) {
      continue;
    }
    meaningful.push(word);
    // One word is enough once it is long enough to stand alone.
    if (meaningful.length === 1 && word.length >= MIN_WORD + 2) {
      break;
    }
    if (meaningful.length === 2) {
      break;
    }
  }

  const key = meaningful.join(" ").trim();
  return key.length >= MIN_WORD ? key : "";
}

export interface BankMerchantRule {
  key: string;
  categoryId: string;
  categoryName: string;
  /** How many past transactions sit under this key. */
  count: number;
  /**
   * True when every one of them was filed the same way. A coarse key can
   * gather two different shops, and a split verdict is exactly what that
   * looks like from here — so it is the signal to ask rather than assume.
   */
  unanimous: boolean;
  lastUsedOn: string;
}

export type BankMerchantIndex = Map<string, BankMerchantRule>;

interface PastTransaction {
  note: string | null;
  category_id: string;
  occurred_on: string;
  categories: { name: string; type: string };
}

/** Built from the user's own history, the same way merchant-memory is. */
export function buildBankMerchantIndex(
  transactions: readonly PastTransaction[],
): BankMerchantIndex {
  const seen = new Map<
    string,
    { rule: BankMerchantRule; categories: Set<string> }
  >();

  for (const tx of transactions) {
    // Income is never inferred from a merchant; see `decide`.
    if (tx.categories.type === "income") {
      continue;
    }

    const key = bankMerchantKey(tx.note);
    if (key === "") {
      continue;
    }

    const entry = seen.get(key);
    if (!entry) {
      seen.set(key, {
        categories: new Set([tx.category_id]),
        rule: {
          key,
          categoryId: tx.category_id,
          categoryName: tx.categories.name,
          count: 1,
          unanimous: true,
          lastUsedOn: tx.occurred_on,
        },
      });
      continue;
    }

    entry.categories.add(tx.category_id);
    entry.rule.count += 1;
    entry.rule.unanimous = entry.categories.size === 1;

    if (tx.occurred_on > entry.rule.lastUsedOn) {
      entry.rule.categoryId = tx.category_id;
      entry.rule.categoryName = tx.categories.name;
      entry.rule.lastUsedOn = tx.occurred_on;
    }
  }

  return new Map([...seen].map(([key, entry]) => [key, entry.rule]));
}

export function lookupBankMerchant(
  index: BankMerchantIndex,
  description: string | null | undefined,
): BankMerchantRule | null {
  const key = bankMerchantKey(description);
  return key === "" ? null : (index.get(key) ?? null);
}
