import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ChatRoundError, streamChatRound } = await import("./chat-stream");
import type { Writer } from "./writer";

const WRITER: Writer = {
  kind: "account",
  model: "mistralai/mistral-medium-3-5",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  key: "sk-or-1",
  temperature: 0.2,
  reasoning: false,
  extra: { provider: { require_parameters: true } },
  headers: { "X-Title": "Pluclair" },
  label: "account:u1",
};

/** A response whose body arrives in these pieces, as a stream would cut it. */
function streaming(pieces: string[], status = 200) {
  const encoder = new TextEncoder();
  return vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const piece of pieces) {
              controller.enqueue(encoder.encode(piece));
            }
            controller.close();
          },
        }),
        { status },
      ),
  );
}

const event = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;
const text = (content: string) => event({ choices: [{ delta: { content } }] });

function round(fetchImpl: typeof fetch, onText = vi.fn()) {
  return streamChatRound(
    WRITER,
    {
      messages: [{ role: "user", content: "Combien ?" }],
      tools: [{ type: "function" }],
      toolChoice: "auto",
      maxTokens: 3000,
      idleMs: 1000,
      signal: new AbortController().signal,
      onText,
    },
    fetchImpl,
  );
}

describe("streamChatRound", () => {
  it("hands each piece of the words on as it comes", async () => {
    const onText = vi.fn();
    const fetchImpl = streaming([
      ": OPENROUTER PROCESSING\n\n",
      text("Vous avez "),
      text("dépensé"),
      "data: [DONE]\n\n",
    ]);
    const result = await round(fetchImpl as unknown as typeof fetch, onText);
    expect(result).toEqual({ content: "Vous avez dépensé", toolCalls: [] });
    expect(onText.mock.calls).toEqual([["Vous avez "], ["dépensé"]]);
  });

  it("puts tool calls together from their pieces, a line cut anywhere", async () => {
    const calls = [
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "a",
                  function: { name: "cashflow", arguments: "" },
                },
              ],
            },
          },
        ],
      }),
      event({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '{"from":' } }],
            },
          },
        ],
      }),
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: '"2026-01"}' } },
                {
                  index: 1,
                  id: "b",
                  function: { name: "loans", arguments: "{}" },
                },
              ],
            },
          },
        ],
      }),
      "data: [DONE]\n\n",
    ].join("");
    // Cut mid-line, as the network does.
    const fetchImpl = streaming([
      calls.slice(0, 37),
      calls.slice(37, 140),
      calls.slice(140),
    ]);
    const result = await round(fetchImpl as unknown as typeof fetch);
    expect(result.toolCalls).toEqual([
      {
        id: "a",
        type: "function",
        function: { name: "cashflow", arguments: '{"from":"2026-01"}' },
      },
      {
        id: "b",
        type: "function",
        function: { name: "loans", arguments: "{}" },
      },
    ]);
  });

  it("asks with the tools, the choice and a stream", async () => {
    const fetchImpl = streaming(["data: [DONE]\n\n"]);
    await round(fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(WRITER.endpoint);
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-or-1",
      "X-Title": "Pluclair",
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: WRITER.model,
      provider: { require_parameters: true },
      tools: [{ type: "function" }],
      tool_choice: "auto",
      stream: true,
      max_tokens: 3000,
    });
  });

  it("says why when the provider refuses", async () => {
    for (const [status, failure] of [
      [402, "no-credit"],
      [429, "busy"],
      [401, "refused"],
      [500, "unreachable"],
    ] as const) {
      const fetchImpl = streaming([], status);
      await expect(round(fetchImpl as unknown as typeof fetch)).rejects.toEqual(
        new ChatRoundError(failure),
      );
    }
  });

  it("stops on an error sent mid-stream", async () => {
    const fetchImpl = streaming([
      text("Vous"),
      event({ error: { code: 402, message: "no" } }),
    ]);
    await expect(
      round(fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({
      failure: "no-credit",
    });
  });

  it("gives up when the question's deadline passes", async () => {
    const deadline = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const pending = streamChatRound(
      WRITER,
      {
        messages: [],
        tools: [],
        toolChoice: "none",
        maxTokens: 10,
        idleMs: 10_000,
        signal: deadline.signal,
        onText: vi.fn(),
      },
      fetchImpl as unknown as typeof fetch,
    );
    deadline.abort();
    await expect(pending).rejects.toMatchObject({ failure: "unreachable" });
  });
});
