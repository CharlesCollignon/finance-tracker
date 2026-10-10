import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_ASK_QUESTION } from "@finance/core/ask";
import { translator } from "@finance/core/i18n/t";
import type { AskStreamEvent } from "@finance/core/ask-chat";
import { askChat } from "@/lib/ask/chat";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCurrency } from "@/lib/currency";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * Ask Pluclair from the web, streamed: one JSON event a line
 * (`AskStreamEvent`) — each tool as the model calls it, the answer's words
 * as they are written, then the conversation it was kept in. The screen
 * draws them as they come, and reads the kept exchange back once done.
 *
 * The cookie session, the reader's language and currency: the same person
 * and the same figures as the page that asked.
 */

// A few rounds of tools, then the answer.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    question: z.string().min(1).max(MAX_ASK_QUESTION),
    conversationId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const [db, locale, currency] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrency(),
  ]);

  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AskStreamEvent) => {
        if (open) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };
      try {
        const outcome = await askChat(
          db,
          user.id,
          {
            question: parsed.data.question,
            conversationId: parsed.data.conversationId ?? null,
            locale,
            currency,
            signal: request.signal,
          },
          emit,
        );
        if (outcome.conversationId) {
          revalidatePath("/ask");
        }
      } catch (error) {
        console.error("Ask failed", error);
        emit({
          type: "error",
          message: translator(locale)("errors.couldNotSave"),
        });
      } finally {
        if (open) {
          open = false;
          controller.close();
        }
      }
    },
    // The screen stopped reading: nothing more is written to it.
    cancel() {
      open = false;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
