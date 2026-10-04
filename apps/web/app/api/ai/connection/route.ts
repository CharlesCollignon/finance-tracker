import { accountCredit } from "@/lib/ai/connection";
import { aiRequester } from "@/lib/ai/requester";

/**
 * A connected AI account's credit: GET, by cookie or bearer. Read from
 * OpenRouter with the account's key, which is why it is a route — the
 * phone holds no key and never will. Choosing a model and disconnecting are
 * the user's own rows, written from both apps through `@finance/data`.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requester = await aiRequester(request);
  if (!requester) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  return Response.json(await accountCredit(requester.userId));
}
