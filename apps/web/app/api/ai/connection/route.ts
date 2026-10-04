import { aiRequester } from "@/lib/ai/requester";

/**
 * Disconnecting an AI account: DELETE, by cookie or bearer. The row goes as
 * the user, under row level security, and its sealed key with it (migration
 * 053's cascade). The key itself still exists in the user's OpenRouter
 * account until they delete it there, which the Profile says.
 */

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const requester = await aiRequester(request);
  if (!requester) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const { error } = await requester.client
    .from("ai_connections")
    .delete()
    .eq("user_id", requester.userId);
  if (error) {
    return Response.json({ error: "aiAccount.unavailable" }, { status: 500 });
  }
  return Response.json({ success: true });
}
