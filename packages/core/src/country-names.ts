import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "./i18n/locale";

/**
 * Naming the countries a look-through resolves to.
 *
 * The weights come back keyed by ISO 3166-1 alpha-2, because that is what a
 * factsheet publishes and what the reading stores. A code is the right thing
 * to key a map on and the wrong thing to put on a screen: "NL" above a bar is
 * a lookup the reader has to do, and for the euro-zone audience this app is
 * for, the codes worth recognising run well past the handful anybody knows by
 * sight.
 *
 * No table of names here, in any language. `Intl.DisplayNames` already has
 * every country in every locale the runtime supports, it is maintained by
 * whoever maintains the runtime rather than by this repository, and a table
 * copied in would be a translation file that silently goes stale. The same
 * argument retires a flag asset: a flag emoji is two code points derived from
 * the code itself, so there is nothing to ship, nothing to load and nothing
 * to get out of step with the name beside it.
 */

/** ISO 3166-1 alpha-2: exactly two letters, nothing else. */
const ALPHA_2 = /^[A-Za-z]{2}$/;

/**
 * The offset from an ASCII capital to its regional indicator symbol.
 *
 * A flag emoji is its country's two letters written in the regional indicator
 * block, so 🇫🇷 is quite literally "FR" in a different alphabet.
 */
const REGIONAL_INDICATOR_A = 0x1f1e6;
const ASCII_A = 0x41;

const displayNames = new Map<Locale, Intl.DisplayNames | null>();

function namesFor(locale: Locale): Intl.DisplayNames | null {
  const cached = displayNames.get(locale);
  if (cached !== undefined) {
    return cached;
  }

  let built: Intl.DisplayNames | null = null;
  try {
    built = new Intl.DisplayNames([INTL_LOCALES[locale]], { type: "region" });
  } catch {
    // A runtime built without the region data. Every caller already handles
    // the code coming back unchanged, so there is nothing else to do.
    built = null;
  }

  displayNames.set(locale, built);
  return built;
}

/**
 * A country's name in the reader's language, or the input unchanged.
 *
 * Unchanged rather than blank for anything that is not a country: the
 * look-through's country axis is keyed on what a factsheet published, and a
 * row the app cannot name is still a row whose weight is real. Showing the
 * raw key says "this much is somewhere the app could not name", which is
 * true; showing nothing would lose the weight entirely.
 */
export function countryName(
  code: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const trimmed = code.trim();
  if (!ALPHA_2.test(trimmed)) {
    return code;
  }

  const upper = trimmed.toUpperCase();
  const names = namesFor(locale);
  if (names === null) {
    return upper;
  }

  try {
    // `of` returns the code itself for a region it does not know, which is
    // already the answer this function wants.
    return names.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/**
 * The country's flag, or null when there is no country to draw one for.
 *
 * Null rather than an empty string so a caller has to decide what an absent
 * flag looks like, instead of rendering a zero-width gap that quietly knocks
 * a column out of alignment.
 */
export function countryFlag(code: string): string | null {
  const trimmed = code.trim();
  if (!ALPHA_2.test(trimmed)) {
    return null;
  }

  return [...trimmed.toUpperCase()]
    .map((letter) =>
      String.fromCodePoint(
        letter.codePointAt(0)! - ASCII_A + REGIONAL_INDICATOR_A,
      ),
    )
    .join("");
}
