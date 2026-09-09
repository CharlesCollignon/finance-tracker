import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseRememberedMonth, MONTH_COOKIE } from "@finance/core/month-memory";
import {
  COUNTRY_COOKIE,
  LOCALE_COOKIE,
  negotiateLocale,
  parseLocale,
} from "@finance/core/i18n/locale";
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

/**
 * The language and the country, decided before anything renders.
 *
 * Both are written onto the response as cookies rather than passed on as
 * headers, because both have to outlive this request: the language so that
 * `Accept-Language` is negotiated once rather than on every navigation, and
 * the country because `x-vercel-ip-country` exists only on the platform and a
 * cookie is a cleaner absence than a header that means "no geo" in production
 * and "not deployed" on a laptop.
 *
 * `request.geo` would have been the obvious place to read the country from,
 * and was removed in Next 15 — the platform header is now the only source.
 *
 * A locale cookie that is already there is left alone. It is either the
 * browser's negotiated guess from an earlier request or, for somebody signed
 * in, the choice pushed into it at sign-in, and re-deciding it here would
 * quietly overrule a reader who has chosen English in a French browser.
 */
function stampLocale(request: NextRequest, response: NextResponse): void {
  if (!parseLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    response.cookies.set(
      LOCALE_COOKIE,
      negotiateLocale(request.headers.get("accept-language")),
      { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
    );
  }

  const country = request.headers.get("x-vercel-ip-country");
  if (country) {
    response.cookies.set(COUNTRY_COOKIE, country, {
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
    });
  }
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
    pathname.startsWith("/bearing") ||
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
    url.pathname = "/bearing";
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

  // Last, and only on the response that will actually render something: the
  // redirects above are followed immediately, and a cookie set on a redirect
  // that is about to be replaced by another response is a cookie set twice.
  stampLocale(request, supabaseResponse);

  return supabaseResponse;
}
