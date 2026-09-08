import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";
import { translator, type Translate } from "@finance/core/i18n/t";

import { useAuth } from "@/providers/AuthProvider";
import {
  deviceLocale,
  fetchStoredLocale,
  loadLocale,
  pushStoredLocale,
  saveLocale,
} from "@/lib/locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * The language the phone reads the app in.
 *
 * Shaped like `CurrencyProvider` next door, with one difference that matters:
 * the language is settled in three steps rather than one, in order of who
 * knows best.
 *
 *   1. The phone's own language, synchronously, so the very first frame is in
 *      a plausible language rather than in English while storage is read.
 *   2. The choice stored on this device, which beats the phone's setting —
 *      somebody with a French phone who asked for English meant it.
 *   3. The choice stored against the account, which beats both, because it is
 *      the one they made most recently on any device. This arrives last
 *      because it needs the network, and it is the only step that can be
 *      absent.
 *
 * A user signing in with no row gets one, written from whatever this device
 * had settled on. An absent row means "never asked" rather than "wants
 * English", and the cron job cannot send tomorrow's digest in the right
 * language without one.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    void loadLocale().then((stored) => {
      if (stored) {
        setLocaleState(stored);
      }
    });
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const remote = await fetchStoredLocale(userId);
        if (cancelled) {
          return;
        }
        if (remote) {
          setLocaleState(remote);
          await saveLocale(remote);
        } else {
          // Adopt what this device settled on as the account's choice.
          await pushStoredLocale(userId, locale);
        }
      } catch {
        // Offline, or the migration has not been applied. Neither is worth
        // interrupting anybody over: the device's own answer still stands,
        // and this runs again on the next sign-in.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately keyed on the user alone. Re-running this when `locale`
    // changes would race `setLocale` below, which has already written both
    // places and does not need reconciling with itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      void saveLocale(next);
      if (userId) {
        void pushStoredLocale(userId, next);
      }
    },
    [userId],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t: translator(locale) }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

/** The language this tree is rendering in. */
export function useLocale(): Locale {
  return useLocaleContext().locale;
}

/** The counterpart of the web app's `useT`. */
export function useT(): Translate {
  return useLocaleContext().t;
}
