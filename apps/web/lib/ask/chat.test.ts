import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const writer = {
  kind: "account",
  model: "mistralai/mistral-medium-3-5",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  key: "sk-or-1",
  temperature: 0.2,
  reasoning: false,
  extra: {},
  headers: {},
  label: "account:u1",
};

const data = vi.hoisted(() => ({
  reserveQuestion: vi.fn(),
  refundQuestion: vi.fn(),
  questionsAsked: vi.fn(),
  recordExchange: vi.fn(),
  getConversationMessages: vi.fn(),
}));
const tools = vi.hoisted(() => ({ runAskTool: vi.fn() }));
const stream = vi.hoisted(() => ({ streamChatRound: vi.fn() }));
const writers = vi.hoisted(() => ({ writerFor: vi.fn() }));

vi.mock("@finance/data/ask", () => data);
vi.mock("./tools", () => tools);
vi.mock("../ai/writer", () => ({
  ACCOUNT_ALLOWANCE: 10_000,
  writerFor: writers.writerFor,
}));
vi.mock("../ai/chat-stream", async (original) => ({
  ...(await original<typeof import("../ai/chat-stream")>()),
  streamChatRound: stream.streamChatRound,
}));

const { askChat } = await import("./chat");
const { ChatRoundError } = await import("../ai/chat-stream");

const db = {} as never;

/** A round that writes these words, a piece at a time. */
function says(content: string) {
  return async (_writer: unknown, options: { onText: (t: string) => void }) => {
    for (const piece of content.split(/(?<= )/)) {
      options.onText(piece);
    }
    return { content, toolCalls: [] };
  };
}

function calls(...names: [string, string][]) {
  return async () => ({
    content: "",
    toolCalls: names.map(([name, args], index) => ({
      id: `c${index}`,
      type: "function",
      function: { name, arguments: args },
    })),
  });
}

function ask(conversationId: string | null = null) {
  const events: unknown[] = [];
  const outcome = askChat(
    db,
    "u1",
    {
      question: "Combien ai-je dépensé depuis janvier ?",
      conversationId,
      locale: "fr",
      currency: "EUR",
    },
    (event) => events.push(event),
  );
  return { outcome, events };
}

beforeEach(() => {
  vi.clearAllMocks();
  writers.writerFor.mockResolvedValue(writer);
  data.reserveQuestion.mockResolvedValue(1);
  data.recordExchange.mockResolvedValue("conv-1");
  data.getConversationMessages.mockResolvedValue([]);
});

