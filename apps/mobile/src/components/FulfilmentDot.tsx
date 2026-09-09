import { View } from "react-native";

import {
  FULFILMENT_DOT_CLASS,
  type FulfilmentState,
} from "@finance/core/fulfilment-state";

import { cn } from "@/lib/cn";

interface FulfilmentDotProps {
  /** Undefined for a row with nothing to say, which is most of them. */
  state: FulfilmentState | undefined;
  className?: string;
}

/**
 * What a ledger row says about its standing against a recurring charge.
 *
 * A dot rather than a badge, for two reasons. Real Tags — the domain kind, the
 * free-form labels a transaction carries for filtering — already render as
 * pills in this row on web, so a pill here would read as one more of those.
 * And the row is dense enough already: at 8px this sits inside the space
 * between the name and its note without taking a line.
 *
 * The colour is never the whole message. Every caller also puts the state into
 * the row's subtitle as a word and into `accessibilityHint`, because the
 * amount beside it is already coloured by category type — green for income,
 * red for expense — and a reader has no way to know which scheme a given
 * colour belongs to. The dot is what makes the row scannable; the word is what
 * makes it legible.
 */
export function FulfilmentDot({ state, className }: FulfilmentDotProps) {
  if (!state) {
    return null;
  }

  return (
    <View
      // Decorative: the word in the subtitle is what a screen reader reads,
      // and the hint on the row carries it too. A dot that announced itself
      // would say the same thing a third time.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        FULFILMENT_DOT_CLASS[state],
        className,
      )}
    />
  );
}
