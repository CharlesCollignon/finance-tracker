/**
 * « Équilibre »: what each partner put into the joint account, against their
 * part of what the space spent — a fact, said as one.
 *
 * « Ma part » recounts a person's spending as their part of the space's;
 * it never said who had put in more than their part. This does, from three
 * things the space can read: each partner's transfers to the joint account
 * (`space_contributions`, migration 078), the split
 * (`space_members.share`), and what the space spent over the span. The one
 * line it adds up to is how much the partner behind would put into the
 * account to be level with the split — never a payment between the two,
 * which the app would not make and does not suggest.
 */

export interface SpaceBalanceMember {
  userId: string;
  name: string;
  /** Their part of the joint spending, between 0 and 1. */
  share: number;
  /** What they put into the joint account over the span. */
  put: number;
}

export interface SpaceBalanceLine extends SpaceBalanceMember {
  /** Their part of what the space spent: `share × spent`. */
  part: number;
  /** `put − part`: ahead of the split when positive, behind when negative. */
  diff: number;
}

export interface SpaceBalance {
  /** As the space lists them. */
  members: SpaceBalanceLine[];
  /** What the space spent over the span. */
  spent: number;
  /**
   * The partner behind the split, and what they would put in to be level
   * with it: the gap between the two differences. Null when the two are
   * level, or when there is only one partner yet.
   */
  settle: { userId: string; name: string; amount: number } | null;
}

/** To the cent, as every figure here is. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Under this, the two are level: a cent is a rounding, not a debt. */
const LEVEL = 0.01;

export function buildSpaceBalance(
  members: readonly SpaceBalanceMember[],
  spent: number,
): SpaceBalance {
  const lines = members.map((member) => {
    const part = roundMoney(Math.max(0, spent) * member.share);
    return { ...member, part, diff: roundMoney(member.put - part) };
  });

  let settle: SpaceBalance["settle"] = null;
  if (lines.length === 2) {
    const [a, b] = lines as [SpaceBalanceLine, SpaceBalanceLine];
    const behind = a.diff < b.diff ? a : b;
    const ahead = behind === a ? b : a;
    const amount = roundMoney(ahead.diff - behind.diff);
    if (amount > LEVEL) {
      settle = { userId: behind.userId, name: behind.name, amount };
    }
  }

  return { members: lines, spent: roundMoney(spent), settle };
}

/** Nothing put in and nothing spent: nothing to say. */
export function spaceBalanceIsEmpty(balance: SpaceBalance): boolean {
  return balance.spent === 0 && balance.members.every((line) => line.put === 0);
}
