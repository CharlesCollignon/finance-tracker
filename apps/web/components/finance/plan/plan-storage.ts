"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  parseHypothesesEdits,
  parseTrajectorySettings,
  type HypothesesEdits,
  type TrajectorySettings,
} from "@finance/core/history/plan-settings";

/**
 * What the Plan page remembers in this browser: how the reader left the
 * trajectory, and what they changed in « Hypothèses », read with the rule
 * the phone reads its own with (`@finance/core/history/plan-settings`). The
 * milestone already celebrated is the account's, not the browser's
 * (`user_preferences.milestone_seen`), so every device agrees.
 *
 * This browser's only, and a convenience rather than a record: an edit
 * survives a reload here and is simply absent on the phone. Every read and
 * write is guarded: a private window or blocked storage leaves the page on
 * the figures it was given, never broken.
 *
 * The keys before October 2026 — the long view's draft and the year ahead's
 * settings — are no longer read: their returns were presets, not history.
 */

const TRAJECTORY_KEY = "pluclair.plan.trajectory:v1:";
const HYPOTHESES_KEY = "pluclair.plan.hypotheses:v1:";
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

/** Stored text as JSON, or null when it is not. */
function parseJson(raw: string | null): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

/* ------------------------------------------------------------ trajectory */

export function useTrajectorySettings(userId: string): TrajectorySettings {
  const raw = useStored(TRAJECTORY_KEY + userId);
  return useMemo(() => parseTrajectorySettings(parseJson(raw)), [raw]);
}

export function saveTrajectorySettings(
  userId: string,
  settings: TrajectorySettings,
): void {
  write(TRAJECTORY_KEY + userId, JSON.stringify(settings));
}

/* ------------------------------------------------------------ hypotheses */

export function useHypothesesEdits(userId: string): HypothesesEdits {
  const raw = useStored(HYPOTHESES_KEY + userId);
  return useMemo(() => parseHypothesesEdits(parseJson(raw)), [raw]);
}

export function saveHypothesesEdits(
  userId: string,
  edits: HypothesesEdits,
): void {
  write(
    HYPOTHESES_KEY + userId,
    Object.keys(edits).length > 0 ? JSON.stringify(edits) : null,
  );
}
