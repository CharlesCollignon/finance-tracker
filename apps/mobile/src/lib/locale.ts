import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { parseLocale, type Locale } from "@finance/core/i18n/locale";

import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "locale";

/**
 * The first language the phone is set to that the app has a catalogue for,
 * or null when it has none of them.
 *
 * Not the language the app starts in — that is French until the reader
 * chooses (`DEFAULT_LOCALE`) — but what the banner reads to decide whether to
 * offer English (`suggestLocale`). `getLocales()` returns the device's
 * preferences in order, and regioned tags (`fr-FR`) reduce to the language.
 */
export function devicePreferredLocale(): Locale | null {
  for (const locale of Localization.getLocales()) {
    const parsed =
      parseLocale(locale.languageCode) ?? parseLocale(locale.languageTag);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

/**
 * The stored choice, or null if there has never been one.
 *
 * Null rather than the default, because "never chosen" and "chose English"
 * are different states: the first starts in French, and the second should
 * stay in English.
 */
export async function loadLocale(): Promise<Locale | null> {
  try {
    return parseLocale(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function saveLocale(locale: Locale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
}

/** The language this user chose on any of their devices, if they have. */
export async function fetchStoredLocale(
  userId: string,
): Promise<Locale | null> {
  const { data } = await supabase
    .from("user_preferences")
    .select("locale")
    .eq("user_id", userId)
    .maybeSingle();

  return parseLocale(data?.locale ?? null);
}

/**
 * Write the choice where the server can see it.
 *
 * The phone composes its own reminders on the device, so it could get by on
 * AsyncStorage alone. The digest the cron job sends could not: it is composed
 * on a server for somebody who is asleep, and this row is the only place it
 * can learn which language to write in.
 */
export async function pushStoredLocale(
  userId: string,
  locale: Locale,
): Promise<void> {
  await supabase
    .from("user_preferences")
    .upsert(
      { user_id: userId, locale, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}
