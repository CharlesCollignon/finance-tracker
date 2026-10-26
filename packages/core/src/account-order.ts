import { ACCOUNT_IDS, type AccountId } from "./allocation";

/**
 * The order Placements lists the accounts in.
 *
 * The owner's call (2026-10-26): the CTO first, then the PEA, then crypto,
 * then the rest as they were — the savings accounts, then the assurance vie
 * and the PER. Anyone can then drag the accounts into their own order, which
 * is kept with their preferences (`user_preferences.account_order`, migration
 * 076) so the phone and the web agree.
 *
 * A saved order is a list of ids and nothing more, so it outlives the
 * accounts in it: one removed since is skipped, and one added since goes
 * where the default order would put it among the others.
 */
const LEADING: readonly AccountId[] = ["cto", "pea", "crypto"];

/** Every account in the order Placements lists them when nothing is saved. */
export const DEFAULT_ACCOUNT_ORDER: readonly AccountId[] = [
  ...LEADING,
  ...ACCOUNT_IDS.filter((id) => !LEADING.includes(id)),
];

/** A saved order, read from the database: the account ids in it, once each. */
export function parseAccountOrder(value: unknown): AccountId[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const order: AccountId[] = [];
  for (const id of value) {
    if (
      typeof id === "string" &&
      (ACCOUNT_IDS as readonly string[]).includes(id) &&
      !order.includes(id as AccountId)
    ) {
      order.push(id as AccountId);
    }
  }
  return order;
}

/**
 * The accounts the user keeps, in their order.
 *
 * Those in `saved` come first, as saved; the rest follow in the default
 * order. With nothing saved, that is the default order alone.
 */
export function orderAccounts<T extends AccountId>(
  kept: readonly T[],
  saved: readonly AccountId[] | null,
): T[] {
  const rank = (id: AccountId) => {
    const at = saved?.indexOf(id) ?? -1;
    return at >= 0
      ? at
      : (saved?.length ?? 0) + DEFAULT_ACCOUNT_ORDER.indexOf(id);
  };
  return [...new Set(kept)].sort((left, right) => rank(left) - rank(right));
}

/** The order with the account at `from` moved to `to`. */
export function moveAccount<T>(
  order: readonly T[],
  from: number,
  to: number,
): T[] {
  if (from === to || from < 0 || from >= order.length) {
    return [...order];
  }
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!);
  return next;
}

/**
 * Where a chip in a single row lands once dragged `dx` from its place.
 *
 * `widths` are the chips' widths in order and `gap` the space between two.
 * The chip takes the place of every neighbour whose middle it has passed, so
 * a short drag puts nothing anywhere and the chip never jumps two places for
 * one neighbour.
 */
export function slotAfterDrag(
  widths: readonly number[],
  gap: number,
  from: number,
  dx: number,
): number {
  let slot = from;
  if (dx > 0) {
    let travelled = 0;
    for (let next = from + 1; next < widths.length; next += 1) {
      travelled += gap + widths[next]! / 2;
      if (dx < travelled) {
        break;
      }
      slot = next;
      travelled += widths[next]! / 2;
    }
  } else if (dx < 0) {
    let travelled = 0;
    for (let next = from - 1; next >= 0; next -= 1) {
      travelled += gap + widths[next]! / 2;
      if (-dx < travelled) {
        break;
      }
      slot = next;
      travelled += widths[next]! / 2;
    }
  }
  return slot;
}
