import { localeForCountry, type Locale } from "./locale";

export interface LocaleSuggestionInput {
  /** The language currently on screen. */
  current: Locale;
  /** The two-letter country the request appears to come from, if any. */
  country: string | null | undefined;
  /** Whether the reader has already answered this question, either way. */
  asked: boolean;
}

/**
 * The language worth offering, or null for "say nothing".
 *
 * Pure, and separated from both platforms on purpose: the web reads the
 * country from a cookie the proxy stamped out of `x-vercel-ip-country`, the
 * phone reads it from `expo-localization`, and neither difference belongs
 * anywhere near the rule about when to speak up.
 *
 * The rule is narrow by design, because an unwanted banner is worse than no
 * banner. It asks only when there is a country to go on, that country
 * suggests a language, that language is not the one already on screen, and
 * the reader has not answered before. Everything else is silence — including,
 * deliberately, the case of a country that suggests nothing: an English
 * reader in Germany is left alone rather than asked to confirm English.
 *
 * What it never does is switch. The return value feeds a banner with two
 * buttons; a country is a guess about a person, and acting on a guess about
 * someone's language without asking is how an app ends up in a language its
 * user cannot read well enough to change it back.
 */
export function suggestLocale({
  current,
  country,
  asked,
}: LocaleSuggestionInput): Locale | null {
  if (asked) {
    return null;
  }

  const suggested = localeForCountry(country);
  if (!suggested || suggested === current) {
    return null;
  }

  return suggested;
}
