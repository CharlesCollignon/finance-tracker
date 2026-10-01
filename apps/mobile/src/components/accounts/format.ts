import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

/**
 * A savings rate: two decimals at most, since the CEL pays 1.25% and one
 * decimal would round it to a rate it does not pay.
 */
export function formatRate(rate: number, locale: Locale): string {
  return translator(locale)("units.percent", {
    value: new Intl.NumberFormat(INTL_LOCALES[locale], {
      maximumFractionDigits: 2,
    }).format(rate * 100),
  });
}
