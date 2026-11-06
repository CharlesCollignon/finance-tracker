import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DESIGN_COOKIE, type Design } from "@finance/core/designs";
import { readDesign } from "@finance/data/preferences";
import type { Database } from "@finance/core/types/database";

/**
 * A year, like the language's cookie: a cache of the stored row, and the
 * only answer on a device that has not signed in yet. `lax` so a link from
 * an e-mail opens in the reader's design; not `httpOnly`, so a client switch
 * can set it before the server round trip lands.
 */
const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
} as const;

/** Kept out of the `"use server"` module so it is not a callable endpoint. */
export async function writeDesignCookie(design: Design): Promise<void> {
  const store = await cookies();
  store.set(DESIGN_COOKIE, design, COOKIE_OPTIONS);
}

/**
 * Bring the cookie into line with the design this person chose, wherever
 * they chose it — called at sign-in, so a design picked on the phone is the
 * one the laptop opens in. Never fatal: a failed read leaves the cookie as it
 * was, which is a design, just perhaps not the latest one.
 */
export async function syncDesignFromPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  try {
    await writeDesignCookie(await readDesign(supabase, userId));
  } catch (error) {
    console.error("Design sync at sign-in failed", error);
  }
}
