import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/writer", () => ({ writerFor: vi.fn(async () => null) }));

import type { Writer } from "@/lib/ai/writer";
import { SCAN_MODEL, scanStatement } from "./scan";

const WRITER: Writer = {
  kind: "account",
  model: "openai/gpt-6-sol",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  key: "sk-test",
  temperature: null,
  reasoning: true,
  extra: { provider: { require_parameters: true } },
  headers: {},
  label: "account:scan-test",
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function answered(content: unknown) {
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
}

const READ = {
  statement: true,
  bank: "BoursoBank",
  iban: null,
  accountNumber: null,
  currency: "EUR",
  periodFrom: null,
  periodTo: null,
  openingBalance: null,
  closingBalance: null,
  lines: ["2026-10-02|CB MONOPRIX|-12.30|"],
};

describe("scanStatement", () => {
  it("asks Mistral alone, on the person's account, with the picture", async () => {
    const post = vi.fn(async () => answered(READ));
    const result = await scanStatement("user-1", PNG, "image", {
      writer: { ...WRITER, label: "account:scan-1" },
      post,
    });

    expect("statement" in result && result.statement.readByAi).toBe(true);
    const lines = "statement" in result ? result.statement.blocks[0]!.lines : [];
    expect(lines.map((line) => [line.amount, line.creditDebitIndicator])).toEqual([
      ["12.30", "DBIT"],
    ]);

    const [writer, body] = post.mock.calls[0] as unknown as [
      Writer,
      Record<string, unknown>,
    ];
    expect(writer.key).toBe("sk-test");
    expect(body.model).toBe(SCAN_MODEL);
    expect(body.temperature).toBe(0);
    expect(body.provider).toMatchObject({
      only: ["mistral/eu"],
      allow_fallbacks: false,
    });
    const user = (body.messages as { role: string; content: unknown }[])[1]!;
    expect(user.content).toEqual([
      { type: "text", text: "Read the operations in this picture." },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${Buffer.from(PNG).toString("base64")}` },
      },
    ]);
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
  });

  it("sends a scanned PDF as a file", async () => {
    const post = vi.fn(async () => answered(READ));
    await scanStatement("user-1", new TextEncoder().encode("%PDF-1.4"), "pdf", {
      writer: { ...WRITER, label: "account:scan-2" },
      post,
    });
    const body = (post.mock.calls[0] as unknown as [Writer, { messages: { content: unknown[] }[] }])[1];
    expect(body.messages[1]!.content[1]).toMatchObject({
      type: "file",
      file: { filename: "statement.pdf" },
    });
  });

  it("says what stopped it: no account, a picture it cannot send, no credit", async () => {
    expect(await scanStatement("user-1", PNG, "image")).toEqual({
      error: "statements.scanNoAccount",
    });
    expect(
      await scanStatement("user-1", new Uint8Array([1, 2, 3, 4]), "image", {
        writer: WRITER,
      }),
    ).toEqual({ error: "statements.imageKind" });
    const broke = vi.fn(async () => {
      throw new Error("answered 402");
    });
    expect(
      await scanStatement("user-1", PNG, "image", {
        writer: { ...WRITER, label: "account:scan-3" },
        post: broke,
      }),
    ).toEqual({ error: "statements.scanNoCredit" });
  });
});
