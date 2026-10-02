import { searchAddresses } from "@finance/core/address-search";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Addresses for what the phone's user has typed so far, asked of the IGN
 * geocoder from here — as the web's own form does — so the geocoder never
 * learns who asked. A read: it writes nothing and announces nothing.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json({ matches: await searchAddresses(query) });
}