describe("askChat", () => {
  it("runs the tools the model calls, then keeps its answer with the figures checked", async () => {
    stream.streamChatRound
      .mockImplementationOnce(calls(["cashflow", '{"from":"2026-01"}']))
      .mockImplementationOnce(
        says("Vous avez dépensé **1 234,56 €**, soit environ 999 € de plus."),
      );
    tools.runAskTool.mockResolvedValue({
      ok: true,
      data: { totals: { spent: 1234.56 } },
    });

    const { outcome, events } = ask();
    await expect(outcome).resolves.toEqual({
      conversationId: "conv-1",
      message: null,
    });

    expect(tools.runAskTool).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", locale: "fr" }),
      "cashflow",
      '{"from":"2026-01"}',
    );
    // The tool's result went back to the model with its call's id.
    const second = stream.streamChatRound.mock.calls[1]![1];
    expect(second.messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "c0",
      content: JSON.stringify({ totals: { spent: 1234.56 } }),
    });
    expect(data.recordExchange).toHaveBeenCalledWith(db, "u1", {
      conversationId: null,
      title: "Combien ai-je dépensé depuis janvier ?",
      question: { text: "Combien ai-je dépensé depuis janvier ?" },
      answer: {
        kind: "chat",
        markdown:
          "Vous avez dépensé **1 234,56 €**, soit environ 999 € de plus.",
        steps: [{ tool: "cashflow", ok: true }],
        untraced: ["999 €"],
        locale: "fr",
        model: writer.model,
      },
    });
    expect(events[0]).toEqual({ type: "step", tool: "cashflow" });
    expect(events.at(-1)).toEqual({ type: "done", conversationId: "conv-1" });
    expect(
      events
        .filter((event) => (event as { type: string }).type === "text")
        .map((event) => (event as { text: string }).text)
        .join(""),
    ).toBe("Vous avez dépensé **1 234,56 €**, soit environ 999 € de plus.");
  });

  it("reads the conversation so far to the model", async () => {
    data.getConversationMessages.mockResolvedValue([
      { id: "1", role: "question", body: { text: "Et en mars ?" } },
      {
        id: "2",
        role: "answer",
        body: {
          kind: "chat",
          markdown: "En mars, 812 €.",
          steps: [],
          untraced: [],
          locale: "fr",
          model: "m",
        },
      },
    ]);
    stream.streamChatRound.mockImplementationOnce(says("Toujours 812 €."));

    const { outcome } = ask("conv-1");
    await outcome;

    const [, options] = stream.streamChatRound.mock.calls[0]!;
    expect(options.messages.slice(1)).toEqual([
      { role: "user", content: "Et en mars ?" },
      { role: "assistant", content: "En mars, 812 €." },
      { role: "user", content: "Combien ai-je dépensé depuis janvier ?" },
    ]);
    // A figure said before is one the answer may say again.
    expect(data.recordExchange.mock.calls[0]![2].answer.untraced).toEqual([]);
  });

  it("drops words written before a tool call", async () => {
    stream.streamChatRound
      .mockImplementationOnce(
        async (_writer: unknown, options: { onText: (t: string) => void }) => {
          options.onText("Je regarde…");
          return {
            content: "Je regarde…",
            toolCalls: [
              {
                id: "c0",
                type: "function",
                function: { name: "loans", arguments: "" },
              },
            ],
          };
        },
      )
      .mockImplementationOnce(says("Aucun prêt."));
    tools.runAskTool.mockResolvedValue({ ok: false, data: { loans: [] } });

    const { outcome, events } = ask();
    await outcome;

    expect(events).toContainEqual({ type: "reset" });
    expect(data.recordExchange.mock.calls[0]![2].answer.markdown).toBe(
      "Aucun prêt.",
    );
  });

  it("answers a tool it does not know without running anything", async () => {
    stream.streamChatRound
      .mockImplementationOnce(calls(["drop_tables", "{}"]))
      .mockImplementationOnce(says("Je ne peux pas."));

    const { outcome } = ask();
    await outcome;

    expect(tools.runAskTool).not.toHaveBeenCalled();
    const second = stream.streamChatRound.mock.calls[1]![1];
    expect(JSON.parse(second.messages.at(-1).content)).toEqual({
      error: "There is no tool named drop_tables.",
    });
  });

  it("makes the model answer once the rounds run out", async () => {
    stream.streamChatRound.mockImplementation(
      async (_writer: unknown, options: { toolChoice: string }) =>
        options.toolChoice === "none"
          ? { content: "Voilà.", toolCalls: [] }
          : calls(["calculate", '{"expression":"1+1"}'])(),
    );
    tools.runAskTool.mockResolvedValue({ ok: true, data: { result: 2 } });

    const { outcome } = ask();
    await outcome;

    const choices = stream.streamChatRound.mock.calls.map(
      ([, options]) => options.toolChoice,
    );
    expect(choices).toEqual(["auto", "auto", "auto", "auto", "auto", "none"]);
    expect(data.recordExchange).toHaveBeenCalled();
  });

  it("hands the question back when the model was never reached", async () => {
    stream.streamChatRound.mockRejectedValueOnce(
      new ChatRoundError("no-credit"),
    );

    const { outcome, events } = ask();
    const result = await outcome;

    expect(result.conversationId).toBeNull();
    expect(result.message).toMatch(/crédit/);
    expect(data.refundQuestion).toHaveBeenCalled();
    expect(data.recordExchange).not.toHaveBeenCalled();
    expect(events).toEqual([{ type: "error", message: result.message }]);
  });

  it("keeps the question counted once the model has answered something", async () => {
    stream.streamChatRound
      .mockImplementationOnce(calls(["month", "{}"]))
      .mockRejectedValueOnce(new ChatRoundError("unreachable"));
    tools.runAskTool.mockResolvedValue({ ok: true, data: {} });

    const { outcome } = ask();
    await outcome;

    expect(data.refundQuestion).not.toHaveBeenCalled();
    expect(data.recordExchange).not.toHaveBeenCalled();
  });

  it("asks nothing without an AI account", async () => {
    writers.writerFor.mockResolvedValue(null);

    const { outcome } = ask();
    const result = await outcome;

    expect(result.message).toBeTruthy();
    expect(data.reserveQuestion).not.toHaveBeenCalled();
    expect(stream.streamChatRound).not.toHaveBeenCalled();
  });
});
