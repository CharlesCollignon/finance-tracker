/**
 * Reactions to « Nouveautés », votes for « Bientôt » (migration 070), and
 * reactions in Entraide (migration 071): what can be said, about what, and
 * how a tally changes when someone says it — the same on both apps, and on
 * the screen before the write returns.
 */

/** On a shipped change: « J'adore », « Utile », « Enfin ! ». */
export const CHANGELOG_REACTIONS = ["love", "useful", "finally"] as const;

export type ChangelogReaction = (typeof CHANGELOG_REACTIONS)[number];

/** On an item of « Bientôt »: « J'attends ça ». */
export const ROADMAP_VOTE = "want";

/** What « Nouveautés » shows: the three reactions and the vote. */
export type NouveautesReaction = ChangelogReaction | typeof ROADMAP_VOTE;

/** On a question or an answer in Entraide: « Utile », « Merci ». */
export const ENTRAIDE_REACTIONS = ["useful", "thanks"] as const;

export type EntraideReaction = (typeof ENTRAIDE_REACTIONS)[number];

export type ReactionKind = NouveautesReaction | EntraideReaction;

export function changelogTarget(entryId: string): string {
  return `changelog:${entryId}`;
}

export function roadmapTarget(itemId: string): string {
  return `roadmap:${itemId}`;
}

export function postTarget(postId: number): string {
  return `post:${postId}`;
}

export function replyTarget(replyId: number): string {
  return `reply:${replyId}`;
}

/**
 * Whether `kind` may be said about `target`: what the `reactions` table's
 * check holds (migrations 070 and 071), asked before the write so a wrong
 * pair never reaches it.
 */
export function reactionAllowed(target: string, kind: ReactionKind): boolean {
  const kinds: readonly ReactionKind[] = target.startsWith("changelog:")
    ? CHANGELOG_REACTIONS
    : target.startsWith("roadmap:")
      ? [ROADMAP_VOTE]
      : target.startsWith("post:") || target.startsWith("reply:")
        ? ENTRAIDE_REACTIONS
        : [];
  return kinds.includes(kind);
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
