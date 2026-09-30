import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_ASKED_COOKIE,
  LOCALE_COOKIE,
  parseLocale,
  preferredLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import { translator, type Translate } from "@finance/core/i18n/t";

/**
 * What language this request is being answered in.
 *
 * Read from the cookie and nothing else, deliberately. The proxy guarantees
 * the cookie exists — French, for a request that arrives without it, whatever
 * the browser prefers — and the signed-in user's stored preference is
 * pushed *into* the cookie at sign-in and whenever it changes, rather than
 * being read out of the database here. So this costs a cookie lookup on a
 * path that every page in the app renders through, instead of a query.
 *
 * Wrapped in `cache()` for the same reason `getAuthUser` is: it is called from
 * the root layout, from pages, and from server actions inside one render, and
 * all of them should see the same answer.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE;
});

/** The translator for this request. The server-side counterpart of `useT`. */
export const getT = cache(async (): Promise<Translate> => {
  return translator(await getLocale());
});

/**
 * The language the browser would rather read, if it is one we have, and
 * whether the reader has already been asked about it — what `suggestLocale`
 * needs to decide whether to offer English to someone reading in French.
 */
export async function getLocaleContext(): Promise<{
  locale: Locale;
  preferred: Locale | null;
  asked: boolean;
}> {
  const [store, request] = await Promise.all([cookies(), headers()]);
  return {
    locale: await getLocale(),
    preferred: preferredLocale(request.get("accept-language")),
    asked: store.get(LOCALE_ASKED_COOKIE)?.value === "1",
  };
}
