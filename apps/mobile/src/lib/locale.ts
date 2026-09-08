import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";

import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "locale";

/**
 * What language the phone is set to, as far as the app has one for.
 *
 * `getLocales()` returns the device's preferences in order, so the first tag
 * the app has a catalogue for is the honest answer — somebody whose phone
 * lists Breton then French should be read to in French rather than in
 * English. Regioned tags come back here (`fr-FR`), which `parseLocale`
 * reduces to the language.
 */
export function deviceLocale(): Locale {
  for (const locale of Localization.getLocales()) {
    const parsed =
      parseLocale(locale.languageCode) ?? parseLocale(locale.languageTag);
    if (parsed) {
      return parsed;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * The country the phone thinks it is in.
 *
 * Read from the device's region setting rather than from an IP address,
 * because there is no edge in front of a phone to ask. It is the weaker
 * signal of the two — a region is a setting somebody chose once, where an IP
 * is where they are now — but it is the one available, and it only ever feeds
 * a banner the reader can decline.
 */
export function deviceCountry(): string | null {
  for (const locale of Localization.getLocales()) {
    if (locale.regionCode) {
      return locale.regionCode;
    }
  }
  return null;
}

/**
 * The stored choice, or null if there has never been one.
 *
 * Null rather than the default, because "never chosen" and "chose English"
 * are different states: the first should follow the phone's language, and the
 * second should not.
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
