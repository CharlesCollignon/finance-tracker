import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmRedirect } from "@/lib/auth/next-path";

/**
 * Where a password-reset email lands.
 *
 * The email carries a one-time token hash rather than a PKCE code, so the
 * link works in any browser on any device — including one that never asked
 * for it, which is where people usually read their mail. Verifying it signs
 * the reader in for this one purpose; the next page asks for the new
 * password.
 *
 * Needs the Supabase "Reset password" email template to link here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/new
 * Until it does, links still arrive through /auth/callback, which forwards
 * to the same page when opened in the browser that asked.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  let verified = false;
  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    verified = !error;
    if (error) {
      console.error("Recovery link could not be verified", error.message);
    }
  }

  return NextResponse.redirect(
    `${origin}${confirmRedirect({ verified, next: searchParams.get("next") })}`,
  );
}
