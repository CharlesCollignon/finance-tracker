"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";
import { translator, type Translate } from "@finance/core/i18n/t";

/**
 * The language, for the half of the app that runs in the browser.
 *
 * A context seeded from the server rather than a `useSyncExternalStore` over
 * storage, which is how the currency and the privacy blur work. The
 * difference matters: those two are read after hydration and a wrong first
 * paint is a flicker on one figure, whereas the language decides every word
 * on the page. Reading it on the client would mean the server renders English,
 * the browser corrects it, and the entire page changes under the reader.
 * Seeded from the cookie the server already read, the first paint is right.
 *
 * The cost is that changing language is a server round trip — the action
 * writes the cookie and revalidates — rather than an event on the window.
 * That is the correct price: the new language has to come from the server
 * anyway, because the server components hold most of the strings.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

/** The language this tree is rendering in. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The client-side counterpart of `getT`. */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}
