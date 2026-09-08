import { cache } from "react";
import { cookies } from "next/headers";
import {
  COUNTRY_COOKIE,
  DEFAULT_LOCALE,
  LOCALE_ASKED_COOKIE,
  LOCALE_COOKIE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import { translator, type Translate } from "@finance/core/i18n/t";

/**
 * What language this request is being answered in.
 *
 * Read from the cookie and nothing else, deliberately. The proxy guarantees
 * the cookie exists — it negotiates one out of `Accept-Language` when a
 * request arrives without it — and the signed-in user's stored preference is
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
 * What the edge thinks the country is, and whether the reader has already
 * been asked about their language.
 *
 * Both come off cookies the proxy stamps, so both are absent when running
 * anywhere without a geo-aware edge in front — which is every laptop. That
 * absence is the correct answer rather than a missing one: `suggestLocale`
 * says nothing without a country, so local development simply never shows
 * the banner.
 */
export async function getLocaleContext(): Promise<{
  locale: Locale;
  country: string | null;
  asked: boolean;
}> {
  const store = await cookies();
  return {
    locale: await getLocale(),
    country: store.get(COUNTRY_COOKIE)?.value ?? null,
    asked: store.get(LOCALE_ASKED_COOKIE)?.value === "1",
  };
}
