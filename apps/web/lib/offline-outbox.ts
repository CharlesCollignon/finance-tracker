"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  enqueue,
  isRetryableError,
  recordFailure,
  removeEntry,
  type OutboxEntry,
} from "@finance/core/outbox";
import { saveQuickTransaction } from "@/lib/actions/finance";

const STORAGE_KEY = "outbox.transactions";

/**
 * Transactions saved while offline, held until they can be sent.
 *
 * Backed by localStorage rather than IndexedDB: a queued transaction is a few
 * hundred bytes and the queue is capped, so the simpler synchronous store is
 * enough and avoids an async layer around every read. Everything is wrapped in
 * try/catch because storage throws outright in a locked-down browser, and
 * losing the queue must never break saving.
 */

let queue: OutboxEntry[] = [];
let loaded = false;
let draining = false;
const listeners = new Set<() => void>();

/** Held by whichever tab is sending, so two tabs never send the same entry. */
const DRAIN_LOCK = "outbox.transactions.drain";

/**
 * The queue as it stands in storage, which another tab may have changed since
 * this one last looked. Every change starts from here rather than from this
 * tab's copy: writing the copy back is how one tab used to erase an entry
 * another had just queued.
 */
function stored(): OutboxEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    // A blocked store: this tab's memory is the only copy there is.
    return queue;
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // A full or blocked store means the queue is memory-only this session.
  }
}

function load(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  queue = stored();
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Changes the queue as storage holds it now, and tells this tab. */
function update(change: (entries: OutboxEntry[]) => OutboxEntry[]): void {
  queue = change(stored());
  persist();
  notify();
}

/** Another tab queued or sent something: show what storage now says. */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) {
    return;
  }
  queue = stored();
  notify();
}

function subscribe(listener: () => void): () => void {
  load();
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function snapshot(): OutboxEntry[] {
  load();
  return queue;
}

const SERVER_SNAPSHOT: OutboxEntry[] = [];

function serverSnapshot(): OutboxEntry[] {
  return SERVER_SNAPSHOT;
}

/**
 * Saves a transaction, holding it for later if the network is the problem.
 *
 * A rejection from the server is passed straight back: an invalid amount will
 * still be invalid in an hour, and queueing it would hide a mistake the user
 * could fix while the sheet is still open.
 */
export async function saveWithOutbox(
  payload: OutboxEntry["payload"],
): Promise<{ error?: string; queued?: boolean }> {
  load();

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    push(payload);
    return { queued: true };
  }

  try {
    const result = await saveQuickTransaction(payload);
    if (result.error) {
      if (isRetryableError(result.error)) {
        push(payload);
        return { queued: true };
      }
      return { error: result.error };
    }
    // A save proves the network is back, so anything held can go now.
    void drainOutbox();
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    if (!isRetryableError(message)) {
      return { error: message ?? "Could not save" };
    }
    push(payload);
    return { queued: true };
  }
}

function push(payload: OutboxEntry["payload"]): void {
  update((entries) =>
    enqueue(entries, {
      id: crypto.randomUUID(),
      payload,
      queuedAt: Date.now(),
      attempts: 0,
    }),
  );
}

/**
 * Sends everything held, oldest first.
 *
 * Sequential rather than parallel: the queue is short, and a burst of writes
 * from a connection that has only just come back tends to fail together.
 *
 * One tab at a time. Every open tab drains when the connection returns, and
 * two of them walking the same queue sent each entry twice — two identical
 * transactions from one purchase. The lock is skipped rather than waited for:
 * the tab holding it is already sending, and reads the queue afresh before
 * each entry, so whatever this tab queued goes with it.
 */
export async function drainOutbox(): Promise<void> {
  load();
  if (draining || stored().length === 0) {
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) {
    await drainHeld();
    return;
  }
  await locks.request(DRAIN_LOCK, { ifAvailable: true }, async (lock) => {
    if (lock) {
      await drainHeld();
    }
  });
}

async function drainHeld(): Promise<void> {
  draining = true;
  try {
    // The oldest entry storage holds, read again each time round: another
    // tab may have queued one since, and an entry already sent is gone.
    for (let entry = stored()[0]; entry; entry = stored()[0]) {
      const { id, payload } = entry;
      try {
        const result = await saveQuickTransaction(payload);
        if (result.error && isRetryableError(result.error)) {
          update((entries) => recordFailure(entries, id, result.error!));
          // The network is still bad; stop rather than burn the retry budget.
          break;
        }
        // Sent, or rejected for a reason retrying will not change.
        update((entries) => removeEntry(entries, id));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Send failed";
        update((entries) => recordFailure(entries, id, message));
        break;
      }
    }
  } finally {
    draining = false;
  }
}

/** Starts draining when the browser reports the connection is back. */
export function watchConnection(): () => void {
  function handleOnline() {
    void drainOutbox();
  }
  window.addEventListener("online", handleOnline);
  void drainOutbox();
  return () => window.removeEventListener("online", handleOnline);
}

export function useOutbox(): {
  entries: OutboxEntry[];
  retry: () => void;
} {
  const entries = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const retry = useCallback(() => {
    void drainOutbox();
  }, []);

  return { entries, retry };
}
