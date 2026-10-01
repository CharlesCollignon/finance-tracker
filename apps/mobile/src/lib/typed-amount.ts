import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";

/**
 * An amount as the reader would type it into a field: no grouping and the
 * locale's decimal mark — "1500,5" in French — so `parseTypedAmount` reads
 * back exactly what was put in. A balance asks for two decimals; a budget or
 * a goal shows none when it is whole.
 */
export function toTypedAmount(
  amount: number,
  locale: Locale,
  minimumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(amount);
}
