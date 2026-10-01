import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  connectWithFile,
  MAX_CREDENTIALS_BYTES,
  parseCredentialsFile,
  readCredentials,
} = await import("./credentials");
import type {
  ConsentRecord,
  CredentialStore,
  StartingStatus,
  StoredCredentials,
} from "./credentials";
import type { Sealed } from "./secrets";

const PRIVATE_KEY = randomBytes(138).toString("base64");

const CONSENT: ConsentRecord = {
  version: "2026-10-01",
  givenAt: "2026-10-01T09:00:00.000Z",
};

function file(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    service: "open-banking.io",
    apiBaseUrl: "https://open-banking.io",
    user: "someone@example.test",
    apiKey: "obio_live_abcdefghijklmnop",
    encryptionKey: {
      scheme: "ecdh-p256",
      curve: "P-256",
      privateKeyFormat: "pkcs8",
      privateKey: PRIVATE_KEY,
      publicKey: "not-kept",
    },
    ...overrides,
  });
}

function memoryStore() {
  const secrets = new Map<string, Sealed>();
  const statuses = new Map<string, StartingStatus | "revoked">();
  const consents = new Map<string, ConsentRecord>();
  const store: CredentialStore = {
    async saveConnection(userId, sealed, status, consent) {
      secrets.set(userId, sealed);
      statuses.set(userId, status);
      consents.set(userId, consent);
    },
    async readSecret(userId) {
      return secrets.get(userId) ?? null;
    },
    async replaceSecret(userId, sealed) {
      secrets.set(userId, sealed);
    },
    async forgetConnection(userId) {
      secrets.delete(userId);
      statuses.set(userId, "revoked");
    },
  };
  return { store, secrets, statuses, consents };
}

/** A client that answers the way open-banking.io would. */
function answering(
  answer: "accounts" | 401 | 402 | 503 | "decrypt" | "network",
) {
  const seen: StoredCredentials[] = [];
  const open = (credentials: StoredCredentials) => {
    seen.push(credentials);
    return {
      async getAccounts() {
        if (answer === "accounts") {
          return [{}, {}] as never;
        }
        if (answer === "decrypt") {
          throw new DOMException("The operation failed", "OperationError");
        }
        if (answer === "network") {
          throw new TypeError("fetch failed");
        }
        throw new Error(`GET /accounts failed: ${answer}`);
      },
    };
  };
  return { open, seen };
}

beforeEach(() => {
  process.env.BANK_SECRETS_KEY = randomBytes(32).toString("base64");
  delete process.env.BANK_SECRETS_KEY_PREVIOUS;
});

describe("reading a credentials file", () => {
  it("keeps the two keys and nothing else from a real file", () => {
    const result = parseCredentialsFile(file());
    expect(result).toEqual({
      credentials: {
        apiKey: "obio_live_abcdefghijklmnop",
        privateKey: PRIVATE_KEY,
      },
    });
  });

  it("tolerates a byte-order mark and a key wrapped across lines", () => {
    const wrapped = PRIVATE_KEY.replace(/(.{64})/g, "$1\n");
    const result = parseCredentialsFile(
      `﻿${file({ encryptionKey: { privateKey: wrapped } })}`,
    );
    expect(result).toMatchObject({ credentials: { privateKey: PRIVATE_KEY } });
  });

  it("names what is wrong with a file it will not take", () => {
    expect(parseCredentialsFile("not json")).toEqual({ problem: "not-json" });
    expect(parseCredentialsFile(JSON.stringify({ hello: "world" }))).toEqual({
      problem: "not-credentials",
    });
    expect(parseCredentialsFile(file({ apiKey: "" }))).toEqual({
      problem: "missing-api-key",
    });
    expect(
      parseCredentialsFile(file({ encryptionKey: { privateKey: "<script>" } })),
    ).toEqual({ problem: "not-credentials" });
    expect(parseCredentialsFile("x".repeat(MAX_CREDENTIALS_BYTES + 1))).toEqual(
      { problem: "too-large" },
    );
  });

  it("recognises the encryption-key export, which has no API key", () => {
    const keyOnly = JSON.parse(file()) as Record<string, unknown>;
    delete keyOnly.apiKey;
    expect(parseCredentialsFile(JSON.stringify(keyOnly))).toEqual({
      problem: "missing-api-key",
    });
  });

  it("refuses a file that would send the key anywhere but open-banking.io", () => {
    for (const apiBaseUrl of [
      "https://evil.example",
      "http://open-banking.io",
      "https://open-banking.io.evil.example",
      "http://169.254.169.254",
    ]) {
      expect(parseCredentialsFile(file({ apiBaseUrl }))).toEqual({
        problem: "wrong-service",
      });
    }
    expect(
      parseCredentialsFile(file({ apiBaseUrl: "https://open-banking.io/" })),
    ).toHaveProperty("credentials");
  });
});

