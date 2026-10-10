import { describe, expect, it } from "vitest";

import {
  askChatHistory,
  askChatSystem,
  askChatToolDefinitions,
  ASK_CHAT_TOOL_NAMES,
  isAskChatTool,
  readToolArgs,
  type AskChatBody,
} from "./ask-chat";

describe("askChatToolDefinitions", () => {
  it("describes every tool as a chat completion takes it", () => {
    const tools = askChatToolDefinitions();
    expect(tools.map((tool) => tool.function.name)).toEqual(
      ASK_CHAT_TOOL_NAMES,
    );
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      expect(tool.function.description.length).toBeGreaterThan(20);
      expect(tool.function.parameters).toMatchObject({ type: "object" });
      expect(tool.function.parameters).not.toHaveProperty("$schema");
    }
  });

  it("says what each argument is", () => {
    const transactions = askChatToolDefinitions().find(
      (tool) => tool.function.name === "transactions",
    )!;
    expect(transactions.function.parameters).toMatchObject({
      additionalProperties: false,
      properties: {
        sort: { enum: ["recent", "largest"] },
        limit: { maximum: 50 },
      },
    });
  });
});

describe("readToolArgs", () => {
  it("reads the arguments a tool takes", () => {
    expect(readToolArgs("month", '{"month":"2026-03"}')).toEqual({
      month: "2026-03",
    });
    expect(readToolArgs("calculate", '{"expression":"1+1"}')).toEqual({
      expression: "1+1",
    });
  });

  it("takes an empty string for a tool with no arguments", () => {
    expect(readToolArgs("loans", "")).toEqual({});
    expect(readToolArgs("loans", "{}")).toEqual({});
  });

  it("refuses arguments that are not JSON or not the tool's", () => {
    expect(readToolArgs("month", "{month")).toBeNull();
    expect(readToolArgs("month", '{"month":"March"}')).toBeNull();
    expect(readToolArgs("month", '{"month":"2026-03","x":1}')).toBeNull();
    expect(readToolArgs("transactions", '{"limit":500}')).toBeNull();
  });
});

describe("isAskChatTool", () => {
  it("knows the tools by name, and nothing else", () => {
    expect(isAskChatTool("cashflow")).toBe(true);
    expect(isAskChatTool("toString")).toBe(false);
    expect(isAskChatTool("delete_everything")).toBe(false);
  });
});

describe("askChatHistory", () => {
  const chat = (markdown: string): AskChatBody => ({
    kind: "chat",
    markdown,
    steps: [],
    untraced: [],
    locale: "fr",
    model: "m",
  });

  it("turns the conversation into the model's turns", () => {
    expect(
      askChatHistory(
        [
          { role: "question", body: { text: "Combien ?" } },
          { role: "answer", body: chat("**12 €**") },
        ],
        String,
      ),
    ).toEqual([
      { role: "user", content: "Combien ?" },
      { role: "assistant", content: "**12 €**" },
    ]);
  });

  it("writes a first-version answer out with its figures", () => {
    const [, answer] = askChatHistory(
      [
        { role: "question", body: { text: "Courses ?" } },
        {
          role: "answer",
          body: {
            kind: "facts",
            sentences: ["Les courses ont coûté {{fact:c}}."],
            facts: [
              {
                id: "c",
                label: "Courses",
                unit: "money",
                value: 312,
                sense: "up-is-bad",
              },
            ],
            advice: false,
            locale: "fr",
            model: "m",
          },
        },
      ],
      (amount) => `${amount} €`,
    );
    expect(answer).toEqual({
      role: "assistant",
      content: "Les courses ont coûté 312 €.",
    });
  });

  it("keeps the last exchanges, whole", () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0
        ? { role: "question" as const, body: { text: `q${index}` } }
        : { role: "answer" as const, body: chat(`a${index}`) },
    );
    const turns = askChatHistory(messages, String);
    expect(turns).toHaveLength(16);
    expect(turns[0]).toEqual({ role: "user", content: "q4" });
  });
});

describe("askChatSystem", () => {
  it("dates the conversation and names the currency", () => {
    const system = askChatSystem({
      locale: "fr",
      today: "2026-10-10",
      currency: "EUR",
    });
    expect(system).toContain("2026-10-10");
    expect(system).toContain("EUR");
  });

  it("draws the line at products in both languages", () => {
    expect(
      askChatSystem({ locale: "fr", today: "2026-10-10", currency: "EUR" }),
    ).toMatch(/ne recommandez jamais un produit/);
    expect(
      askChatSystem({ locale: "en", today: "2026-10-10", currency: "EUR" }),
    ).toMatch(/never recommend a specific product/);
  });
});
