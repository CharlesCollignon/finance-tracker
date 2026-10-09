import AsyncStorage from "@react-native-async-storage/async-storage";
import { todayIsoLocal } from "@finance/core/constants";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";
import {
  parseWidgetFigure,
  widgetFace,
  type WidgetFace,
  type WidgetFigure,
} from "@finance/core/widget-figure";
import { readLeftToSpend } from "@finance/data/left-to-spend";
import { readMonthBalance } from "@finance/data/month-balance";

import { loadCurrency } from "@/lib/currency";
import { loadLocale } from "@/lib/locale";
import { loadPrivacyHidden } from "@/lib/privacy";
import {
  getFulfilledKeys,
  getMonthCloseOverview,
  getRecurringTemplates,
  hasBankFeed,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";

/**
 * « Il vous reste » for the Android widget (`@finance/core/widget-figure`):
 * read, kept on the phone, and turned into what the widget draws.
 *
 * The widget is drawn with no screen of the app open — by the app on its
 * way to the background, or by Android every half hour — so everything it
 * needs is in the phone's storage: the figure as last read, the privacy
 * blur, the language and the currency.
 */

const STORAGE_KEY = "widget-figure";

/** Long enough for a phone on a slow network, short of Android giving up. */
const READ_TIMEOUT_MS = 10_000;

/**
 * The figure, read as Le point reads it (`gatherHomeMonth`): the month in
 * progress, the person's own money — never their shared space's.
 */
async function readWidgetFigure(userId: string): Promise<WidgetFigure> {
  const today = todayIsoLocal();
  const locale = (await loadLocale()) ?? DEFAULT_LOCALE;
  const [templates, fulfilledKeys, closes, bankFed] = await Promise.all([
    getRecurringTemplates(userId),
    getFulfilledKeys(userId),
    getMonthCloseOverview(userId, today, locale),
    hasBankFeed(userId),
  ]);
  const { balance, upcoming } = await readMonthBalance(supabase, userId, {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
    today,
    templates,
    fulfilledKeys,
    closes,
    bankFed,
  });
  const left = await readLeftToSpend(supabase, userId, {
    today,
    read: { balance, upcoming },
    templates,
    fulfilledKeys,
    closes,
    bankFed,
  });
  return { left, readOn: today };
}

/** The figure kept for the widget; null forgets it — on signing out. */
async function storeWidgetFigure(
  figure: WidgetFigure | null,
): Promise<void> {
  if (figure === null) {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(figure));
  }
}

/**
 * Read the figure again for whoever is signed in on this phone, and keep
 * it; nobody signed in, and it is forgotten. A read that fails or takes too
 * long keeps the figure already there — the widget shows it only on the day
 * it was read, so a stale one fades to the ways in on its own.
 */
export async function rereadWidgetFigure(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  if (userId === null) {
    await storeWidgetFigure(null);
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const figure = await Promise.race([
      readWidgetFigure(userId),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), READ_TIMEOUT_MS);
      }),
    ]);
    await storeWidgetFigure(figure);
  } catch {
    // Kept as it was: see above.
  } finally {
    clearTimeout(timer);
  }
}

/** What the widget draws now, from what the phone keeps. */
export async function currentWidgetFace(): Promise<WidgetFace> {
  const [raw, hidden, locale, currency] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
    loadPrivacyHidden(),
    loadLocale(),
    loadCurrency(),
  ]);
  return widgetFace({
    figure: parseWidgetFigure(raw),
    today: todayIsoLocal(),
    hidden,
    locale: locale ?? DEFAULT_LOCALE,
    currency,
  });
}
