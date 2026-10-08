import { translator } from "./i18n/t";
import { LOCALES } from "./i18n/locale";
import type { TransactionWithCategory } from "./types/database";

/**
 * « Avec ma part du commun » (`docs/plans/EVERYDAY_PLAN.md`, 6b): a person's
 * spending as it really is once the shared space is counted — the transfers
 * they made to the joint account taken out, since that money was not spent
 * yet, and their part of what the space spent put in, under their own
 * categories where the names match.
 *
 * Only the spending moves. The balance, « Il vous reste » and the closes
 * are about the person's account, which is exactly what it was.
 */

/** The names « Versement au compte commun » has, in every language. */
const TRANSFER_NAMES = new Set(
  LOCALES.map((locale) =>
    normalise(translator(locale)("space.transferCategory")),
  ),
);

/** To the cent, as every figure here is. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

/** Whether a category is the one transfers to the joint account are filed in. */
export function isJointTransferCategory(name: string): boolean {
  return TRANSFER_NAMES.has(normalise(name));
}

/**
 * The person's rows with their part of the space's: the transfers to the
 * joint account left out, and each joint expense at `share` of its amount,
 * filed under the person's category of the same name when they have one —
 * the joint categories start as a copy of the creator's — and under its own
 * otherwise. Income in the space stays out: it is the partners' transfers
 * coming in.
 */
export function withMyShare(
  personal: readonly TransactionWithCategory[],
  joint: readonly TransactionWithCategory[],
  share: number,
): TransactionWithCategory[] {
  const part = Math.min(1, Math.max(0, share));
  const own = personal.filter(
    (tx) => !isJointTransferCategory(tx.categories.name),
  );
  const byName = new Map<string, TransactionWithCategory>();
  for (const tx of own) {
    const key = normalise(tx.categories.name);
    if (!byName.has(key)) {
      byName.set(key, tx);
    }
  }
  const mine = joint
    .filter((tx) => tx.categories.type === "expense")
    .map((tx) => {
      const twin = byName.get(normalise(tx.categories.name));
      return {
        ...tx,
        amount: roundMoney(Number(tx.amount) * part),
        ...(twin
          ? { category_id: twin.category_id, categories: twin.categories }
          : {}),
      };
    })
    .filter((tx) => Number(tx.amount) > 0);
  return [...own, ...mine];
}
