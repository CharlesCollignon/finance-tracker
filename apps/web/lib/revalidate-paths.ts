import { revalidatePath } from "next/cache";

/** Pages that depend on recurring templates or derived transactions. */
export function revalidateRecurringDependents(): void {
  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/calendar");
  revalidatePath("/investments");
  revalidatePath("/dashboard");
}

/**
 * Every surface, for the refresh reachable from all of them.
 *
 * Enumerated rather than `revalidatePath("/", "layout")`, which would take
 * the marketing pages with it — they sit at `/` in their own route group and
 * have nothing to do with a bank statement.
 *
 * The list is deliberately the whole app rather than the current page: a pull
 * can add a transaction, close a month and move a wallet's value in one go,
 * and the point of a refresh button on every screen is that you do not have
 * to know which screens the answer touched.
 *
 * Which is why it has to be every surface and not most of them. A server
 * action updates the UI for the paths it names, so a page missing from this
 * list is a page where the control spins, reports what it did, and leaves
 * the figures exactly where they were — the button looking broken on the
 * one screen you happened to press it from. `/import`, `/profile` and
 * `/welcome` were missing, so they are here now, and anything added under
 * `(app)` belongs here the day it is added.
 */
export function revalidateEverySurface(): void {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/calendar");
  revalidatePath("/history");
  revalidatePath("/recurring");
  revalidatePath("/budgets");
  revalidatePath("/investments");
  revalidatePath("/categories");
  revalidatePath("/import");
  revalidatePath("/profile");
  revalidatePath("/welcome");
}
