/**
 * Whether to ask the writer, and whether what it wrote still stands.
 *
 * Two unrelated questions that share a row in the database, so they share a
 * module. Both are pure.
 *
 * The allowance is not really about money — `mistral-small-latest` over a
 * two-thousand-token prompt is a fraction of a cent, and nobody presses a
 * button five times a month by accident. It is about a bug: a retry loop, a
 * stuck effect, a client that re-presses on every render. A ceiling turns
 * that from a bill into a refusal.
 *
 * The freshness half exists because a read ages differently from the figures
 * under it. The figures on screen are always current — they are rendered from
 * a pack rebuilt on the request. What ages is the *judgement*: "comfortably
 * inside your allowance", written when unrecorded spending was small, stops
 * being true when it is not.
 */

import { describePullAge } from "./bank-pull";
import { factsDigest, findFact, type MonthFacts } from "./month-facts";

/**
 * One for the month closing, four for "I changed something, write it again".
 */
export const MONTH_READ_WRITES_PER_MONTH = 5;

/** A double press is one call, not two. */
export const MONTH_READ_COOLDOWN_SECONDS = 60;

/**
 * How long a reservation may stand before it is treated as abandoned.
 *
 * A process that died mid-call leaves one behind. Two minutes is longer than
 * any answer takes and short enough that a person retrying does not sit and
 * wait for it.
 */
export const MONTH_READ_RESERVATION_SECONDS = 120;

/** What the store holds about one month's reads. */
export interface MonthReadTally {
  /** Times the writer has been asked, answered well or not. */
  writes: number;
  /** Answers thrown away for putting in a figure the app did not give. */
  refused: number;
  /** ISO instant of the last time it was asked, or null. */
  lastWrittenAt: string | null;
  /** Set while a call is in flight; null otherwise. */
  pendingSince: string | null;
}

export type WriteRefusal =
  | { reason: "allowance-spent"; used: number; allowance: number }
  | { reason: "cooling-down"; retryAfterSeconds: number }
  | { reason: "in-flight" }
  | { reason: "nothing-to-say" }
  | { reason: "untracked" };

export type WriteDecision = { write: true } | ({ write: false } & WriteRefusal);

function secondsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return Number.POSITIVE_INFINITY;
  }
  return (to - from) / 1000;
}

export interface WriteQuestion {
  tally: MonthReadTally | null;
  facts: MonthFacts;
  /** The instant being asked about, ISO. */
  now: string;
  /**
   * Whether the tally can be read and written at all. False before the
   * migration has run — and a call that cannot be counted is a call that is
   * not capped, so it does not happen.
   */
  tracked: boolean;
  allowance?: number;
  cooldownSeconds?: number;
  reservationSeconds?: number;
}

export function decideMonthReadWrite({
  tally,
  facts,
  now,
  tracked,
  allowance = MONTH_READ_WRITES_PER_MONTH,
  cooldownSeconds = MONTH_READ_COOLDOWN_SECONDS,
  reservationSeconds = MONTH_READ_RESERVATION_SECONDS,
}: WriteQuestion): WriteDecision {
  // First, because it costs nothing to check and it is the one refusal that
  // saves the user from the worst possible output: a confident read of a
  // month with nothing in it.
  if (facts.thin) {
    return { write: false, reason: "nothing-to-say" };
  }

  if (!tracked) {
    return { write: false, reason: "untracked" };
  }

  const writes = tally?.writes ?? 0;
  if (writes >= allowance) {
    return { write: false, reason: "allowance-spent", used: writes, allowance };
  }

  if (tally?.pendingSince) {
    const waiting = secondsBetween(tally.pendingSince, now);
    // An abandoned reservation is not a reason to refuse forever.
    if (waiting >= 0 && waiting < reservationSeconds) {
      return { write: false, reason: "in-flight" };
    }
  }

  if (tally?.lastWrittenAt) {
    const elapsed = secondsBetween(tally.lastWrittenAt, now);
    // A clock that has gone backwards reads as "just now" rather than as a
    // very long wait, so the cooldown cannot be skipped by being wrong about
    // the time. Same reasoning as the bank pull's cooldown.
    if (elapsed < cooldownSeconds) {
      return {
        write: false,
        reason: "cooling-down",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(cooldownSeconds - Math.max(0, elapsed)),
        ),
      };
    }
  }

  return { write: true };
}

