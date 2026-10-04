import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/* An in-memory stand-in for the service-role client: the few calls the
   connection makes, against three tables keyed by their primary key. */
type Row = Record<string, unknown>;
const tables: Record<string, Map<string, Row>> = {
  ai_connect_flows: new Map(),
  ai_connections: new Map(),
  ai_connection_secrets: new Map(),
};
const KEYS: Record<string, string> = {
  ai_connect_flows: "state",
  ai_connections: "user_id",
  ai_connection_secrets: "user_id",
};

function from(name: string) {
  const table = tables[name]!;
  const key = KEYS[name]!;
  const filters: ((row: Row) => boolean)[] = [];
  let deleting = false;
  const chain = {
    delete() {
      deleting = true;
      return chain;
    },
    select() {
      return chain;
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return chain;
    },
    lt(column: string, value: string) {
      filters.push((row) => String(row[column]) < value);
      return chain;
    },
    run() {
      const hits = [...table.values()].filter((row) =>
        filters.every((test) => test(row)),
      );
      if (deleting) {
        for (const row of hits) {
          table.delete(String(row[key]));
          if (name === "ai_connections") {
            tables.ai_connection_secrets!.delete(String(row[key]));
          }
        }
      }
      return hits;
    },
    async maybeSingle() {
      return { data: chain.run()[0] ?? null, error: null };
    },
    then(resolve: (value: { error: null }) => void) {
      chain.run();
      resolve({ error: null });
    },
    async insert(row: Row) {
      table.set(String(row[key]), { ...row });
      return { error: null };
    },
    async upsert(row: Row) {
      table.set(String(row[key]), { ...table.get(String(row[key])), ...row });
      return { error: null };
    },
  };
  return chain;
}

vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("../supabase/env", () => ({
  getSiteUrl: () => "https://pluclair.test",
}));

const {
  abandonConnection,
  accountCredit,
  connectionOrigin,
  finishConnection,
  startConnection,
} = await import("./connection");
const { aiSealer } = await import("./secrets");

const USER = "11111111-1111-1111-1111-111111111111";

function openRouter({ key = "sk-or-1", keyWorks = true } = {}) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/auth/keys")) {
      return new Response(JSON.stringify(key ? { key } : {}), {
        status: key ? 200 : 400,
      });
    }
    return new Response(JSON.stringify({ data: { usage: 0, limit: null } }), {
      status: keyWorks ? 200 : 401,
    });
  });
}

async function started(mode: "redirect" | "app" = "redirect") {
  const result = await startConnection(USER, mode);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return new URL(result.url).searchParams;
}

beforeEach(() => {
  process.env.AI_SECRETS_KEY = randomBytes(32).toString("base64");
  for (const table of Object.values(tables)) {
    table.clear();
  }
});

afterEach(() => {
  delete process.env.AI_SECRETS_KEY;
  vi.unstubAllGlobals();
});

describe("startConnection", () => {
  it("keeps the state and a sealed verifier, and sends the challenge", async () => {
    const params = await started();
    const flow = tables.ai_connect_flows!.get(params.get("state")!)!;
    expect(flow.user_id).toBe(USER);
    const verifier = aiSealer.open({
      ciphertext: String(flow.verifier_ciphertext),
      keyId: String(flow.key_id),
    });
    expect(params.get("code_challenge")).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
    expect(params.get("callback_url")).toBe(
      "https://pluclair.test/api/ai/openrouter/callback",
    );
  });

  it("refuses without the sealing key", async () => {
    delete process.env.AI_SECRETS_KEY;
    await expect(startConnection(USER, "redirect")).resolves.toEqual({
      error: "aiAccount.unavailable",
    });
  });
});

