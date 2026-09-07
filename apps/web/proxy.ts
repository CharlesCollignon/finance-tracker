import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Renamed from `middleware` for Next 16, which deprecated that convention.
 *
 * The rename moves this off the edge runtime: `proxy` runs on Node and that
 * is not configurable. Nothing here needed the edge — it refreshes a Supabase
 * session cookie and, for the three month-scoped surfaces, restores a
 * remembered month — so the move costs a little latency on the first request
 * of a session and buys staying on a supported convention.
 *
 * The helper it calls keeps its own name: `lib/supabase/middleware.ts` is
 * what Supabase's own SSR guide calls that file, and renaming it would only
 * make it harder to match against their docs.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
