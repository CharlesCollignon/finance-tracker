import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import {
  breakdownAccounts,
  ENVELOPE_SHORT_KEYS,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
import type { Key } from "@finance/core/i18n/t";
import type {
  YearAheadAccountId,
  YearAheadEventKind,
} from "@finance/core/year-ahead";

import { COLORS } from "@/theme/tokens";

import { SHARE_COLORS } from "./AccountsBreakdown";

/**
 * What the year ahead's pieces share on the phone: each account's colour and
 * name, the events' icons and words, and the two ways things move — the
 * web's `year-ahead-parts.tsx`, in Reanimated's terms.
 */

/** Paths and bars morphing to their next shape: the web's 550ms. */
export const MORPH_MS = 550;

/** Something following the finger: quick, and settled. */
export const FOLLOW = { damping: 22, stiffness: 320, mass: 0.6 } as const;

/** The current account is the ink at 85 %, brighter than the CTO's warm grey. */
const CURRENT_COLOR = `${COLORS.foreground}D9`;
/** « Autre épargne », and anything past four accounts: the long view's "Autres". */
const OTHERS_COLOR = `${COLORS.mutedForeground}8C`;

/**
 * Decided from what each account holds plus a year of what goes in, so the
 * colours do not trade places when the window changes. The web decides it
 * the same way.
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
    return slot === -1 ? OTHERS_COLOR : SHARE_COLORS[slot]!;
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

export const EVENT_NAME_KEYS: Record<YearAheadEventKind, Key> = {
  raise: "futurePlan.eventRaise",
  bonus: "futurePlan.eventBonus",
  expense: "futurePlan.eventExpense",
};

export const EVENT_LINE_KEYS: Record<YearAheadEventKind, Key> = {
  raise: "futurePlan.eventRaiseLine",
  bonus: "futurePlan.eventBonusLine",
  expense: "futurePlan.eventExpenseLine",
};

export const EVENT_ICONS: Record<
  YearAheadEventKind,
  ComponentProps<typeof Ionicons>["name"]
> = {
  raise: "trending-up",
  bonus: "gift",
  expense: "bag-handle",
};

/** A raise or a bonus in the accent's ink; an expense in the warning red. */
export function eventTone(kind: YearAheadEventKind): string {
  return kind === "expense" ? COLORS.destructive : COLORS.primaryInk;
}
