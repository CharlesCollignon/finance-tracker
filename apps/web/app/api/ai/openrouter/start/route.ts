import { isFlagOn } from "@finance/core/flags";
import { startConnection, type ConnectMode } from "@/lib/ai/connection";
import { aiRequester } from "@/lib/ai/requester";
import { flagsFor } from "@/lib/flags";

/**
 * The first half of connecting an AI account: POST `{ mode }` — `redirect`
 * from the web, `app` from the phone — by cookie or bearer, and the answer
 * is OpenRouter's address to send the user to. Behind the `ai.account` flag
 * (migration 053) until the connection is opened to everyone.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requester = await aiRequester(request);
  if (!requester) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  if (!isFlagOn(await flagsFor(requester.client), "ai.account")) {
    return Response.json({ error: "aiAccount.notEnabled" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
  } | null;
  const mode: ConnectMode = body?.mode === "app" ? "app" : "redirect";

  const result = await startConnection(requester.userId, mode);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 503 });
  }
  return Response.json(result);
}
