import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { syncLocaleFromPreferences } from "@/lib/locale-cookies";
import { getLocale } from "@/lib/locale";

/**
 * What follows a sign-in that arrived through a link — Google's callback, or
 * the confirmation e-mail of a new account — before the reader is sent on.
 *
 * Neither step may block the sign-in: each failure is logged and the reader
 * goes on regardless.
 */
export async function afterLinkSignIn(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  try {
    await seedDefaultCategories(userId, await getLocale());
  } catch (seedError) {
    // Never block sign-in on seeding; retried on next sign-in.
    console.error("Failed to seed default categories", seedError);
  }
  try {
    // Sign-in is the first moment the app knows who is reading, and so
    // the first moment a stored language beats the browser's guess.
    // Somebody who chose French on their phone opens the web app on an
    // English laptop and gets French, without hunting for the setting a
    // second time.
    await syncLocaleFromPreferences(supabase, userId, await getLocale());
  } catch (localeError) {
    // Never block sign-in on this either. The cookie the proxy negotiated
    // is still there, so the worst case is the browser's guess for one
    // more session.
    console.error("Failed to sync locale preference", localeError);
  }
}
