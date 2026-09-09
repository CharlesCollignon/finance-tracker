import {
  FULFILMENT_DOT_CLASS,
  type FulfilmentState,
} from "@finance/core/fulfilment-state";

import { cn } from "@/lib/utils";

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
 * pills in this row, so a pill here would read as one more of those. And the
 * row is dense enough already: at 8px this sits inside the space between the
 * name and its note without taking a column.
 *
 * The colour is never the whole message. Every caller also puts the state into
 * the row's subtitle as a word, because the amount beside it is already
 * coloured by category type — green for income, red for expense — and a reader
 * has no way to know which scheme a given colour belongs to. The dot is what
 * makes the row scannable; the word is what makes it legible.
 */
export function FulfilmentDot({ state, className }: FulfilmentDotProps) {
  if (!state) {
    return null;
  }

  return (
    <span
      // Decorative: the word in the subtitle is what a screen reader reads.
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        FULFILMENT_DOT_CLASS[state],
        className,
      )}
    />
  );
}
