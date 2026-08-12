import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Request-scoped auth user (deduped across RSC/actions in one render). */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
