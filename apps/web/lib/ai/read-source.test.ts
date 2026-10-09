import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { readSource } = await import("./read-source");
import type { Writer } from "./writer";

const CONFIG = {
  responseFormat: (locale: string) => ({ type: "json_schema", locale }),
  maxTokens: 900,
  timeoutMs: 1000,
  logPrefix: "test-read",
};

const REQUEST = { system: "sys", user: "usr", locale: "fr" as const };

function writer(overrides: Partial<Writer> = {}): Writer {
  return {
    kind: "account",
    model: "openai/gpt-6-sol",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    key: "sk-or-1",
    temperature: null,
    reasoning: false,
    extra: { provider: { require_parameters: true } },
    headers: {},
    label: "account:u1",
    ...overrides,
  };
}

function answering(content: unknown) {
  return vi.fn(async () => ({
    choices: [{ message: { content: JSON.stringify(content) } }],
  }));
}

describe("readSource", () => {
  it("asks the writer's model with its extras, and no temperature where it takes none", async () => {
    const post = answering({ headline: "ok" });
    const source = readSource(CONFIG, writer(), { post });

    await expect(source.write(REQUEST)).resolves.toEqual({ headline: "ok" });
    expect(source.model).toBe("openai/gpt-6-sol");
    const [, body] = post.mock.calls[0] as unknown as [
      Writer,
      Record<string, unknown>,
    ];
    expect(body).toMatchObject({
      provider: { require_parameters: true },
      model: "openai/gpt-6-sol",
      max_tokens: 900,
      response_format: { type: "json_schema", locale: "fr" },
    });
    expect(body).not.toHaveProperty("temperature");
  });

  it("sends a temperature to a model that takes one", async () => {
    const post = answering({});
    await readSource(CONFIG, writer({ temperature: 0.2 }), { post }).write(
      REQUEST,
    );
    const [, body] = post.mock.calls[0] as unknown as [
      Writer,
      Record<string, unknown>,
    ];
    expect(body.temperature).toBe(0.2);
  });

  it("gives a reasoning model room to think, briefly, and time to", async () => {
    const post = answering({});
    await readSource(CONFIG, writer({ reasoning: true }), { post }).write(
      REQUEST,
    );
    const [, body, timeoutMs] = post.mock.calls[0] as unknown as [
      Writer,
      Record<string, unknown>,
      number,
    ];
    expect(body).toMatchObject({
      max_tokens: 4900,
      reasoning: { effort: "low", exclude: true },
    });
    expect(body).not.toHaveProperty("temperature");
    expect(timeoutMs).toBe(2500);
  });

  it("closes the door after three failures — for that account only", async () => {
    const failing = vi.fn(async () => {
      throw new Error("answered 402");
    });
    const now = () => 1_000;
    const mine = writer({ label: "account:mine" });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await readSource(CONFIG, mine, { post: failing, now }).write(REQUEST);
    }
    expect(failing).toHaveBeenCalledTimes(3);

    await expect(
      readSource(CONFIG, mine, { post: failing, now }).write(REQUEST),
    ).resolves.toBeNull();
    expect(failing).toHaveBeenCalledTimes(3);

    const other = answering({ fine: true });
    await expect(
      readSource(CONFIG, writer({ label: "account:theirs" }), {
        post: other,
        now,
      }).write(REQUEST),
    ).resolves.toEqual({ fine: true });
  });

  it("asks once more after a 429, a moment later", async () => {
    let calls = 0;
    const post = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("answered 429");
      }
      return { choices: [{ message: { content: '{"ok":true}' } }] };
    });
    const wait = vi.fn(async () => undefined);
    const source = readSource(CONFIG, writer({ label: "account:busy" }), {
      post,
      wait,
    });
    await expect(source.write(REQUEST)).resolves.toEqual({ ok: true });
    expect(wait).toHaveBeenCalledOnce();
    expect(source.failure()).toBeNull();
  });

  it.each([
    [429, "busy"],
    [403, "refused"],
    [402, "no-credit"],
    [500, "unreachable"],
  ] as const)("says why it has no answer after a %i", async (status, why) => {
    const post = vi.fn(async () => {
      throw new Error(`answered ${status}`);
    });
    const source = readSource(
      CONFIG,
      writer({ label: `account:status-${status}` }),
      { post, wait: async () => undefined },
    );
    await expect(source.write(REQUEST)).resolves.toBeNull();
    expect(source.failure()).toBe(why);
  });

  it("is null for an answer that is not JSON", async () => {
    const post = vi.fn(async () => ({
      choices: [{ message: { content: "not json" } }],
    }));
    await expect(
      readSource(CONFIG, writer({ label: "account:x" }), { post }).write(
        REQUEST,
      ),
    ).resolves.toBeNull();
  });
});
