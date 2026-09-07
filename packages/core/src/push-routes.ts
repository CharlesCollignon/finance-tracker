/**
 * Where a tapped notification should land, on each app.
 *
 * `push-digest` decides what is worth saying and writes one message for every
 * device, which means one `url` for every device — and it writes it in web
 * paths, because that is the app the daily job runs in. The two apps do not
 * agree on their addresses: Month is `/dashboard` on the web and `/` on the
 * phone, and caps and goals are `/budgets` there and `/planning` here. So the
 * phone translates rather than follows.
 *
 * Both halves of that contract live here, next to the digest that writes the
 * paths, so a route renamed on one side and not the other is a failing test
 * rather than a notification that opens the wrong screen.
 *
 * Kept free of any router import: this is a fact about two vocabularies, and
 * the app turns the answer into whatever its own navigator wants.
 */

/** A route this app has, and the query it was asked for. */
export interface MobileRoute {
  pathname: string;
  params: Record<string, string>;
}

/** The phone's routes. */
const MOBILE_ROUTES = [
  "/",
  "/transactions",
  "/calendar",
  "/recurring",
  "/planning",
  "/investments",
] as const;

/** Web path → the phone's name for the same surface. */
const RENAMED: Record<string, string> = {
  "/dashboard": "/",
  "/budgets": "/planning",
};

/**
 * Where the phone should go, or null when it cannot tell.
 *
 * Null rather than a default, even though every caller defaults to Month. The
 * first version returned Month for a url it could not place, which reads
 * fine and cannot be tested: Month is also a real destination — it is where
 * `/dashboard` goes — so "the answer is Month" and "there was no answer" were
 * the same value, and a test that the digest writes nothing unplaceable could
 * not be written. Answering the question asked, and leaving the fallback to
 * the caller, makes the two distinguishable.
 */
export function mobileRouteForPushUrl(url: unknown): MobileRoute | null {
  if (typeof url !== "string" || !url.startsWith("/")) {
    return null;
  }

  const [path = "/", query] = url.split("?");
  const pathname = RENAMED[path] ?? path;

  if (!(MOBILE_ROUTES as readonly string[]).includes(pathname)) {
    return null;
  }

  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split("&")) {
      if (!pair) {
        continue;
      }
      const [key, value = ""] = pair.split("=");
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }
  }

  return { pathname, params };
}
