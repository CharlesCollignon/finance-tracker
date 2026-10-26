/**
 * What the Plan remembers on a device — how the reader left the trajectory,
 * and what they changed in « Vos comptes » — read with one rule on the web
 * (localStorage) and the phone (AsyncStorage), so a setting means the same
 * on both.
 *
 * A convenience rather than a record: nothing the app reports elsewhere
 * rests on what someone typed into « Vos comptes ». Anything stored by an
 * older build, or by hand, is read defensively.
 */

import { ENVELOPE_ORDER, type Envelope, type EnvelopeId } from "../future-plan";
import {
  TRAJECTORY_DEFAULT_YEARS,
  TRAJECTORY_YEARS,
  type TrajectoryYears,
} from "./plan-accounts";

/* ------------------------------------------------------------ trajectory */

export interface TrajectorySettings {
  years: TrajectoryYears;
  /** Whether the homes' net value joins the line. */
  withProperty: boolean;
}

export const TRAJECTORY_DEFAULT_SETTINGS: TrajectorySettings = {
  years: TRAJECTORY_DEFAULT_YEARS,
  withProperty: false,
};

/** How the reader last left the trajectory. */
export function parseTrajectorySettings(raw: unknown): TrajectorySettings {
  if (!raw || typeof raw !== "object") {
    return TRAJECTORY_DEFAULT_SETTINGS;
  }
  const stored = raw as Record<string, unknown>;
  return {
    years:
      TRAJECTORY_YEARS.find((each) => each === stored.years) ??
      TRAJECTORY_DEFAULT_YEARS,
    withProperty: stored.withProperty === true,
  };
}

/* --------------------------------------------------------- the accounts */

/** What the reader changed on one account; anything absent is their figure. */
export type EnvelopeEdit = Partial<
  Pick<Envelope, "initial" | "monthly" | "fees" | "taxOnGains" | "annualReturn">
>;

export type PlanEdits = Partial<Record<EnvelopeId, EnvelopeEdit>>;

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** Each figure within the bounds its field allows. */
export function parsePlanEdits(raw: unknown): PlanEdits {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const stored = raw as Record<string, unknown>;
  const edits: PlanEdits = {};
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
}

/** The reader's figures with their edits laid over, return aside. */
export function withEdits(
  envelopes: readonly Envelope[],
  edits: PlanEdits,
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
  edits: PlanEdits,
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
