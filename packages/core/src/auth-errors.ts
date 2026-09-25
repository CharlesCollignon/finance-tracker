import type { Key } from "./i18n/t";

/**
 * A password-reset request that failed, in the reader's language.
 *
 * Supabase's own `error.message` is an English sentence and is never shown —
 * only `error.code` is read here, and mapped to a key in the message
 * catalogue, the same discipline `newPasswordErrorKey` (in the web's
 * `lib/auth`) applies to a failed password update. Showing the English text
 * would put an untranslated sentence in front of a French reader, and it
 * would also leak more than the neutral "if there is an account for this
 * address" confirmation is designed to: Supabase only ever refuses a reset
 * request for a reason that has nothing to do with which addresses have
 * accounts (a rate limit), so nothing case-specific needs saying, and a code
 * this function does not recognise gets the same generic sentence.
 *
 * Returns `Key` rather than `string` — same as `newPasswordErrorKey` — so a
 * typo in one of the two keys below fails typecheck instead of shipping a
 * message the catalogue does not have.
 */
export function resetRequestErrorKey(code: string | undefined): Key {
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "errors.resetTooMany";
  }
  return "errors.resetNotSent";
}
