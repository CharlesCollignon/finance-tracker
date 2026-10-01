import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import type { InvestmentWalletId } from "@finance/core/investments";
import { SAVINGS_KINDS } from "@finance/core/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";

/** An account Placements keeps: a savings account, or a wallet. */
export type AccountId = SavingsAccountKind | InvestmentWalletId;

export function isSavingsKind(id: AccountId): id is SavingsAccountKind {
  return SAVINGS_KINDS.includes(id as SavingsAccountKind);
}

/** "Livret A", "PEA", "Assurance vie". */
export function accountShortName(id: AccountId, locale: Locale): string {
  return translator(locale)(ENVELOPE_SHORT_KEYS[id]);
}

/**
 * A yearly rate, to two decimals: 0.0125 → "1,25 %". Regulated rates move by
 * quarter points, so the one decimal the app's other percentages keep would
 * show a CEL at 1,3 %.
 */
export function formatRate(rate: number, locale: Locale): string {
  const value = new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 2,
  }).format(rate * 100);
  return translator(locale)("units.percent", { value });
}

/** A rate as a field shows it, without the sign: 0.0125 → "1,25". */
export function rateToInput(rate: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(rate * 100);
}
