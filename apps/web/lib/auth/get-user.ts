import { cache } from "react";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

/** Request-scoped auth user (deduped across RSC/actions in one render). */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Whether the visitor has an account of their own signed in. The demo
 * session (migration 081) is not one: the site keeps offering it « Commencer »
 * and « Se connecter », which end the demo (see `updateSession`).
 */
export async function hasOwnAccount(): Promise<boolean> {
  const user = await getAuthUser();
  return Boolean(user) && !isDemoUser(user);
}
