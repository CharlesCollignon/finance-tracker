"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  describeOutbox,
  enqueue,
  isRetryableError,
  outboxStatus,
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
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    queue = raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    queue = [];
  }
}

function emit(): void {
  persist();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
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
  queue = enqueue(queue, {
    id: crypto.randomUUID(),
    payload,
    queuedAt: Date.now(),
    attempts: 0,
  });
  emit();
}

/**
 * Sends everything held, oldest first.
 *
 * Sequential rather than parallel: the queue is short, and a burst of writes
 * from a connection that has only just come back tends to fail together.
 */
export async function drainOutbox(): Promise<void> {
  load();
  if (draining || queue.length === 0) {
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  draining = true;
  try {
    for (const entry of [...queue]) {
      try {
        const result = await saveQuickTransaction(entry.payload);
        if (result.error && isRetryableError(result.error)) {
          queue = recordFailure(queue, entry.id, result.error);
          emit();
          // The network is still bad; stop rather than burn the retry budget.
          break;
        }
        // Sent, or rejected for a reason retrying will not change.
        queue = removeEntry(queue, entry.id);
        emit();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Send failed";
        queue = recordFailure(queue, entry.id, message);
        emit();
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
  label: string | null;
  retry: () => void;
} {
  const entries = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const retry = useCallback(() => {
    void drainOutbox();
  }, []);

  return {
    entries,
    label: describeOutbox(outboxStatus(entries)),
    retry,
  };
}
