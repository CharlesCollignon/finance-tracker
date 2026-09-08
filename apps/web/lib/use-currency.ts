"use client";

import { useCallback, useSyncExternalStore } from "react";
import { formatCurrency, type CurrencyCode } from "@finance/core/constants";
import { useLocale } from "@/lib/locale-context";

const CURRENCY_CHANGE_EVENT = "app-currency-change";
const STORAGE_KEY = "currency";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CURRENCY_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CURRENCY_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getCurrency(): CurrencyCode {
  return window.localStorage.getItem(STORAGE_KEY) === "USD" ? "USD" : "EUR";
}

function getServerSnapshot(): CurrencyCode {
  return "EUR";
}

/** Current display currency, reactive to changes from any tab/component. */
export function useCurrency(): CurrencyCode {
  return useSyncExternalStore(subscribe, getCurrency, getServerSnapshot);
}

export function setCurrencyPreference(currency: CurrencyCode): void {
  window.localStorage.setItem(STORAGE_KEY, currency);
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
