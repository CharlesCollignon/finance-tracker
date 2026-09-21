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
    built = new Intl.DisplayNames([INTL_LOCALES[locale]], {
      type: "region",
      // "none" rather than the default "code", so an unassigned code comes
      // back as `undefined` instead of as itself. Both callers want to know
      // the difference: one falls back to the code, the other draws nothing.
      fallback: "none",
    });
  } catch {
    // A runtime built without the region data. Every caller already handles
    // the code coming back unchanged, so there is nothing else to do.
    built = null;
  }

  displayNames.set(locale, built);
  return built;
}

/** Whether any country answers to this code. */
function isACountry(code: string): boolean {
  const names = namesFor(DEFAULT_LOCALE);
  if (names === null) {
    // No region data to check against. Assume it is a country: a flag that
    // should not be there is a smaller fault than every flag missing.
    return true;
  }

  try {
    return names.of(code) !== undefined;
  } catch {
    return false;
  }
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
    // `undefined` for a code no country answers to, which is where the code
    // itself is the honest label: the weight behind the row is real even
    // when nothing can be named for it.
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
 *
 * A two-letter code that names no country gets none either. A factsheet's
 * "Other" bucket arrives as `OT` and looks exactly like a country code; the
 * arithmetic below would happily turn it into 🇴🇹, which renders as two
 * letters in a box and reads as a font problem rather than as "this part is
 * not anywhere in particular".
 */
export function countryFlag(code: string): string | null {
  const trimmed = code.trim();
  if (!ALPHA_2.test(trimmed) || !isACountry(trimmed.toUpperCase())) {
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
