import "server-only";
import { askTitle, MAX_ASK_QUESTION } from "@finance/core/ask";
import {
  askChatHistory,
  askChatSystem,
  askChatToolDefinitions,
  isAskChatTool,
  MAX_ASK_ROUNDS,
  type AskChatBody,
  type AskChatStep,
  type AskStreamEvent,
} from "@finance/core/ask-chat";
import {
  numbersIn,
  untracedFigures,
  valuesIn,
} from "@finance/core/ask-figures";
import {
  formatCurrency,
  todayIsoLocal,
  type CurrencyCode,
} from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  getConversationMessages,
  questionsAsked,
  recordExchange,
  refundQuestion,
  reserveQuestion,
} from "@finance/data/ask";
import type { Db } from "@finance/data/client";
import {
  ChatRoundError,
  streamChatRound,
  type ChatMessage,
} from "../ai/chat-stream";
import type { ReadFailure } from "../ai/read-source";
import { ACCOUNT_ALLOWANCE, writerFor } from "../ai/writer";
import { runAskTool } from "./tools";

/**
 * One question, answered as a conversation (`@finance/core/ask-chat`): the
 * conversation so far and the question go to the person's model with the
 * tools; it calls what it needs, round after round, and writes its answer,
 * which is streamed to the screen as it comes and kept once it is whole.
 *
 * The month's count is taken before the model is asked and handed back
 * when it was never reached; a question it answered, even badly, was paid
 * for and stays counted. Always the person's own money, under « Commun »
 * too: a space has no conversations to begin with.
 */

export interface AskOutcome {
  /** The conversation the exchange was written into, or null if none was. */
  conversationId: string | null;
  /** What to say instead of an answer, when there is none. */
  message: string | null;
}

/**
 * Within the sixty seconds a route is given: past this, the model is asked
 * to answer with what it has; past the hard line, the question is dropped.
 */
const ANSWER_BY_MS = 38_000;
const DEADLINE_MS = 56_000;

/** A round's longest silence: a reasoning model thinks before it speaks. */
const IDLE_MS = 25_000;
const REASONING_IDLE_MS = 45_000;

/** A detailed answer's room, well above the longest a question deserves. */
const MAX_TOKENS = 3000;

/** Longest a tool's result is sent back, against a runaway read. */
const MAX_RESULT_CHARS = 24_000;

export async function askChat(
  db: Db,
  userId: string,
  {
    question,
    conversationId,
    locale,
    currency,
    signal,
  }: {
    question: string;
    conversationId: string | null;
    locale: Locale;
    currency: CurrencyCode;
    /** The person gave up — pressed stop, closed the page: so does the model. */
    signal?: AbortSignal;
  },
  emit: (event: AskStreamEvent) => void = () => undefined,
): Promise<AskOutcome> {
  const t = translator(locale);
  const text = question.trim();
  const today = todayIsoLocal();
  const refuse = (message: string): AskOutcome => {
    emit({ type: "error", message });
    return { conversationId, message };
  };

  if (text.length === 0 || text.length > MAX_ASK_QUESTION) {
    return refuse(t("ask.tooLong", { max: MAX_ASK_QUESTION }));
  }
  const writer = await writerFor(userId);
  if (!writer) {
    return refuse(t("aiAccount.connectFirst"));
  }
  // One's own account pays for every question: the allowance is only a
  // ceiling against a runaway client.
  const taken = await reserveQuestion(db, today, ACCOUNT_ALLOWANCE);
  if (taken === null) {
    const asked = await questionsAsked(db, userId, today);
    return refuse(
      asked >= ACCOUNT_ALLOWANCE ? t("ask.none") : t("ask.noAnswer"),
    );
  }

  const formatMoney = (amount: number) =>
    formatCurrency(amount, currency, locale);
  const history = conversationId
    ? askChatHistory(
        await getConversationMessages(db, conversationId),
        formatMoney,
      )
    : [];

  // What the answer's figures may be found in: what the person wrote, what
  // was said before, and every tool's result as it comes.
  const values: number[] = [
    ...numbersIn(text, locale),
    ...history.flatMap((turn) => numbersIn(turn.content, locale)),
  ];
  const messages: ChatMessage[] = [
    { role: "system", content: askChatSystem({ locale, today, currency }) },
    ...history,
    { role: "user", content: text },
  ];
  const tools = askChatToolDefinitions();
  const steps: AskChatStep[] = [];
  const context = { db, userId, today, locale };

  const started = Date.now();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), DEADLINE_MS);
  const giveUp = () => deadline.abort();
  signal?.addEventListener("abort", giveUp, { once: true });
  let answer = "";
  let reached = false;

  try {
    for (let round = 0; ; round += 1) {
      const last =
        round >= MAX_ASK_ROUNDS - 1 || Date.now() - started > ANSWER_BY_MS;
      let written = "";
      const result = await streamChatRound(writer, {
        messages,
        tools,
        toolChoice: last ? "none" : "auto",
        maxTokens: MAX_TOKENS,
        idleMs: writer.reasoning ? REASONING_IDLE_MS : IDLE_MS,
        signal: deadline.signal,
        onText: (piece) => {
          written += piece;
          emit({ type: "text", text: piece });
        },
      });
      reached = true;

      if (result.toolCalls.length === 0 || last) {
        answer = result.content;
        break;
      }
      if (written) {
        emit({ type: "reset" });
      }

      messages.push({
        role: "assistant",
        content: result.content || null,
        tool_calls: result.toolCalls,
      });
      const answers = await Promise.all(
        result.toolCalls.map(async (call) => {
          const name = call.function.name;
          if (!isAskChatTool(name)) {
            return {
              call,
              data: { error: `There is no tool named ${name}.` },
              ok: false,
            };
          }
          emit({ type: "step", tool: name });
          const ran = await runAskTool(context, name, call.function.arguments);
          steps.push({ tool: name, ok: ran.ok });
          return { call, ...ran };
        }),
      );
      for (const { call, data } of answers) {
        values.push(...valuesIn(data));
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(data).slice(0, MAX_RESULT_CHARS),
        });
      }
    }
  } catch (error) {
    if (!(error instanceof ChatRoundError)) {
      throw error;
    }
    if (!reached) {
      // Never answered: nothing was spent, so the question is handed back.
      await refundQuestion(db, today);
    }
    console.warn(`[ask-chat] no answer from ${writer.model}: ${error.failure}`);
    return refuse(unanswered(error.failure, t));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", giveUp);
  }

  const markdown = answer.trim();
  if (!markdown) {
    return refuse(t("ask.unusable"));
  }
  const body: AskChatBody = {
    kind: "chat",
    markdown,
    steps,
    untraced: untracedFigures(markdown, values, locale),
    locale,
    model: writer.model,
  };
  const id = await recordExchange(db, userId, {
    conversationId,
    title: askTitle(text),
    question: { text },
    answer: body,
  });
  emit({ type: "done", conversationId: id });
  return { conversationId: id, message: null };
}

/** Why no answer came, in the person's words. */
function unanswered(
  failure: ReadFailure,
  t: ReturnType<typeof translator>,
): string {
  switch (failure) {
    case "busy":
      return t("ask.busy");
    case "refused":
      return t("ask.accountRefused");
    case "no-credit":
      return t("ask.noCredit");
    default:
      return t("ask.noAnswer");
  }
}
