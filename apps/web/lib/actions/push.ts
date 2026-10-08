"use server";

import { z } from "zod";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@finance/data/errors";
import type { ActionResult } from "@finance/core/action-result";
import type { NotificationKind } from "@finance/core/notification-kinds";
import * as preferences from "@finance/data/preferences";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(400),
  auth: z.string().min(1).max(400),
  userAgent: z.string().max(400).optional(),
});

/**
 * Records a browser as a place to send notifications.
 *
 * Upserted on the endpoint: a browser that re-subscribes — which it does
 * whenever the push service rotates its key — must replace its row rather
 * than leave a dead one behind and add a second.
 */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return { error: dbError(error) };
  }
  return { success: true };
}

/** Forgets one browser. Called when the user turns notifications off. */
export async function deletePushSubscription(
  endpoint: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return { error: dbError(error) };
  }
  return { success: true };
}

/** Whether this browser's endpoint is already known, for the toggle's state. */
export async function isPushSubscribed(endpoint: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) {
    return false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();

  return data !== null;
}

/** Turn one kind of notification on or off, for the account. */
/** « Mesure d'audience »: count this account in the audience figures, or not. */
export async function setAudienceMeasurement(
  wanted: boolean,
): Promise<ActionResult> {
  if (typeof wanted !== "boolean") {
    return { error: "errors.invalidInput" };
  }
  const locale = await getLocale();
  return asUser((db, userId) =>
    preferences.setAudienceMeasurement(db, userId, wanted, locale),
  );
}

export async function setNotificationPref(
  kind: NotificationKind,
  wanted: boolean,
): Promise<ActionResult> {
  if (typeof wanted !== "boolean") {
    return { error: "errors.invalidInput" };
  }
  const locale = await getLocale();
  return asUser((db, userId) =>
    preferences.setNotificationPref(db, userId, kind, wanted, locale),
  );
}
