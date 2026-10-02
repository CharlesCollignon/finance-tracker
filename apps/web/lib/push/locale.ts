import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * What language each of these users reads in.
 *
 * Users with no row are simply absent from the map and fall back to the
 * default, which is the right reading of an absent row: it means nobody has
 * ever chosen, not that they chose English.
 *
 * Here rather than in one cron route, because both routes that push need it:
 * the bank sync's "to review" went out in English to everyone for as long as
 * only the daily digest knew how to ask.
 */
export async function readLocales(
  supabase: AdminClient,
  userIds: string[],
): Promise<Map<string, Locale>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase
    .from("user_preferences")
    .select("user_id, locale")
    .in("user_id", userIds);

  const byUser = new Map<string, Locale>();
  for (const row of (data ?? []) as { user_id: string; locale: string }[]) {
    const locale = parseLocale(row.locale);
    if (locale) {
      byUser.set(row.user_id, locale);
    }
  }
  return byUser;
}

/** One user's language, or the default when they never chose one. */
export async function readLocale(
  supabase: AdminClient,
  userId: string,
): Promise<Locale> {
  return (await readLocales(supabase, [userId])).get(userId) ?? DEFAULT_LOCALE;
}
