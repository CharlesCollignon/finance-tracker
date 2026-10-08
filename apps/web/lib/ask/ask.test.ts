import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ask/client", () => ({
  ASK_PLAN_SOURCE: {},
  ASK_ANSWER_SOURCE: {},
}));

const answers: unknown[] = [];
const write = vi.fn(async () => answers.shift() ?? null);
vi.mock("@/lib/ai/read-source", () => ({
  readSource: () => ({ write, model: "fake-model" }),
}));
vi.mock("@/lib/ai/writer", () => ({
  ACCOUNT_ALLOWANCE: 10_000,
  writerFor: async () => ({
    writer: { model: "fake-model", label: "pluclair" },
    account: false,
  }),
}));

const store = {
  reserve: vi.fn(async () => 3 as number | null),
  refund: vi.fn(async () => undefined),
  asked: vi.fn(async () => 2),
  record: vi.fn<(exchange: unknown) => Promise<string>>(
    async () => "conversation-1",
  ),
};
vi.mock("@finance/data/ask", () => ({
  reserveQuestion: () => store.reserve(),
  refundQuestion: () => store.refund(),
  questionsAsked: () => store.asked(),
  recordExchange: (_db: unknown, _user: unknown, exchange: unknown) =>
    store.record(exchange),
}));
vi.mock("@finance/data/ledger-search", () => ({
  searchAllMonths: async () => ({
    rows: [
      {
        occurred_on: "2026-10-04",
        note: "CARREFOUR",
        amount: 42,
        categories: { name: "Courses", type: "expense" },
      },
      {
        occurred_on: "2026-10-01",
        note: "CARREFOUR REMB",
        amount: 2,
        categories: { name: "Courses", type: "income" },
      },
    ],
    more: false,
  }),
}));
vi.mock("@/lib/ask/facts", () => ({
  gatherAskFacts: async () => [
    {
      id: "spent:2026-10:c1",
      label: "Courses, octobre 2026",
      unit: "money",
      value: 218,
      sense: "up-is-bad",
    },
  ],
}));

const { askQuestion } = await import("./ask");

const db = {} as never;
const ask = (question: string) =>
  askQuestion(db, "u1", { question, conversationId: null, locale: "fr" });

beforeEach(() => {
  answers.length = 0;
  write.mockClear();
  Object.values(store).forEach((fn) => fn.mockClear());
});

describe("askQuestion", () => {
  it("answers with the app's figures, and stores what it showed", async () => {
    answers.push(
      { kind: "facts", tools: ["spending"], search: "", advice: false },
      {
        sentences: [
          { text: "Les courses : {{fact:spent:2026-10:c1}}.", basis: [] },
        ],
      },
    );
    const outcome = await ask("Combien en courses ?");
    expect(outcome).toEqual({
      conversationId: "conversation-1",
      message: null,
      questionsLeft: 17,
    });
    expect(store.record).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Combien en courses ?",
        answer: expect.objectContaining({
          kind: "facts",
          sentences: ["Les courses : {{fact:spent:2026-10:c1}}."],
        }),
      }),
    );
  });

  it("hands the question back when the model could not be reached", async () => {
    const outcome = await ask("Combien en courses ?");
    expect(store.refund).toHaveBeenCalledOnce();
    expect(store.record).not.toHaveBeenCalled();
    expect(outcome.message).toBe(
      "Pas de réponse pour l'instant. Réessayez dans un moment.",
    );
  });

  it("answers a shop with the rows and its own sum, the model writing nothing", async () => {
    answers.push({
      kind: "search",
      tools: [],
      search: "Carrefour",
      advice: false,
    });
    await ask("Combien chez Carrefour ?");
    expect(write).toHaveBeenCalledOnce();
    expect(store.record).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: expect.objectContaining({
          kind: "search",
          query: "Carrefour",
          count: 2,
          spent: 40,
        }),
      }),
    );
  });

  it("shows nothing that did not hold up, and keeps the question counted", async () => {
    answers.push(
      { kind: "facts", tools: ["spending"], search: "", advice: true },
      {
        sentences: [
          { text: "Vous devriez dépenser 100 € de moins.", basis: [] },
        ],
      },
    );
    const outcome = await ask("Dois-je moins dépenser ?");
    expect(store.refund).not.toHaveBeenCalled();
    expect(store.record).not.toHaveBeenCalled();
    expect(outcome.message).toMatch(/rien n'y tenait/);
  });

  it("refuses a question too long before asking anyone", async () => {
    const outcome = await ask("x".repeat(400));
    expect(write).not.toHaveBeenCalled();
    expect(store.reserve).not.toHaveBeenCalled();
    expect(outcome.message).toMatch(/300/);
  });
});