describe("finishConnection", () => {
  it("stores the key sealed, on the default model, and spends the state", async () => {
    vi.stubGlobal("fetch", openRouter());
    const state = (await started("app")).get("state")!;

    await expect(finishConnection(state, "code")).resolves.toEqual({
      mode: "app",
      outcome: "connected",
    });
    expect(tables.ai_connections!.get(USER)).toMatchObject({
      provider: "openrouter",
      model: "mistralai/mistral-medium-3-5",
    });
    const secret = tables.ai_connection_secrets!.get(USER)!;
    expect(String(secret.ciphertext)).not.toContain("sk-or-1");
    expect(
      aiSealer.open({
        ciphertext: String(secret.ciphertext),
        keyId: String(secret.key_id),
      }),
    ).toBe("sk-or-1");

    await expect(finishConnection(state, "code")).resolves.toEqual({
      mode: null,
      outcome: "expired",
    });
  });

  it("keeps the model chosen before a reconnection", async () => {
    vi.stubGlobal("fetch", openRouter());
    tables.ai_connections!.set(USER, {
      user_id: USER,
      model: "anthropic/claude-sonnet-5.5",
    });
    const state = (await started()).get("state")!;
    await finishConnection(state, "code");
    expect(tables.ai_connections!.get(USER)!.model).toBe(
      "anthropic/claude-sonnet-5.5",
    );
  });

  it("stores nothing when OpenRouter refuses the code or the key", async () => {
    vi.stubGlobal("fetch", openRouter({ key: "" }));
    const first = (await started()).get("state")!;
    await expect(finishConnection(first, "code")).resolves.toMatchObject({
      outcome: "refused",
    });

    vi.stubGlobal("fetch", openRouter({ keyWorks: false }));
    const second = (await started()).get("state")!;
    await expect(finishConnection(second, "code")).resolves.toMatchObject({
      outcome: "refused",
    });
    expect(tables.ai_connections!.size).toBe(0);
    expect(tables.ai_connection_secrets!.size).toBe(0);
  });

  it("refuses a round trip past its ten minutes", async () => {
    const state = (await started()).get("state")!;
    tables.ai_connect_flows!.get(state)!.expires_at = new Date(
      Date.now() - 1000,
    ).toISOString();
    await expect(finishConnection(state, "code")).resolves.toEqual({
      mode: "redirect",
      outcome: "expired",
    });
  });
});

describe("connectionOrigin", () => {
  it("lands a trip begun in the welcome flow back there, and any other on the Profile", async () => {
    const welcome = (await startConnection(USER, "app", "welcome")) as {
      url: string;
    };
    const state = new URL(welcome.url).searchParams.get("state")!;
    expect(connectionOrigin(state)).toBe("welcome");
    expect(tables.ai_connect_flows!.has(state)).toBe(true);

    expect(connectionOrigin((await started()).get("state")!)).toBe("profile");
  });
});

describe("abandonConnection", () => {
  it("spends a declined round trip and says where it began", async () => {
    const state = (await started("app")).get("state")!;
    await expect(abandonConnection(state)).resolves.toBe("app");
    expect(tables.ai_connect_flows!.size).toBe(0);
  });
});

describe("accountCredit", () => {
  async function connected() {
    vi.stubGlobal("fetch", openRouter());
    await finishConnection((await started()).get("state")!, "code");
  }

  it("is none without a connection", async () => {
    await expect(accountCredit(USER)).resolves.toEqual({ state: "none" });
  });

  it("reads what the key has spent and may spend", async () => {
    await connected();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer sk-or-1",
        );
        return new Response(
          JSON.stringify({
            data: {
              usage: 1.5,
              usage_monthly: 0.25,
              limit: 5,
              limit_remaining: 3.5,
            },
          }),
        );
      }),
    );
    await expect(accountCredit(USER)).resolves.toEqual({
      state: "ok",
      credit: { usage: 1.5, usageMonthly: 0.25, limit: 5, limitRemaining: 3.5 },
    });
  });

  it("tells a key OpenRouter refuses from one it could not ask about", async () => {
    await connected();
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }));
    await expect(accountCredit(USER)).resolves.toEqual({ state: "refused" });

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(accountCredit(USER)).resolves.toEqual({ state: "unknown" });
  });
});
