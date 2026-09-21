import type { CategoryType } from "@finance/core/types/database";

/**
 * Which way the money went, as a character in front of the figure.
 *
 * Amounts are stored positive and rendered unsigned, so on a row whose only
 * other cue was `TYPE_AMOUNT_CLASS` the difference between "€1,200 arrived"
 * and "€1,200 left" was green against salmon and nothing else. Colour on its
 * own is not a channel — a deuteranopic reader sees one figure either way —
 * and the surface that failed this hardest was the ledger, the screen this
 * app is used on most.
 *
 * This is not the Semantic Amount Rule loosened. It is the split
 * `FulfilmentDot` already makes for its 8px dot: the colour says what *kind*
 * of money this is — income, expense, savings, investment — and the sign says
 * which way it went. Two channels carrying two different facts, and neither
 * standing in for the other. Nothing here colours an amount by sign, and no
 * fifth category colour is invented.
 *
 * U+2212 MINUS SIGN and not a hyphen, matching the ledger's day header and
 * the calendar's day cells: in front of a figure set in tabular numerals a
 * hyphen is a dash at the wrong width and the wrong height.
 */
export function amountSign(type: CategoryType): "+" | "−" {
  return type === "income" ? "+" : "−";
}
