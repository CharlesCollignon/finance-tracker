import { z } from "zod";
import { readPropertyMarket } from "@/lib/property-market/read";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Read what the market says about one of the phone user's properties, as
 * the web's own add and edit do after saving. The DVF files and the index
 * are fetched here: a commune's sales are megabytes the phone has no
 * business downloading. Refusals are answers with a reason, as on the other
 * bearer routes.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ propertyId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  try {
    // The person's home, or their space's: whoever owns it, which the row
    // says — and which it shows only to the person or a partner.
    const { data: owned } = await session.supabase
      .from("properties")
      .select("user_id")
      .eq("id", parsed.data.propertyId)
      .maybeSingle();
    if (!owned) {
      return Response.json({ error: "errors.notFound" }, { status: 404 });
    }
    const status = await readPropertyMarket(
      session.supabase,
      owned.user_id,
      parsed.data.propertyId,
    );
    return Response.json({ status });
  } catch (error) {
    console.error("Market reading failed", error);
    return Response.json({ error: "errors.couldNotSave" }, { status: 502 });
  }
}
