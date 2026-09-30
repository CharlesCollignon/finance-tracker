import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { needsReseal, openSecret, sealSecret, secretsConfigured } =
  await import("./secrets");

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");

describe("bank secrets", () => {
  beforeEach(() => {
    process.env.BANK_SECRETS_KEY = KEY_A;
    delete process.env.BANK_SECRETS_KEY_PREVIOUS;
  });

  afterEach(() => {
    delete process.env.BANK_SECRETS_KEY;
    delete process.env.BANK_SECRETS_KEY_PREVIOUS;
  });

  it("opens what it sealed", () => {
    const sealed = sealSecret('{"privateKey":"secret"}');
    expect(sealed.ciphertext).not.toContain("secret");
    expect(openSecret(sealed)).toBe('{"privateKey":"secret"}');
  });

  it("never seals the same value to the same text twice", () => {
    expect(sealSecret("same").ciphertext).not.toBe(
      sealSecret("same").ciphertext,
    );
  });

  it("refuses a value altered at rest", () => {
    const sealed = sealSecret("untouched");
    const [iv, tag, body] = sealed.ciphertext.split(".");
    const flipped = Buffer.from(body!, "base64");
    flipped[0] = flipped[0]! ^ 1;
    expect(() =>
      openSecret({
        ...sealed,
        ciphertext: [iv, tag, flipped.toString("base64")].join("."),
      }),
    ).toThrow();
  });

  it("still opens rows sealed by the previous key after a rotation", () => {
    const old = sealSecret("before rotation");
    process.env.BANK_SECRETS_KEY = KEY_B;
    process.env.BANK_SECRETS_KEY_PREVIOUS = KEY_A;
    expect(openSecret(old)).toBe("before rotation");
    expect(needsReseal(old)).toBe(true);
    expect(needsReseal(sealSecret("after"))).toBe(false);
  });

  it("opens nothing once the sealing key is gone", () => {
    const sealed = sealSecret("gone");
    process.env.BANK_SECRETS_KEY = KEY_B;
    expect(() => openSecret(sealed)).toThrow(
      "No server key opens this secret.",
    );
  });

  it("says when no key is configured, and rejects a key of the wrong size", () => {
    delete process.env.BANK_SECRETS_KEY;
    expect(secretsConfigured()).toBe(false);
    process.env.BANK_SECRETS_KEY = Buffer.from("short").toString("base64");
    expect(secretsConfigured()).toBe(false);
    expect(() => sealSecret("x")).toThrow("32 bytes");
  });
});
