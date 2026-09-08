import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, getSiteUrl } from "@/lib/supabase/env";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { syncLocaleFromPreferences } from "@/lib/locale-cookies";
import { getLocale } from "@/lib/locale";

function sanitizeNextPath(raw: string | null): string {
  // Only allow same-origin relative paths ("/foo"), never "//host" or
  // absolute URLs, to prevent open redirects.
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
  ) {
    return raw;
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

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

    if (!error && data.user) {
      try {
        await seedDefaultCategories(data.user.id);
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

  return NextResponse.redirect(`${getSiteUrl()}/login?error=auth_callback`);
}