/** What is left of this month's allowance. */
export function writesRemaining(
  tally: MonthReadTally | null,
  allowance: number = MONTH_READ_WRITES_PER_MONTH,
): number {
  return Math.max(0, allowance - (tally?.writes ?? 0));
}

/** A refusal in words, for a button's label or a route's answer. */
export function explainWriteRefusal(
  refusal: WriteRefusal,
  monthLabel: string,
): string {
  switch (refusal.reason) {
    case "allowance-spent":
      return `You have used all ${refusal.allowance} reads for ${monthLabel}.`;
    case "cooling-down":
      return `One was just written — try again in ${refusal.retryAfterSeconds}s.`;
    case "in-flight":
      return "A read is already being written.";
    case "nothing-to-say":
      return `There is not enough in ${monthLabel} to write about yet.`;
    case "untracked":
      return "Monthly reads are not set up yet (migration 024).";
  }
}

/* ------------------------------------------------------------ freshness */

export type ReadStanding =
  /** The figures it rests on are where they were. */
  | "current"
  /** One or more figures it rests on have moved. */
  | "moved"
  /** A month still running: it was true when written, and will drift. */
  | "provisional";

export interface FactMove {
  id: string;
  label: string;
  was: number;
  now: number;
}

export interface ReadFreshness {
  standing: ReadStanding;
  /** "20 min ago", "yesterday". */
  writtenAge: string;
  /** Only the figures the read actually rests on. */
  moved: FactMove[];
}

/** Below this a difference is rounding, not movement. */
const MONEY_TOLERANCE = 0.01;
const PERCENT_TOLERANCE = 0.1;

export interface FreshnessQuestion {
  storedFacts: MonthFacts;
  currentFacts: MonthFacts;
  /** From `readFooting` — what the read declared and pointed at. */
  footing: readonly string[];
  writtenAt: string;
  now: string;
}

export function describeReadFreshness({
  storedFacts,
  currentFacts,
  footing,
  writtenAt,
  now,
}: FreshnessQuestion): ReadFreshness {
  const writtenAge = describePullAge(writtenAt, now);

  const moved: FactMove[] = [];
  for (const id of footing) {
    const before = findFact(storedFacts, id);
    const after = findFact(currentFacts, id);
    if (!before || !after) {
      continue;
    }
    const tolerance =
      after.unit === "percent"
        ? PERCENT_TOLERANCE
        : after.unit === "count"
          ? 0
          : MONEY_TOLERANCE;
    if (Math.abs(after.value - before.value) > tolerance) {
      moved.push({
        id,
        label: after.label,
        was: before.value,
        now: after.value,
      });
    }
  }

  // A month in progress is never reported as stale, however much has moved.
  //
  // Its figures change every time anything is recorded, so a staleness badge
  // on it would be lit permanently — and a warning that is always on is a
  // warning nobody reads. It says when it was written instead, which is the
  // same "so far" honesty the month's provisional figures already use. A
  // closed month is where "three of the figures this rests on have moved" is
  // real news.
  if (currentFacts.state === "in-progress") {
    return { standing: "provisional", writtenAge, moved };
  }

  // The digest is the cheap check; the footing comparison is the meaningful
  // one. A figure nobody cited moving is not staleness.
  if (
    factsDigest(storedFacts) === factsDigest(currentFacts) ||
    moved.length === 0
  ) {
    return { standing: "current", writtenAge, moved: [] };
  }

  return { standing: "moved", writtenAge, moved };
}
