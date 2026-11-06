import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { DESIGN_COOKIE, parseDesign, type Design } from "@finance/core/designs";

/**
 * The design this request renders in, from its cookie: read by the root
 * layout so the first paint is already in the reader's design, with no flash
 * of « Nuit » corrected after the page loads. The stored row is the real
 * answer; the cookie is its cache, brought into line at sign-in
 * (`syncDesignFromPreferences`) and on every change.
 */
export const getDesign = cache(async (): Promise<Design> => {
  const store = await cookies();
  return parseDesign(store.get(DESIGN_COOKIE)?.value);
});
