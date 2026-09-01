/**
 * Transactions entered while offline.
 *
 * The moment someone wants to log a purchase is standing at the till, which is
 * also where signal is worst. Losing the entry there is the difference between
 * a ledger that gets kept and one that gets abandoned, so a failed save is
 * held and replayed rather than reported as an error.
 *
 * This module is the pure part: what the queue contains and how it changes.
 * Storage and the network live in the app that uses it, so the rules are
 * testable without a browser.
 */

export interface OutboxEntry {
  /** Client-generated, so a replay can be recognised as the same entry. */
  id: string;
  /** The payload to send, opaque here. */
  payload: {
    categoryId: string;
    amount: number;
    occurredOn: string;
    note?: string;
    tagIds?: string[];
  };
  /** Epoch millis the entry was queued. */
  queuedAt: number;
  /** How many send attempts have already failed. */
  attempts: number;
  /** Why the last attempt failed, for the one case worth showing. */
  lastError?: string;
}

/**
 * Past this, the entry is not going to succeed by being retried — usually a
 * category that has since been deleted — and holding it forever would mean a
 * queue that never drains and a badge that never clears.
 */
export const MAX_ATTEMPTS = 5;

/** A queue longer than this means something is wrong, not that someone is busy. */
export const MAX_QUEUE = 200;

export function enqueue(
  queue: readonly OutboxEntry[],
  entry: OutboxEntry,
): OutboxEntry[] {
  // Same id twice is a double-submit, not two purchases.
  if (queue.some((item) => item.id === entry.id)) {
    return [...queue];
  }
  return [...queue, entry].slice(-MAX_QUEUE);
}

export function removeEntry(
  queue: readonly OutboxEntry[],
  id: string,
): OutboxEntry[] {
  return queue.filter((entry) => entry.id !== id);
}

/** Records a failed attempt, dropping the entry once it is clearly stuck. */
export function recordFailure(
  queue: readonly OutboxEntry[],
  id: string,
  error: string,
): OutboxEntry[] {
  return queue.flatMap((entry) => {
    if (entry.id !== id) {
      return [entry];
    }
    const attempts = entry.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      return [];
    }
    return [{ ...entry, attempts, lastError: error }];
  });
}

/** Entries dropped by `recordFailure`, so the caller can tell the user. */
export function willDrop(queue: readonly OutboxEntry[], id: string): boolean {
  const entry = queue.find((item) => item.id === id);
  return entry !== undefined && entry.attempts + 1 >= MAX_ATTEMPTS;
}

export interface OutboxStatus {
  pending: number;
  /** The oldest queued entry's timestamp, for "waiting since…". */
  oldestQueuedAt: number | null;
  /** Entries that have failed at least once. */
  failing: number;
}

export function outboxStatus(queue: readonly OutboxEntry[]): OutboxStatus {
  return {
    pending: queue.length,
    oldestQueuedAt: queue.reduce<number | null>(
      (min, entry) =>
        min === null || entry.queuedAt < min ? entry.queuedAt : min,
      null,
    ),
    failing: queue.filter((entry) => entry.attempts > 0).length,
  };
}

/** "2 waiting to sync" — or null when there is nothing to say. */
export function describeOutbox(status: OutboxStatus): string | null {
  if (status.pending === 0) {
    return null;
  }
  const noun = status.pending === 1 ? "entry" : "entries";
  return `${status.pending} ${noun} waiting to sync`;
}

/**
 * Whether a failure looks like "no network" rather than "the server said no".
 *
 * Only the first kind is worth queueing: a rejected amount will be rejected
 * again in an hour, and holding it would hide a mistake the user could fix
 * right now.
 */
export function isRetryableError(message: string | undefined): boolean {
  if (!message) {
    return true;
  }
  const text = message.toLowerCase();
  return (
    text.includes("fetch") ||
    text.includes("network") ||
    text.includes("offline") ||
    text.includes("timeout") ||
    text.includes("connection") ||
    text.includes("failed to load")
  );
}
