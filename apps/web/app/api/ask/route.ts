import { z } from "zod";
import { LOCALES } from "@finance/core/i18n/locale";
import { MAX_ASK_QUESTION } from "@finance/core/ask";
import { askQuestion } from "@/lib/ask/ask";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Ask Pluclair from the phone, which cannot hold the model's key. The phone
 * reads its conversations and deletes them straight from Supabase under row
 * level security; asking is the one thing it needs a server for. Same shape
 * as `api/month-read`: the Supabase token it already has, verified here.
 */

// Two model calls in a row.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    question: z.string().min(1).max(MAX_ASK_QUESTION),
    conversationId: z.string().uuid().nullable().optional(),
    locale: z.enum(LOCALES as unknown as [string, ...string[]]),
  })
  .strict();

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
    const outcome = await askQuestion(session.supabase, session.userId, {
      question: parsed.data.question,
      conversationId: parsed.data.conversationId ?? null,
      locale: parsed.data.locale as (typeof LOCALES)[number],
    });
    // Every refusal is an answer with a reason, as on the other routes.
    return Response.json(outcome);
  } catch (error) {
    console.error("Ask failed", error);
    return Response.json({ error: "errors.couldNotSave" }, { status: 502 });
  }
}
