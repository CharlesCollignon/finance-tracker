"use server";

import { revalidatePath } from "next/cache";
import { isLocale } from "@finance/core/i18n/locale";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { writeLocaleAsked, writeLocaleCookie } from "@/lib/locale-cookies";

type ActionResult = { error?: string; success?: boolean };

/**
 * Record the language somebody has chosen.
 *
 * Both places, in this order. The cookie is what the next request will read,
 * so it is set before the row and even if the row fails to write: being
 * answered in the wrong language is a worse outcome than a preference that
 * does not survive a new device, and the row can be written again from the
 * profile.
 *
 * Choosing a language also counts as answering the question the suggestion
 * banner asks, so the banner stops. A reader who has been to the setting has
 * plainly decided, and being asked afterwards reads as the app not listening.
 */
export async function setLocalePreference(
  locale: string,
): Promise<ActionResult> {
  if (!isLocale(locale)) {
    return { error: "Unsupported language" };
  }

  await writeLocaleCookie(locale);
  await writeLocaleAsked();

  const user = await getAuthUser();
  if (user) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, locale, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    if (error) {
      return { error: error.message };
    }
  }

  // Every rendered string depends on this, so nothing cached survives it.
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * The suggestion banner's "yes": switch, and stop asking.
 *
 * Separate from `setLocalePreference` only because a `<form action>` must
 * resolve to nothing, and the banner is a plain form so that it works before
 * any client JavaScript has loaded. There is nowhere on a banner to show a
 * failure — it is about to be replaced by the page it sits above — so a
 * failed write is logged and the language simply does not change, which is
 * the state the reader was already in.
 */
export async function acceptLocaleSuggestion(locale: string): Promise<void> {
  const result = await setLocalePreference(locale);
  if (result.error) {
    console.error("Failed to accept locale suggestion", result.error);
  }
}

/** The suggestion banner's "no thanks": stop asking, change nothing. */
export async function dismissLocaleSuggestion(): Promise<void> {
  await writeLocaleAsked();
  revalidatePath("/", "layout");
}
