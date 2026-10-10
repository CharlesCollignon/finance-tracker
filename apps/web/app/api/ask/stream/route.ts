import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_ASK_QUESTION } from "@finance/core/ask";
import type { AskStreamEvent } from "@finance/core/ask-chat";
import type { CurrencyCode } from "@finance/core/constants";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import type { Db } from "@finance/data/client";
import { askChat } from "@/lib/ask/chat";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCurrency } from "@/lib/currency";
import { getLocale } from "@/lib/locale";
import { bearerToken, sessionFromBearer } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";

/**
 * Ask Pluclair, streamed: one JSON event a line (`AskStreamEvent`) — each
 * tool as the model calls it, the answer's words as they are written, then
 * the conversation it was kept in. The screen draws them as they come, and
 * reads the kept exchange back once done.
 *
 * Both apps ask here. The web with its cookie session, in the language and
 * currency its cookies hold; the phone with its Supabase token as a bearer
 * (as on `api/ask`), saying its language and currency in the body, since it
 * has no cookies to say them.
 */

// A few rounds of tools, then the answer.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    question: z.string().min(1).max(MAX_ASK_QUESTION),
    conversationId: z.string().uuid().nullable().optional(),
    // The phone's: the web's cookies say them.
    locale: z.enum(LOCALES as unknown as [Locale, ...Locale[]]).optional(),
    currency: z.enum(["EUR", "USD"]).optional(),
  })
  .strict();

type Body = z.infer<typeof bodySchema>;

/** Who asks, and in what language and currency; null when no one is signed in. */
async function asker(
  request: Request,
  body: Body,
): Promise<{
  db: Db;
  userId: string;
  locale: Locale;
  currency: CurrencyCode;
} | null> {
  if (bearerToken(request)) {
    const session = await sessionFromBearer(request);
    return session
      ? {
          db: session.supabase,
          userId: session.userId,
          locale: body.locale ?? DEFAULT_LOCALE,
          currency: body.currency ?? "EUR",
        }
      : null;
  }
  const user = await getAuthUser();
  if (!user) {
    return null;
  }
  const [db, locale, currency] = await Promise.all([
    createClient(),
    getLocale(),
    getCurrency(),
  ]);
  return { db, userId: user.id, locale, currency };
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "errors.invalidInput" }, { status: 400 });
  }
  const who = await asker(request, parsed.data);
  if (!who) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const { db, locale, currency } = who;

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
          who.userId,
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
