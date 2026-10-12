/**
 * Reactions to « Nouveautés » and votes for « Bientôt » (migration 070):
 * what can be said, about what, and how a tally changes when someone says
 * it — the same on both apps, and on the screen before the write returns.
 */

/** On a shipped change: « J'adore », « Utile », « Enfin ! ». */
export const CHANGELOG_REACTIONS = ["love", "useful", "finally"] as const;

export type ChangelogReaction = (typeof CHANGELOG_REACTIONS)[number];

/** On an item of « Bientôt »: « J'attends ça ». */
export const ROADMAP_VOTE = "want";

export type ReactionKind = ChangelogReaction | typeof ROADMAP_VOTE;

export function changelogTarget(entryId: string): string {
  return `changelog:${entryId}`;
}

export function roadmapTarget(itemId: string): string {
  return `roadmap:${itemId}`;
}

/** How many said each kind about one thing, and which of them the reader did. */
export interface ReactionTally {
  counts: Partial<Record<ReactionKind, number>>;
  mine: readonly ReactionKind[];
}

export const NO_TALLY: ReactionTally = { counts: {}, mine: [] };

/**
 * The tally once the reader has said (`on`) or taken back `kind`: what the
 * screen shows at once, before the write comes back. Saying twice, or
 * taking back what was not said, changes nothing.
 */
export function toggledTally(
  tally: ReactionTally,
  kind: ReactionKind,
  on: boolean,
): ReactionTally {
  const had = tally.mine.includes(kind);
  if (had === on) {
    return tally;
  }
  const count = Math.max(0, (tally.counts[kind] ?? 0) + (on ? 1 : -1));
  return {
    counts: { ...tally.counts, [kind]: count },
    mine: on ? [...tally.mine, kind] : tally.mine.filter((k) => k !== kind),
  };
}