describe("connecting with a file", () => {
  it("tries the keys, then keeps them sealed", async () => {
    const { store, secrets, statuses, consents } = memoryStore();
    const { open, seen } = answering("accounts");

    const result = await connectWithFile(
      { store, open },
      "user-1",
      file(),
      CONSENT,
    );

    expect(result).toEqual({ outcome: "connected", accounts: 2 });
    expect(seen).toHaveLength(1);
    expect(consents.get("user-1")).toEqual(CONSENT);
    expect(statuses.get("user-1")).toBe("active");
    const sealed = secrets.get("user-1")!;
    expect(sealed.ciphertext).not.toContain(PRIVATE_KEY);
    expect(sealed.ciphertext).not.toContain("obio_live");
    expect(await readCredentials(store, "user-1")).toEqual({
      apiKey: "obio_live_abcdefghijklmnop",
      privateKey: PRIVATE_KEY,
    });
  });

  it("stores nothing for a file that cannot work", async () => {
    for (const [answer, problem] of [
      [401, "rejected"],
      ["decrypt", "key-mismatch"],
      [503, "unreachable"],
      ["network", "unreachable"],
    ] as const) {
      const { store, secrets } = memoryStore();
      const { open } = answering(answer);
      expect(
        await connectWithFile({ store, open }, "user-1", file(), CONSENT),
      ).toEqual({
        problem,
      });
      expect(secrets.size).toBe(0);
    }
  });

  it("keeps a good key on an empty wallet, as paused", async () => {
    const { store, statuses } = memoryStore();
    const { open } = answering(402);
    expect(
      await connectWithFile({ store, open }, "user-1", file(), CONSENT),
    ).toEqual({
      outcome: "paused",
      accounts: 0,
    });
    expect(statuses.get("user-1")).toBe("paused");
  });

  it("never tries a file it could not read", async () => {
    const { store } = memoryStore();
    const { open, seen } = answering("accounts");
    await connectWithFile({ store, open }, "user-1", "{}", CONSENT);
    expect(seen).toHaveLength(0);
  });
});

describe("reading stored credentials", () => {
  it("re-seals under the new key while a rotation is under way", async () => {
    const { store, secrets } = memoryStore();
    const { open } = answering("accounts");
    await connectWithFile({ store, open }, "user-1", file(), CONSENT);
    const before = secrets.get("user-1")!;

    process.env.BANK_SECRETS_KEY_PREVIOUS = process.env.BANK_SECRETS_KEY;
    process.env.BANK_SECRETS_KEY = randomBytes(32).toString("base64");

    expect(await readCredentials(store, "user-1")).toHaveProperty(
      "apiKey",
      "obio_live_abcdefghijklmnop",
    );
    expect(secrets.get("user-1")!.keyId).not.toBe(before.keyId);
  });

  it("finds nothing once the connection is forgotten", async () => {
    const { store } = memoryStore();
    const { open } = answering("accounts");
    await connectWithFile({ store, open }, "user-1", file(), CONSENT);
    await store.forgetConnection("user-1");
    expect(await readCredentials(store, "user-1")).toBeNull();
  });
});
