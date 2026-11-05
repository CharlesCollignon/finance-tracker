import type { CategoryType } from "@finance/core/types/database";

import type { COLORS } from "@/theme/tokens";

/**
 * The colour each kind of money already wears on every amount in the app —
 * the Semantic Amount Rule — lent to the Add sheet while that kind is being
 * entered: the figure, the chosen category, the field being filled.
 */
export const KIND_INK: Record<CategoryType, keyof typeof COLORS> = {
  expense: "destructive",
  income: "success",
  savings: "primary",
  investment: "info",
};

/** "#f87171" at an alpha, as the eight-digit hex React Native reads. */
export function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex.slice(0, 7)}${byte.toString(16).padStart(2, "0")}`;
}
