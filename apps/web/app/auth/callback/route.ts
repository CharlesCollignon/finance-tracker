import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, getSiteUrl } from "@/lib/supabase/env";
import { seedDefaultCategories } from "@/lib/queries/categories";

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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${getSiteUrl()}/login?error=auth_callback`);
}
