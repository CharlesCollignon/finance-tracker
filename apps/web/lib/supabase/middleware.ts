import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseRememberedMonth, MONTH_COOKIE } from "@finance/core/month-memory";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * The surfaces whose figures are about one month.
 *
 * Exactly the three that read `y` and `m`. `/history` is not among them: it
 * looks across months by category, so a month in its address would be a
 * parameter it ignores.
 */
const MONTH_SCOPED = ["/dashboard", "/transactions", "/calendar"];

/**
 * Where to send a month-scoped request that names no month, when one is
 * remembered. Null when there is nothing to do — which is the common case, so
 * it is the cheap path.
 */
function restoredMonthUrl(request: NextRequest): URL | null {
  const { pathname, searchParams } = request.nextUrl;

  if (!MONTH_SCOPED.some((path) => pathname === path)) {
    return null;
  }
  if (searchParams.has("y") && searchParams.has("m")) {
    return null;
  }

  const remembered = parseRememberedMonth(
    request.cookies.get(MONTH_COOKIE)?.value,
  );
  if (!remembered) {
    return null;
  }

  // Cloned rather than rebuilt, so anything else in the address — the budget
  // view, in practice — survives the restore.
  const url = request.nextUrl.clone();
  url.searchParams.set("y", String(remembered.year));
  url.searchParams.set("m", String(remembered.month));
  return url;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/recurring") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/investments") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/budgets") ||
    pathname.startsWith("/profile");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Restoring the month the user was last looking at happens here, before
  // anything renders, and not inside the pages themselves.
  //
  // It began in the pages, and that was wrong in a way only the dev overlay
  // showed: `/transactions` renders the Ledger's view tabs, Next prefetches
  // the `/calendar` link in them, the prefetch starts rendering CalendarPage,
  // and a `redirect()` from inside that render aborts it half-finished. React
  // then measures a component that started and never completed and throws
  // "'CalendarPage' cannot have a negative time stamp". Redirecting from
  // middleware means the request never reaches a component at all.
  if (user) {
    const restored = restoredMonthUrl(request);
    if (restored) {
      return NextResponse.redirect(restored);
    }
  }

  return supabaseResponse;
}
