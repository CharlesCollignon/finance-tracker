import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "./i18n/locale";
import { matchWalletId, type InvestmentWalletId } from "./investments";

export const BITCOIN_INSTRUMENT = {
  symbol: "BTC-EUR",
  name: "Bitcoin",
} as const;

export function isCryptoWallet(walletId: InvestmentWalletId): boolean {
  return walletId === "crypto";
}

export function isCryptoCategoryName(categoryName: string): boolean {
  return matchWalletId(categoryName) === "crypto";
}

export function formatBtcAmount(
  amount: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const formatted = new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(amount);

  return `${formatted} BTC`;
}
