"use client";

import {
  breakdownAccounts,
  ENVELOPE_SHORT_KEYS,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
import type { YearAheadAccountId } from "@finance/core/year-ahead";
import type { Key } from "@finance/core/i18n/t";

/**
 * Each account's colour and name, as the site's Plan mock and demo draw them
 * until they are redrawn from the replay (Phase 5 of the Plan's redesign).
 */

/**
 * The accounts' colours: the long view's chart tokens, in the long view's
 * order, so an account wears the same colour in both cards. The current
 * account is the ink, quieter; anything past four accounts, and what is set
 * aside with no account, the long view's muted "Others". Never the accent,
 * which on this page is the figure's and a milestone's.
 */
const ENVELOPE_COLORS = [
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
] as const;
const CURRENT_COLOR = "color-mix(in oklab, var(--foreground) 85%, transparent)";
const OTHERS_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 45%, transparent)";

/**
 * Decided from what each account holds plus a year of what goes in, so the
 * colours do not trade places when the window changes.
 */
export function accountColors(
  envelopes: readonly Envelope[],
): (id: YearAheadAccountId) => string {
  const named = breakdownAccounts(
    envelopes.map((envelope) => ({
      id: envelope.id,
      netValue: envelope.initial + envelope.monthly * 12,
    })),
  );
  return (id) => {
    if (id === "current") {
      return CURRENT_COLOR;
    }
    const slot = named.indexOf(id as EnvelopeId);
    return slot === -1 ? OTHERS_COLOR : ENVELOPE_COLORS[slot]!;
  };
}

export function accountNameKey(id: YearAheadAccountId): Key {
  if (id === "current") {
    return "futurePlan.accountCurrent";
  }
  if (id === "elsewhere") {
    return "futurePlan.accountElsewhere";
  }
  return ENVELOPE_SHORT_KEYS[id];
}
