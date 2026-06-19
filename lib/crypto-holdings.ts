import { resolveWalletId, type InvestmentWalletId } from "@/lib/investments";

export const BITCOIN_INSTRUMENT = {
  symbol: "BTC-EUR",
  name: "Bitcoin",
} as const;

export function isCryptoWallet(walletId: InvestmentWalletId): boolean {
  return walletId === "crypto";
}

export function isCryptoCategoryName(categoryName: string): boolean {
  return resolveWalletId(categoryName) === "crypto";
}

export function formatBtcAmount(amount: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(amount);

  return `${formatted} BTC`;
}
