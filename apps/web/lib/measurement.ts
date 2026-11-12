/**
 * What Vercel Web Analytics and Speed Insights may send (`VercelMeasurement`
 * in the root layout), and whether they may send at all.
 *
 * The gate follows « Mesure d'audience » in Profile, the same switch as the
 * first-party count (migration 058). The scripts stay in the page once
 * loaded, so turning the switch off cannot unload them: every event passes
 * through `keepIfMeasured`, which drops it while the switch is off. The
 * switch sets the gate the moment it is flipped (`AudienceRow`), and the
 * layout sets it from the stored preference on every render.
 *
 * Module state, not React state: the scripts call `beforeSend` from outside
 * React, and one page has one switch.
 */
let measured = true;

export function setMeasured(on: boolean): void {
  measured = on;
}

/**
 * Query parameters a page address keeps on its way to Vercel: where a
 * visitor came from, and nothing else. A sign-in link's `code`, a password
 * reset's `token_hash` and anything a later page adds are dropped.
 */
const KEPT_PARAMS = new Set([
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The address as Vercel may see it. An invitation's token is a key to
 * someone's shared space for seven days, so it never leaves the browser;
 * an id (a property's) says nothing anyone needs counted. Both become the
 * route's placeholder. Public slugs — a blog post, a thread — stay.
 */
export function redactUrl(url: string): string {
  // The scripts send the whole address; a bare path is read against a
  // placeholder origin and given back as a path.
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
  let parsed: URL;
  try {
    parsed = new URL(url, "https://placeholder.invalid");
  } catch {
    return url;
  }
  const segments = parsed.pathname.split("/").map((segment, index, all) => {
    if (index > 0 && all[index - 1] === "join" && segment) {
      return "[token]";
    }
    return UUID.test(segment) ? "[id]" : segment;
  });
  parsed.pathname = segments.join("/");
  for (const key of [...parsed.searchParams.keys()]) {
    if (!KEPT_PARAMS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hash = "";
  return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
}

/**
 * Global Privacy Control, the browser's own « do not measure me ». The one
 * way a visitor without an account — who has no switch — can object.
 */
function browserObjects(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl ===
      true
  );
}

/**
 * `beforeSend` for both: nothing while the switch is off or the browser
 * objects, a cleaned address otherwise.
 */
export function keepIfMeasured<T extends { url: string }>(event: T): T | null {
  if (!measured || browserObjects()) {
    return null;
  }
  return { ...event, url: redactUrl(event.url) };
}
