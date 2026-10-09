import type { CurrencyCode } from "@finance/core/constants";

/**
 * The display currency, kept in a cookie so the server renders the figures
 * with the right symbol from the first paint (`lib/currency.ts`), and the
 * browser reads the same value after it (`lib/use-currency.ts`).
 */
export const CURRENCY_COOKIE = "pluclair-currency";

/** A year, like the language's cookie. */
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Euro unless the value says dollars: anything else is the default. */
export function parseCurrency(value: string | null | undefined): CurrencyCode {
  return value === "USD" ? "USD" : "EUR";
}
