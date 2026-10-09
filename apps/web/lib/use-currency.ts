"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { formatCurrency, type CurrencyCode } from "@finance/core/constants";
import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_MAX_AGE,
  parseCurrency,
} from "@/lib/currency-cookie";
import { useLocale } from "@/lib/locale-context";

const CURRENCY_CHANGE_EVENT = "app-currency-change";
/** Where the choice was kept before the cookie, read once to move it over. */
const LEGACY_STORAGE_KEY = "currency";

// A change in this page announces itself; one made in another tab is read
// when this one is back in front.
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CURRENCY_CHANGE_EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CURRENCY_CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

function cookieValue(): string | null {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CURRENCY_COOKIE}=`));
  return entry ? entry.slice(CURRENCY_COOKIE.length + 1) : null;
}

function readCurrency(): CurrencyCode {
  return parseCurrency(cookieValue());
}

function writeCookie(currency: CurrencyCode): void {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE}; samesite=lax`;
}

/** The currency the server rendered with, for the first paint to agree. */
const CurrencyContext = createContext<CurrencyCode>("EUR");

/**
 * Seeded from the cookie the server read (`getCurrency`), as the language
 * is: the server renders the reader's symbol and hydration agrees with it.
 * A choice kept in this browser's storage before the cookie existed is moved
 * into the cookie once.
 */
export function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (cookieValue() !== null) {
      return;
    }
    try {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy === "USD") {
        setCurrencyPreference("USD");
      }
    } catch {
      // Storage refused: the cookie stays unset, which is euro.
    }
  }, []);

  return createElement(CurrencyContext.Provider, { value: currency }, children);
}

/** Current display currency, reactive to a change made anywhere on the page. */
export function useCurrency(): CurrencyCode {
  const seeded = useContext(CurrencyContext);
  return useSyncExternalStore(subscribe, readCurrency, () => seeded);
}

export function setCurrencyPreference(currency: CurrencyCode): void {
  writeCookie(currency);
  window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT));
}

/**
 * Drop-in replacement for `formatEuro` that reads the current display
 * currency and the current language.
 *
 * The one seam almost every figure in the app goes through, which is why the
 * locale is added here rather than at thirty call sites. Note that the two
 * preferences do different jobs: the currency changes which symbol a figure
 * carries without converting it, the locale changes where that symbol sits
 * and which separators the digits take.
 */
export function useFormatCurrency(): (amount: number) => string {
  const currency = useCurrency();
  const locale = useLocale();
  return useCallback(
    (amount: number) => formatCurrency(amount, currency, locale),
    [currency, locale],
  );
}
