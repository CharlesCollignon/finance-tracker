import "server-only";

import { cookies } from "next/headers";
import {
  LOCALE_ASKED_COOKIE,
  LOCALE_COOKIE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";

/**
 * A year, which is longer than a session and shorter than forever.
 *
 * The stored row is the real answer for a signed-in user, so this cookie is a
 * cache and not a record — but it is also the only answer for somebody
 * reading the marketing pages, and asking them to pick a language again on
 * every visit would be worse than remembering it for a year.
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * `lax` and not `strict` because a link from an email or from the phone must
 * arrive in the language the reader chose, and `strict` would withhold the
 * cookie on exactly that first cross-site navigation. Not `httpOnly`: the
 * client reads it to know whether it is already in the right language.
 */
const COOKIE_OPTIONS = {
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  sameSite: "lax",
} as const;

/**
 * Kept out of the neighbouring `"use server"` module on purpose.
 *
 * Everything exported from a `"use server"` file becomes a callable endpoint.
 * "Set my locale cookie to this" is harmless as an endpoint and "sync my
 * cookie from the database" is not obviously so, and neither needs to be one.
 */
export async function writeLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, COOKIE_OPTIONS);
}

/**
 * Remember that the language question has been put, whichever way it was
 * answered.
 */
export async function writeLocaleAsked(): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_ASKED_COOKIE, "1", COOKIE_OPTIONS);
}

/**
 * Bring the cookie into line with what this user chose, wherever they chose it.
 *
 * Called once at sign-in, which is the moment the app first knows who is
 * reading and therefore the first moment the stored preference beats the
 * browser's guess. Somebody who set French on their phone and then opens the
 * web app on an English laptop gets French, and does not have to find the
 * setting a second time.
 *
 * With no row, the browser's guess is adopted as the choice and written down.
 * That is the honest reading of an absent row — it means "never asked", not
 * "wants English" — and it means the cron job has a locale to send tomorrow's
 * digest in without waiting for the user to visit a settings page.
 */
export async function syncLocaleFromPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
  negotiated: Locale,
): Promise<Locale> {
  const { data } = await supabase
    .from("user_preferences")
    .select("locale")
    .eq("user_id", userId)
    .maybeSingle();

  const stored = parseLocale(data?.locale);
  if (stored) {
    await writeLocaleCookie(stored);
    return stored;
  }

  await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      locale: negotiated,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  await writeLocaleCookie(negotiated);
  return negotiated;
}
