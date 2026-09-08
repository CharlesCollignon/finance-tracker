/**
 * Which language the app is speaking.
 *
 * One locale, carried four ways, because the four askers have different
 * powers. The database is the only one a cron job can read, the cookie is the
 * only one the proxy can read without a query, the phone's storage is the only
 * one that works on a plane, and `Accept-Language` is the only one that
 * answers before the user has ever chosen. Precedence runs in that order of
 * authority rather than that order of availability: a stored choice beats a
 * cookie beats a header, so switching language once is not undone by the next
 * request arriving from a browser that still says otherwise.
 *
 * The locale is a language, not a place and not a currency. `APP_TIME_ZONE`
 * stays Europe/Paris whatever this says, because the ledger's "today" is a
 * fact about the accounts and not about the reader; and the display currency
 * is a separate preference that relabels figures without converting them.
 */

export type Locale = "en" | "fr";

export const LOCALES: readonly Locale[] = ["en", "fr"];

/**
 * The locale used when nothing else answers.
 *
 * English rather than French despite an EUR/France-centric domain: it is the
 * language the app was written in, so it is the one guaranteed to have a
 * message for every key. A missing French string falls back to it.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Where the web app keeps it.
 *
 * Same reasoning as `MONTH_COOKIE` in `./month-memory`: the proxy writes this
 * cookie and the browser reads it, so the name cannot live beside either
 * reader without dragging that runtime's imports into the other's bundle.
 */
export const LOCALE_COOKIE = "pluclair-locale";

/**
 * The country the edge thinks the request came from, stamped by the proxy.
 *
 * A cookie rather than a header read at render time because `x-vercel-ip-country`
 * only exists on the platform: locally, and on any other host, there is
 * nothing to read, and a cookie the proxy either set or did not is a cleaner
 * absence than a header that means "no geo" in production and "not deployed"
 * on a laptop.
 */
export const COUNTRY_COOKIE = "pluclair-country";

/** Set once the reader has answered the "read this in French?" banner, either way. */
export const LOCALE_ASKED_COOKIE = "pluclair-locale-asked";

/**
 * How each locale is named in a language picker.
 *
 * Endonyms — each language named in itself — and so deliberately not
 * translated. Someone hunting for their own language in a list they cannot
 * read finds "Français"; they would not find "French".
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

/**
 * The BCP-47 tag to hand `Intl` for each locale.
 *
 * `en-GB` rather than `en-US` because the domain is European: it puts the euro
 * sign before the figure and the day before the month, which is what the rest
 * of the app already assumes. Note that this changes what an English reader
 * sees today — every amount currently formats through a hardcoded `fr-FR`, so
 * `1 234,56 €` becomes `€1,234.56`.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * A stored or submitted value as a locale, or null if it names none.
 *
 * Strict like `parseRememberedMonth`, and for the same reason: this reads a
 * cookie, a form field and a database column, all of which the user can edit.
 * A base language with a region attached is accepted — `fr-CA` is French — but
 * nothing else is guessed at.
 */
export function parseLocale(value: string | null | undefined): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const tag = value.trim().toLowerCase();
  if (isLocale(tag)) {
    return tag;
  }

  const base = tag.split("-")[0];
  return isLocale(base) ? base : null;
}

interface RankedTag {
  tag: string;
  quality: number;
  /** Position in the header, to keep equal-quality tags in the order sent. */
  order: number;
}

/**
 * The best supported locale an `Accept-Language` header asks for.
 *
 * Hand-rolled rather than pulled from `negotiator` and
 * `@formatjs/intl-localematcher`, which is what the Next.js guide reaches for.
 * With two locales the whole matcher is the twenty lines below, and a
 * dependency here would have to earn its way past `minimumReleaseAge` and the
 * hoisted node_modules layout Metro needs — a poor trade for a `q=` parse.
 *
 * `q=0` means "not acceptable" rather than "least preferred", so such a tag is
 * dropped rather than ranked last; a malformed `q` is dropped too, since a
 * header we cannot read is not a preference we should guess at.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
): Locale {
  if (typeof acceptLanguage !== "string" || acceptLanguage.trim() === "") {
    return DEFAULT_LOCALE;
  }

  const ranked: RankedTag[] = [];

  acceptLanguage.split(",").forEach((part, order) => {
    const [rawTag, ...params] = part.split(";");
    const tag = rawTag.trim().toLowerCase();
    if (tag === "") {
      return;
    }

    const qualityParam = params
      .map((param) => param.trim())
      .find((param) => param.startsWith("q="));

    let quality = 1;
    if (qualityParam) {
      const parsed = Number(qualityParam.slice(2));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return;
      }
      quality = parsed;
    }

    ranked.push({ tag, quality, order });
  });

  ranked.sort((a, b) =>
    b.quality === a.quality ? a.order - b.order : b.quality - a.quality,
  );

  for (const { tag } of ranked) {
    // A wildcard says "anything will do", which is what the default is for.
    if (tag === "*") {
      return DEFAULT_LOCALE;
    }
    const locale = parseLocale(tag);
    if (locale) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * The language a country suggests, or null for a country that suggests nothing.
 *
 * Crude by nature — a country is not a language, and plenty of people read
 * Pluclair in a language their address does not predict. That is exactly why
 * nothing acts on this without asking: the return value feeds a banner the
 * reader can decline, never a switch. The browser's own `Accept-Language` is
 * the better signal and wins by default; the country only gets a say when it
 * disagrees with what is already on screen.
 *
 * Listed are the countries where French is an official language. The Maghreb
 * is deliberately absent: French is widely read there but Arabic is the
 * official language, and offering the wrong one is worse than offering none.
 */
const FRENCH_SPEAKING_COUNTRIES = new Set([
  // Europe
  "FR",
  "BE",
  "CH",
  "LU",
  "MC",
  // West and Central Africa
  "BF",
  "BI",
  "BJ",
  "CD",
  "CF",
  "CG",
  "CI",
  "CM",
  "GA",
  "GN",
  "GQ",
  "KM",
  "ML",
  "NE",
  "SN",
  "TD",
  "TG",
  // Indian Ocean and the Caribbean
  "DJ",
  "HT",
  "MG",
  "RE",
  "SC",
  "GP",
  "MQ",
  "GF",
  "NC",
  "PF",
]);

export function localeForCountry(
  country: string | null | undefined,
): Locale | null {
  if (typeof country !== "string") {
    return null;
  }

  const code = country.trim().toUpperCase();
  if (code.length !== 2) {
    return null;
  }

  return FRENCH_SPEAKING_COUNTRIES.has(code) ? "fr" : null;
}
