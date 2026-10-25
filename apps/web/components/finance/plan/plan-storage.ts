"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ENVELOPE_ORDER,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
import {
  TRAJECTORY_DEFAULT_YEARS,
  TRAJECTORY_YEARS,
  type TrajectoryYears,
} from "@finance/core/history/plan-accounts";
import type { YearAheadAccountId } from "@finance/core/year-ahead";

/**
 * What the Plan page remembers in this browser: how the reader left the
 * trajectory, and what they changed in « Hypothèses ». The milestone already
 * celebrated is the account's, not the browser's
 * (`user_preferences.milestone_seen`), so every device agrees.
 *
 * This browser's only, and a convenience rather than a record: nothing the
 * app reports elsewhere rests on what someone typed into « Hypothèses », so
 * an edit survives a reload here and is simply absent on the phone. Every
 * read and write is guarded: a private window or blocked storage leaves the
 * page on the figures it was given, never broken.
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

function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/* ------------------------------------------------------------ trajectory */

export interface TrajectorySettings {
  years: TrajectoryYears;
  /** Where « Et si… » goes; null for the default. */
  to: YearAheadAccountId | null;
  /** Whether the homes' net value joins the line. */
  withProperty: boolean;
}

const DEFAULT_TRAJECTORY: TrajectorySettings = {
  years: TRAJECTORY_DEFAULT_YEARS,
  to: null,
  withProperty: false,
};

/**
 * How the reader last left the trajectory. The extra itself is not kept:
 * it is something to play with, and a figure that opens inflated by last
 * week's play would be one nobody trusts.
 */
export function useTrajectorySettings(userId: string): TrajectorySettings {
  const raw = useStored(TRAJECTORY_KEY + userId);
  return useMemo(() => {
    if (!raw) {
      return DEFAULT_TRAJECTORY;
    }
    try {
      const stored = JSON.parse(raw) as Record<string, unknown>;
      const years = TRAJECTORY_YEARS.find((each) => each === stored.years);
      return {
        years: years ?? TRAJECTORY_DEFAULT_YEARS,
        to:
          typeof stored.to === "string"
            ? (stored.to as YearAheadAccountId)
            : null,
        withProperty: stored.withProperty === true,
      };
    } catch {
      return DEFAULT_TRAJECTORY;
    }
  }, [raw]);
}

export function saveTrajectorySettings(
  userId: string,
  settings: TrajectorySettings,
): void {
  write(TRAJECTORY_KEY + userId, JSON.stringify(settings));
}

/* ------------------------------------------------------------ hypotheses */

/** What the reader changed on one account; anything absent is their figure. */
export type EnvelopeEdit = Partial<
  Pick<Envelope, "initial" | "monthly" | "fees" | "taxOnGains" | "annualReturn">
>;

export type HypothesesEdits = Partial<Record<EnvelopeId, EnvelopeEdit>>;

/**
 * Anything stored by an older build, or by hand, is read defensively, with
 * the long view's old bounds.
 */
function parseEdits(raw: string | null): HypothesesEdits {
  if (!raw) {
    return {};
  }
  try {
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const edits: HypothesesEdits = {};
    for (const id of ENVELOPE_ORDER) {
      const row = stored[id] as Record<string, unknown> | undefined;
      if (!row || typeof row !== "object") {
        continue;
      }
      const edit: EnvelopeEdit = {};
      const initial = finite(row.initial);
      const monthly = finite(row.monthly);
      const fees = finite(row.fees);
      const tax = finite(row.taxOnGains);
      const annualReturn = finite(row.annualReturn);
      if (initial !== undefined) edit.initial = Math.max(0, initial);
      if (monthly !== undefined) edit.monthly = Math.max(0, monthly);
      if (fees !== undefined) edit.fees = Math.min(0.05, Math.max(0, fees));
      if (tax !== undefined) edit.taxOnGains = Math.min(1, Math.max(0, tax));
      if (annualReturn !== undefined) {
        edit.annualReturn = Math.min(0.3, Math.max(-0.2, annualReturn));
      }
      if (Object.keys(edit).length > 0) {
        edits[id] = edit;
      }
    }
    return edits;
  } catch {
    return {};
  }
}

export function useHypothesesEdits(userId: string): HypothesesEdits {
  const raw = useStored(HYPOTHESES_KEY + userId);
  return useMemo(() => parseEdits(raw), [raw]);
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

/** The reader's figures with their edits laid over, return aside. */
export function withEdits(
  envelopes: readonly Envelope[],
  edits: HypothesesEdits,
): Envelope[] {
  return envelopes.map((envelope) => {
    const edit = edits[envelope.id];
    if (!edit) {
      return envelope;
    }
    // The return is not a figure to lay over: it shifts history instead.
    return {
      ...envelope,
      initial: edit.initial ?? envelope.initial,
      monthly: edit.monthly ?? envelope.monthly,
      taxOnGains: edit.taxOnGains ?? envelope.taxOnGains,
      ...(edit.fees !== undefined ? { fees: edit.fees } : {}),
    };
  });
}

/** The returns the reader typed, account by account. */
export function typedReturns(
  edits: HypothesesEdits,
): Partial<Record<EnvelopeId, number>> {
  const returns: Partial<Record<EnvelopeId, number>> = {};
  for (const [id, edit] of Object.entries(edits) as [
    EnvelopeId,
    EnvelopeEdit,
  ][]) {
    if (edit.annualReturn !== undefined) {
      returns[id] = edit.annualReturn;
    }
  }
  return returns;
}
