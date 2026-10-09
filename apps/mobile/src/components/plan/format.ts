import { useCallback } from "react";

import { formatMonthLabel, formatPercent } from "@finance/core/constants";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";

import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";

/** What an amount reads as under the privacy blur. */
export const MASK = "••••••";

/**
 * Amounts as the Plan shows them: whole euros, because these are estimates
 * and the cents of a figure twenty years out are noise.
 *
 * `whole` is for `AnimatedAmount` and `PrivateAmount`, which mask on their
 * own; `shown` is for an amount inside a sentence, which nothing else would.
 */
export function usePlanMoney() {
  const format = useFormatCurrency();
  const { hidden } = usePrivacy();
  const whole = useCallback(
    (value: number) => format(Math.round(value)),
    [format],
  );
  const shown = useCallback(
    (value: number) => (hidden ? MASK : whole(value)),
    [hidden, whole],
  );
  return { whole, shown, hidden };
}

/** The month `ahead` months after this one. */
export function monthAhead(
  year: number,
  month: number,
  ahead: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + ahead;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "mars 2027", for a milestone crossed `ahead` months from now. */
export function monthAheadLabel(
  year: number,
  month: number,
  ahead: number,
  locale: Locale,
): string {
  const at = monthAhead(year, month, ahead);
  return formatMonthLabel(at.year, at.month, locale);
}

/**
 * A fraction as the digits of a percentage, for a field: 0.186 → "18,6".
 * Two decimals for a fee, where 0,25 % is not 0,3 %.
 */
export function percentDigits(
  fraction: number,
  locale: Locale,
  decimals = 1,
): string {
  if (decimals === 1) {
    return formatPercent(Math.round(fraction * 1000) / 10, locale);
  }
  const factor = 10 ** decimals;
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: decimals,
  }).format(Math.round(fraction * 100 * factor) / factor);
}
