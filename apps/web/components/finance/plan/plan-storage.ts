"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ENVELOPE_ORDER,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
import {
  parseYearAheadSettings,
  YEAR_AHEAD_DEFAULT_SETTINGS,
  type YearAheadSettings,
} from "@finance/core/year-ahead";

/**
 * What the Plan page remembers in this browser: the reader's own version of
 * the long view, and how they left the year ahead. The milestone already celebrated is the account's, not the
 * browser's (`user_preferences.milestone_seen`), so every device agrees.
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
          // Absent in a draft saved before fees: the known ones fill it.
          ...(typeof row.fees === "number" && Number.isFinite(row.fees)
            ? { fees: Math.min(0.05, Math.max(0, row.fees)) }
            : {}),
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

/* ------------------------------------------------------------ year ahead */

const YEAR_AHEAD_KEY = "pluclair.plan.year-ahead:v1:";

/**
 * How the reader last left the year ahead: its window, where « Et si… »
 * goes, the accounts taken out, the events added. The extra itself is not
 * kept: it is something to play with, and a figure that opens inflated by
 * last week's play would be one nobody trusts.
 */
export function useYearAheadSettings(userId: string): YearAheadSettings {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(YEAR_AHEAD_KEY + userId),
    () => null,
  );
  return useMemo(() => {
    if (!raw) {
      return YEAR_AHEAD_DEFAULT_SETTINGS;
    }
    try {
      return parseYearAheadSettings(JSON.parse(raw));
    } catch {
      return YEAR_AHEAD_DEFAULT_SETTINGS;
    }
  }, [raw]);
}

export function saveYearAheadSettings(
  userId: string,
  settings: YearAheadSettings,
): void {
  write(YEAR_AHEAD_KEY + userId, JSON.stringify(settings));
}
