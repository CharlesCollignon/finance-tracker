import type { Key } from "@finance/core/i18n/t";

/**
 * A failed password update, in the reader's language.
 *
 * `supabase.auth.updateUser`'s own `error.message` is an English sentence
 * and is never shown — only `error.code` is read here, and mapped to a key
 * in the message catalogue. A code this function does not recognise is not
 * a case it refuses: it is "something else went wrong", and gets the same
 * catch-all sentence a network failure or a stale session would.
 */
export function newPasswordErrorKey(code: string | undefined): Key {
  if (code === "same_password") {
    return "errors.samePassword";
  }
  if (code === "weak_password") {
    return "errors.passwordTooWeak";
  }
  return "errors.passwordNotSaved";
}
