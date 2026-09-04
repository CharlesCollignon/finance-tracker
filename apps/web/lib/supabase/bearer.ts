import { createClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * A client acting as whoever holds this access token.
 *
 * The web app authenticates from cookies, which the mobile app does not have:
 * it holds a Supabase session and can present the access token as a bearer.
 * So the token is verified, and then every query goes out carrying it — which
 * means row level security applies as that user, exactly as it does for a
 * cookie session. Deliberately not the service role: an endpoint the phone
 * can reach must not be able to read anyone but its caller.
 */
export interface BearerSession {
  userId: string;
  supabase: ReturnType<typeof createClient<Database>>;
}

/** The token from an `Authorization: Bearer <jwt>` header, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token?.trim()
    ? token.trim()
    : null;
}

/**
 * Null when the token is missing, malformed or expired — all of which are one
 * outcome as far as a caller is concerned: not authenticated.
 */
export async function sessionFromBearer(
  request: Request,
): Promise<BearerSession | null> {
  const token = bearerToken(request);
  if (!token) {
    return null;
  }

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Verified against the auth server rather than decoded here: a signature
  // this process did not check is not an identity.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  return error || !user ? null : { userId: user.id, supabase };
}
