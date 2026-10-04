import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";
import { getAuthUser } from "@/lib/auth/get-user";
import { sessionFromBearer } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";

/**
 * Who is asking a route about their AI account: the phone, by the bearer it
 * presents, or the web, by its cookie — and a client acting as them, so row
 * level security applies either way.
 */
export async function aiRequester(
  request: Request,
): Promise<{ userId: string; client: SupabaseClient<Database> } | null> {
  const bearer = await sessionFromBearer(request);
  if (bearer) {
    return { userId: bearer.userId, client: bearer.supabase };
  }
  const user = await getAuthUser();
  return user ? { userId: user.id, client: await createClient() } : null;
}
