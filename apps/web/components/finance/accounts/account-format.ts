import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { SavingsAccountKind } from "@finance/core/types/database";

export { formatRate, isSavingsKind } from "@finance/core/savings-accounts";

/** An account Placements keeps: a savings account, or a wallet. */
export type AccountId = SavingsAccountKind | InvestmentWalletId;

/** "Livret A", "PEA", "Assurance vie". */
export function accountShortName(id: AccountId, locale: Locale): string {
  return translator(locale)(ENVELOPE_SHORT_KEYS[id]);
}

/** A rate as a field shows it, without the sign: 0.0125 → "1,25". */
export function rateToInput(rate: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(rate * 100);
}
