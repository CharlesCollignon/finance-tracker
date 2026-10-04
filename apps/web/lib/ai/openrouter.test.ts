import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { authorizationUrl, checkKey, exchangeCode, newState, pkcePair } =
  await import("./openrouter");

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("pkcePair", () => {
  it("sends the S256 challenge of the verifier it keeps", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
    expect(pkcePair().verifier).not.toBe(verifier);
    expect(newState()).not.toBe(newState());
  });
});

describe("authorizationUrl", () => {
  it("asks OpenRouter for a key labelled Pluclair, bound to our state", () => {
    const url = new URL(
      authorizationUrl({
        callbackUrl: "https://pluclair.com/api/ai/openrouter/callback",
        challenge: "abc",
        state: "s1",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      callback_url: "https://pluclair.com/api/ai/openrouter/callback",
      code_challenge: "abc",
      code_challenge_method: "S256",
      key_label: "Pluclair",
      state: "s1",
    });
  });
});

describe("exchangeCode", () => {
  it("trades the code and its verifier for the user's key", async () => {
    const fetchImpl = vi.fn(async () => answer(200, { key: "sk-or-1" }));
    await expect(exchangeCode("code", "verifier", fetchImpl)).resolves.toBe(
      "sk-or-1",
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://openrouter.ai/api/v1/auth/keys");
    expect(JSON.parse(String(init.body))).toEqual({
      code: "code",
      code_verifier: "verifier",
      code_challenge_method: "S256",
    });
  });

  it("is null when OpenRouter refuses or answers without a key", async () => {
    await expect(
      exchangeCode("code", "v", async () => answer(400, { error: "bad" })),
    ).resolves.toBeNull();
    await expect(
      exchangeCode("code", "v", async () => answer(200, {})),
    ).resolves.toBeNull();
  });
});

describe("checkKey", () => {
  it("reads what the key has spent and may spend", async () => {
    const fetchImpl = vi.fn(async () =>
      answer(200, { data: { usage: 0.42, limit: 10 } }),
    );
    await expect(checkKey("sk-or-1", fetchImpl)).resolves.toEqual({
      usage: 0.42,
      limit: 10,
    });
  });

  it("is null for a key that does not work", async () => {
    await expect(
      checkKey("sk-or-1", async () => answer(401, {})),
    ).resolves.toBeNull();
  });
});
