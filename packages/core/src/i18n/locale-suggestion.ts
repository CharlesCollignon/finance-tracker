import type { Locale } from "./locale";

export interface LocaleSuggestionInput {
  /** The language currently on screen. */
  current: Locale;
  /**
   * The supported language the browser or phone would rather read, if any:
   * `preferredLocale` on the web, the device's languages on the phone.
   */
  preferred: Locale | null | undefined;
  /** Whether the reader has already answered this question, either way. */
  asked: boolean;
}

/**
 * The language worth offering, or null for "say nothing".
 *
 * Pure, and separated from both platforms on purpose: the web reads the
 * browser's `Accept-Language`, the phone reads `expo-localization`, and
 * neither difference belongs anywhere near the rule about when to speak up.
 *
 * Everyone starts in French. This is how English stays within reach of the
 * reader who needs it: a device set to English is offered English, once. The
 * rule is narrow by design, because an unwanted banner is worse than no
 * banner — it asks only when the device prefers a language we have, that
 * language is not the one on screen, and the reader has not answered before.
 *
 * What it never does is switch. The return value feeds a banner with two
 * buttons; a device setting is a guess about a person, and acting on it
 * without asking is how an app ends up in a language its user did not pick.
 */
export function suggestLocale({
  current,
  preferred,
  asked,
}: LocaleSuggestionInput): Locale | null {
  if (asked || !preferred || preferred === current) {
    return null;
  }
  return preferred;
}
