import { NextResponse } from "next/server";
import { isDemoUser } from "@/lib/demo";
import { demoCredentials } from "@/lib/demo-env";
import { createClient } from "@/lib/supabase/server";

/**
 * « Essayer la démo »: signs the visitor in as the demo account (migration
 * 081) and opens Le point. Someone already signed in with an account of
 * their own is sent to the app as themselves, never signed out for a
 * sample. Without `DEMO_EMAIL` and `DEMO_PASSWORD` there is no demo, and
 * the link leads to signing up.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const credentials = demoCredentials();
  if (!credentials) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && !isDemoUser(user)) {
    return NextResponse.redirect(new URL("/bearing", request.url));
  }
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    console.error("[demo] sign-in refused:", error.message);
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.redirect(new URL("/bearing", request.url));
}
