"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  formatCurrency,
  type CurrencyCode,
} from "@finance/core/constants";

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

/** Drop-in replacement for `formatEuro` that reads the current display currency. */
export function useFormatCurrency(): (amount: number) => string {
  const currency = useCurrency();
  return useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );
}
