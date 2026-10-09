"use client";

import type { ReactNode } from "react";
import { Gift, ShoppingBagOpen, TrendUp } from "@phosphor-icons/react";
import {
  breakdownAccounts,
  ENVELOPE_SHORT_KEYS,
  type Envelope,
  type EnvelopeId,
} from "@finance/core/future-plan";
import type {
  YearAheadAccountId,
  YearAheadEventKind,
} from "@finance/core/year-ahead";
import type { Key } from "@finance/core/i18n/t";
import { EASE_STANDARD } from "@finance/core/motion";

/**
 * What the year ahead's pieces share: each account's colour and name, the
 * events' icons and words, and the two ways things move on the card.
 */

/** Paths and bars morphing to their next shape: the system's one curve. */
export const MORPH = {
  duration: 0.55,
  ease: [...EASE_STANDARD] as [number, number, number, number],
};

/** Something following the pointer or the finger: quick, and settled. */
export const FOLLOW = {
  type: "spring",
  stiffness: 520,
  damping: 42,
  mass: 0.6,
} as const;

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

export function EventIcon({
  kind,
  size,
}: {
  kind: YearAheadEventKind;
  size: number;
}): ReactNode {
  switch (kind) {
    case "raise":
      return <TrendUp size={size} weight="bold" aria-hidden />;
    case "bonus":
      return <Gift size={size} weight="fill" aria-hidden />;
    case "expense":
      return <ShoppingBagOpen size={size} weight="fill" aria-hidden />;
  }
}
