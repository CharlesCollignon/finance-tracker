import "server-only";
import { failureOf, type ReadFailure } from "./read-source";
import { sampling } from "./sampling";
import type { Writer } from "./writer";

/**
 * One round of a conversation with tools, streamed: what Ask Pluclair asks
 * of the person's model (`lib/ask/chat.ts`), through OpenRouter's chat
 * completions as the reads are (`./read-source`), with `stream: true`.
 *
 * The words arrive as they are written and are handed on at once; the tool
 * calls arrive in pieces — a name, then its arguments a few characters at a
 * time — and are put together here. A round ends with words, or with calls
 * for the app to answer before the next round.
 *
 * Nothing here logs a body: the prompt holds this person's figures.
 */

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ChatRound {
  content: string;
  toolCalls: ChatToolCall[];
}

export class ChatRoundError extends Error {
  constructor(readonly failure: ReadFailure) {
    super(failure);
  }
}

/** A little warmer than the reads: a conversation, not a caption. */
const TEMPERATURE = 0.3;

export async function streamChatRound(
  writer: Writer,
  {
    messages,
    tools,
    toolChoice,
    maxTokens,
    idleMs,
    signal,
    onText,
  }: {
    messages: readonly ChatMessage[];
    tools: readonly unknown[];
    /** `none` makes the model answer with what it has. */
    toolChoice: "auto" | "none";
    maxTokens: number;
    /** How long a silence ends the round. */
    idleMs: number;
    /** The whole question's deadline. */
    signal: AbortSignal;
    onText: (text: string) => void;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<ChatRound> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  let idle = setTimeout(abort, idleMs);
  const awake = () => {
    clearTimeout(idle);
    idle = setTimeout(abort, idleMs);
  };

  try {
    const response = await fetchImpl(writer.endpoint, {
      method: "POST",
      headers: {
        ...writer.headers,
        Authorization: `Bearer ${writer.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...writer.extra,
        model: writer.model,
        ...sampling(writer, maxTokens, TEMPERATURE),
        messages,
        tools,
        tool_choice: toolChoice,
        stream: true,
      }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new ChatRoundError(failureOf(response.status));
    }

    let content = "";
    const calls: { id: string; name: string; arguments: string }[] = [];
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";

    const take = (line: string): boolean => {
      // Server-sent events: `data: {...}` lines, comments that keep the
      // connection open, and `[DONE]` at the end.
      if (!line.startsWith("data:")) {
        return false;
      }
      const data = line.slice(5).trim();
      if (data === "[DONE]") {
        return true;
      }
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(data) as StreamChunk;
      } catch {
        return false;
      }
      if (chunk.error) {
        const code = Number(chunk.error.code);
        throw new ChatRoundError(
          failureOf(Number.isFinite(code) ? code : null),
        );
      }
      const delta = chunk.choices?.[0]?.delta;
      if (typeof delta?.content === "string" && delta.content !== "") {
        content += delta.content;
        onText(delta.content);
      }
      for (const piece of delta?.tool_calls ?? []) {
        const at = piece.index ?? calls.length;
        const call = (calls[at] ??= { id: "", name: "", arguments: "" });
        call.id ||= piece.id ?? "";
        call.name += piece.function?.name ?? "";
        call.arguments += piece.function?.arguments ?? "";
      }
      return false;
    };

    let done = false;
    while (!done) {
      const { value, done: ended } = await reader.read();
      if (ended) {
        break;
      }
      awake();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (take(line.trim())) {
          done = true;
          break;
        }
      }
    }
    if (!done && buffer.trim()) {
      take(buffer.trim());
    }
    await reader.cancel().catch(() => undefined);

    return {
      content,
      toolCalls: calls
        .filter((call) => call.name !== "")
        .map((call, index) => ({
          id: call.id || `call_${index}`,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
    };
  } catch (error) {
    if (error instanceof ChatRoundError) {
      throw error;
    }
    // Aborted — the deadline, or a silence — or the network gave way.
    throw new ChatRoundError("unreachable");
  } finally {
    clearTimeout(idle);
    signal.removeEventListener("abort", abort);
  }
}

interface StreamChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  error?: { code?: number | string; message?: string };
}
