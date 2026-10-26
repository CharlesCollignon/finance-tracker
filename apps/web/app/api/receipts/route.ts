import { RECEIPT_MAX_BYTES } from "@finance/core/receipts";
import { readReceipt } from "@/lib/receipts/read";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * The phone's receipt reading: the file goes as base64, and the shop, the
 * day and the total come back — read on the person's own AI account, as
 * the web's `readReceiptAction` does. The phone attaches, opens and removes
 * the file through Supabase storage on its own session; only the reading
 * needs a server, because the model key is opened there.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    file?: unknown;
  };
  if (body.action !== "read" || typeof body.file !== "string") {
    return Response.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const bytes = new Uint8Array(Buffer.from(body.file, "base64"));
  if (bytes.length === 0 || bytes.length > RECEIPT_MAX_BYTES) {
    return Response.json({ error: "transaction.receiptTooBig" });
  }
  const result = await readReceipt(session.userId, bytes);
  return Response.json(
    "error" in result ? result : { success: true, reading: result.reading },
  );
}
