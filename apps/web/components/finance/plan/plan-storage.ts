"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ENVELOPE_ORDER,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";

/**
 * What the Plan page remembers in this browser: the reader's own version of
 * the long view, and the highest milestone they have already been shown.
 *
 * This browser's only, and a convenience rather than a record. The long view
 * is a calculator — nothing the app reports elsewhere rests on what someone
 * typed into it — so an edit survives a reload here and is simply absent on
 * the phone, which starts again from the user's figures. Every read and write
 * is guarded: a private window or blocked storage leaves the page on the
 * figures it was given, never broken.
 */

// v2 since migration 046: the accounts' ids changed ("livret" became
// "savings", and each declared savings account has its own), so an older
// draft would put the reader's savings under the wrong account.
const DRAFT_KEY = "pluclair.plan.long-view:v2:";
const SEEN_KEY = "pluclair.plan.milestone-seen:v1:";
const CHANGE_EVENT = "pluclair-plan-storage";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Storage refused: the page keeps working on what it has in memory.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/* ------------------------------------------------------------ long view */

export interface LongViewDraft {
  years: number;
  inflation: number;
  withdrawalRate: number;
  envelopes: Envelope[];
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Anything stored by an older build, or by hand, is read defensively — with
 * the phone's bounds (`readEnvelopes` in `apps/mobile/src/lib/plan-future-data.ts`).
 */
function parseDraft(raw: string | null): LongViewDraft | null {
  if (!raw) {
    return null;
  }
  try {
    const stored = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(stored.envelopes)) {
      return null;
    }
    const envelopes = stored.envelopes.flatMap((entry): Envelope[] => {
      const id = (entry as { id?: unknown } | null)?.id;
      if (!ENVELOPE_ORDER.includes(id as EnvelopeId)) {
        return [];
      }
      const row = entry as Record<string, unknown>;
      return [
        {
          id: id as EnvelopeId,
          initial: Math.max(0, finite(row.initial, 0)),
          monthly: Math.max(0, finite(row.monthly, 0)),
          annualReturn: finite(row.annualReturn, 0),
          taxOnGains: Math.min(1, Math.max(0, finite(row.taxOnGains, 0))),
        },
      ];
    });
    return {
      years: Math.min(40, Math.max(1, Math.round(finite(stored.years, 20)))),
      inflation: finite(stored.inflation, 0.02),
      withdrawalRate: finite(stored.withdrawalRate, 0.04),
      envelopes,
    };
  } catch {
    return null;
  }
}

/** The reader's edited long view, or null while they have not touched it. */
export function useLongViewDraft(userId: string): LongViewDraft | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(DRAFT_KEY + userId),
    () => null,
  );
  return useMemo(() => parseDraft(raw), [raw]);
}

export function saveLongViewDraft(userId: string, draft: LongViewDraft): void {
  write(DRAFT_KEY + userId, JSON.stringify(draft));
}

export function clearLongViewDraft(userId: string): void {
  write(DRAFT_KEY + userId, null);
}

/* ------------------------------------------------------------ milestones */

/**
 * The highest milestone celebrated before this page load, read once per
 * account.
 *
 * Read once rather than live, because the page writes the new one as soon as
 * it has shown it: a live read would take the "new" badge away on the next
 * render, a second after it appeared.
 */
const seenAtLoad = new Map<string, number | null>();

function seenSnapshot(userId: string): number | null {
  if (!seenAtLoad.has(userId)) {
    const raw = read(SEEN_KEY + userId);
    const value = raw === null ? NaN : Number(raw);
    seenAtLoad.set(userId, Number.isFinite(value) ? value : null);
  }
  return seenAtLoad.get(userId) ?? null;
}

/** The milestone last celebrated, or null on a first visit. Undefined on the server. */
export function useSeenMilestone(userId: string): number | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => seenSnapshot(userId),
    () => undefined,
  );
}

export function rememberMilestone(userId: string, amount: number): void {
  try {
    window.localStorage.setItem(SEEN_KEY + userId, String(amount));
  } catch {
    // Celebrated twice is the worst that can happen.
  }
}
