import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { formatCurrency, type CurrencyCode } from "@finance/core/constants";

import { loadCurrency, saveCurrency } from "@/lib/currency";
import { useLocale } from "@/providers/LocaleProvider";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  format: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("EUR");
  const locale = useLocale();

  useEffect(() => {
    void loadCurrency().then(setCurrencyState);
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    void saveCurrency(next);
  }, []);

  // The two preferences do different jobs: the currency changes which symbol
  // a figure carries without converting it, the language changes where that
  // symbol sits and which separators the digits take.
  const format = useCallback(
    (amount: number) => formatCurrency(amount, currency, locale),
    [currency, locale],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, format }),
    [currency, setCurrency, format],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}

/** Drop-in replacement for `formatEuro` that reads the current display currency. */
export function useFormatCurrency(): (amount: number) => string {
  return useCurrency().format;
}
