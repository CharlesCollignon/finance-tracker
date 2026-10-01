import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, getSiteUrl } from "@/lib/supabase/env";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { syncLocaleFromPreferences } from "@/lib/locale-cookies";
import { getLocale } from "@/lib/locale";
import {
  callbackFailureRedirect,
  sanitizeNextPath,
} from "@/lib/auth/next-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"), "/bearing");

  if (code) {
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Said in the server log, because the page can only say "the link
      // expired": a missing PKCE verifier cookie, a code already used and a
      // redirect URL Supabase does not allow all end on the same screen.
      console.error(
        `[auth/callback] code exchange failed: ${error.code ?? error.name} — ${error.message}`,
      );
    }

    if (!error && data.user) {
      try {
        await seedDefaultCategories(data.user.id, await getLocale());
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
        await syncLocaleFromPreferences(
          supabase,
          data.user.id,
          await getLocale(),
        );
      } catch (localeError) {
        // Never block sign-in on this either. The cookie the proxy negotiated
        // is still there, so the worst case is the browser's guess for one
        // more session.
        console.error("Failed to sync locale preference", localeError);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (!code) {
    // Supabase sends the reason back in the address instead of a code when
    // the provider or its own settings refused the sign-in.
    console.error(
      `[auth/callback] no code: ${searchParams.get("error_code") ?? searchParams.get("error") ?? "none"} — ${searchParams.get("error_description") ?? "no description"}`,
    );
  }

  return NextResponse.redirect(
    `${getSiteUrl()}${callbackFailureRedirect(next)}`,
  );
}
