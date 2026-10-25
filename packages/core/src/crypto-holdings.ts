import { INTL_LOCALES, type Locale } from "./i18n/locale";
import { matchWalletId, type InvestmentWalletId } from "./investments";

export const BITCOIN_INSTRUMENT = {
  symbol: "BTC-EUR",
  name: "Bitcoin",
} as const;

/**
 * Whether a market symbol is Bitcoin's, in any currency ("BTC-EUR",
 * "BTC-USD", "BTC"): the apps draw it with the app's own Bitcoin mark rather
 * than the logo CDN's.
 */
export function isBitcoinSymbol(symbol: string | null): boolean {
  return symbol !== null && /^BTC(-[A-Z]{3})?$/i.test(symbol.trim());
}

export function isCryptoWallet(walletId: InvestmentWalletId): boolean {
  return walletId === "crypto";
}

export function isCryptoCategoryName(categoryName: string): boolean {
  return matchWalletId(categoryName) === "crypto";
}

export function formatBtcAmount(amount: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(amount);

  return `${formatted} BTC`;
}
