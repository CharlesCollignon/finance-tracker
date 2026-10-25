import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { afterLinkSignIn } from "@/lib/auth/after-link-sign-in";
import { confirmRedirect, signUpConfirmRedirect } from "@/lib/auth/next-path";

/**
 * Where a password-reset or sign-up confirmation email lands.
 *
 * The email carries a one-time token hash rather than a PKCE code, so the
 * link works in any browser on any device — including one that never asked
 * for it, which is where people usually read their mail, and always the case
 * for an account made on the phone. Verifying it signs the reader in: a reset
 * goes on to the new-password page, a new account to its setup.
 *
 * Needs the Supabase email templates to link here:
 *   Reset password:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/new
 *   Confirm signup:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/welcome
 * (`supabase/templates/`). Until they do, links still arrive through
 * /auth/callback, which only works when opened in the browser that asked.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  // "signup" is the older name Supabase still accepts for the same link.
  if (tokenHash && (type === "email" || type === "signup")) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (error) {
      console.error("Sign-up link could not be verified", error.message);
    }
    if (!error && data.user) {
      await afterLinkSignIn(supabase, data.user.id);
    }
    return NextResponse.redirect(
      `${origin}${signUpConfirmRedirect({ verified: !error, next })}`,
    );
  }

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
    `${origin}${confirmRedirect({ verified, next })}`,
  );
}
