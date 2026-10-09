import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { CurrencyCode } from "@finance/core/constants";
import { CURRENCY_COOKIE, parseCurrency } from "@/lib/currency-cookie";

/**
 * The display currency this request renders in, from its cookie: the
 * server-side seed of `useCurrency`, so a reader who chose dollars never sees
 * a page of euros corrected after it loads.
 */
export const getCurrency = cache(async (): Promise<CurrencyCode> => {
  const store = await cookies();
  return parseCurrency(store.get(CURRENCY_COOKIE)?.value);
});
