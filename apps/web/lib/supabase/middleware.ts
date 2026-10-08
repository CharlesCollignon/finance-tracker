import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseRememberedMonth, MONTH_COOKIE } from "@finance/core/month-memory";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  parseLocale,
} from "@finance/core/i18n/locale";
import { OWNER_COOKIE, OWNER_COOKIE_OPTIONS } from "@/lib/owner-cookie";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * The surfaces whose figures are about one month.
 *
 * Exactly the two that read `y` and `m`. `/history` is not among them: it
 * looks across months by category, so a month in its address would be a
 * parameter it ignores. `/dashboard` was the third until Month retired —
 * `next.config.ts` now redirects it to `/bearing` before any request reaches
 * this proxy, so it has nothing to restore a month into any more.
 */
const MONTH_SCOPED = ["/transactions", "/calendar"];

/** A shared space's id, as a notification about it names it. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A shared space's invite token, as `create_space_invite` makes it. */
const TOKEN = /^[0-9a-f]{48}$/;
const JOIN_PATH = /^\/join\/([0-9a-f]{48})$/;
const JOIN_COOKIE = "pluclair-join";
/** As long as the link itself lasts. */
const JOIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

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
 * The language, decided before anything renders: French for anyone the
 * cookie does not already speak for.
 *
 * Not negotiated from `Accept-Language`: Pluclair is for French users, so it
 * starts in French whatever the browser says, and a browser that prefers
 * English is offered it by the banner instead (`suggestLocale`). A cookie
 * that is already there is left alone — it is the reader's own choice, pushed
 * into it at sign-in and whenever it changes.
 */
function stampLocale(request: NextRequest, response: NextResponse): void {
  if (!parseLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
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
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/recurring") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/investments") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/plan") ||
    pathname.startsWith("/budgets") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/bank");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Only a page load is sent on to the Bearing. A Server Function called
  // from `/login` is a POST to `/login`, and the passkey button calls one
  // right after the browser has stored the new session — redirecting that
  // POST hands Next an HTML page where it expects an action reply, the call
  // throws, and the button is left waiting with the reader still on the
  // login page until they reload it.
  if (user && isAuthRoute && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = "/bearing";
    return NextResponse.redirect(url);
  }

  // A link to join a shared space opened signed out is kept through the
  // sign-in — by password, passkey, Google or a confirmation e-mail, all of
  // which land on the Bearing — and followed from there.
  const joining = JOIN_PATH.exec(pathname);
  const pendingJoin = request.cookies.get(JOIN_COOKIE)?.value;
  if (!user && joining) {
    supabaseResponse.cookies.set(JOIN_COOKIE, joining[1]!, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: JOIN_COOKIE_MAX_AGE,
    });
  }
  if (user && pendingJoin && request.method === "GET") {
    if (joining) {
      supabaseResponse.cookies.delete(JOIN_COOKIE);
    } else if (pathname === "/bearing" && TOKEN.test(pendingJoin)) {
      const url = request.nextUrl.clone();
      url.pathname = `/join/${pendingJoin}`;
      url.search = "";
      const response = NextResponse.redirect(url);
      response.cookies.delete(JOIN_COOKIE);
      return response;
    }
  }

  // A notification about a shared space opens it: `?owner=<space>` becomes
  // the choice the shared screens read — `getOwner` honours it only for a
  // member — and leaves the address.
  const owner = request.nextUrl.searchParams.get("owner");
  if (user && owner && request.method === "GET" && UUID.test(owner)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("owner");
    const response = NextResponse.redirect(url);
    response.cookies.set(OWNER_COOKIE, owner, OWNER_COOKIE_OPTIONS);
    return response;
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
