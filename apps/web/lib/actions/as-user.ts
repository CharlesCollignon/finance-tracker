import type { ActionResult } from "@finance/core/action-result";
import type { Db } from "@finance/data/client";
import { getAuthUser } from "@/lib/auth/get-user";
import { revalidateApp } from "@/lib/revalidate-paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Run a write as the signed-in user, and redraw the app if it worked.
 *
 * The three lines every action began with — who is asking, refuse if nobody,
 * open the request's client — and the one most of them ended with, in one
 * place. The write itself is usually a `@finance/data` function the phone
 * calls too, so an action built on this is the web's plumbing around shared
 * logic and nothing more.
 *
 * Not a `"use server"` module: such a file may only export actions, and this
 * is a helper for writing them.
 */
export async function asUser<T extends object>(
  work: (db: Db, userId: string) => Promise<ActionResult<T>>,
  options: {
    /**
     * Redraw even when the write reports an error: for the few that can
     * fail halfway, after something has already changed — a confirmation
     * recorded whose row could not then be moved, an undo whose row went
     * but whose skip stayed. Or never, for a write no page shows — a
     * redraw there would only take back what the page is showing.
     */
    redraw?: "on-success" | "always" | "never";
  } = {},
): Promise<ActionResult<T>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" } as ActionResult<T>;
  }
  const result = await work(await createClient(), user.id);
  if (
    options.redraw !== "never" &&
    (result.success || options.redraw === "always")
  ) {
    revalidateApp();
  }
  return result;
}
