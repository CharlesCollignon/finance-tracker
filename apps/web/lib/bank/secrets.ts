import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Sealing the values that let this server read someone's bank.
 *
 * A credentials file is an API key plus the user's private key, and the
 * private key decrypts their whole statement history. It is stored,
 * because the four-a-day sync runs with nobody present, but never in the
 * clear: AES-256-GCM under a key that lives only in the server's environment
 * (`BANK_SECRETS_KEY`, 32 random bytes in base64). The database row alone
 * opens nothing, and GCM's tag means a row altered at rest fails to open
 * rather than opening to something else.
 *
 * Each sealed value names the key that sealed it by a short fingerprint, so
 * rotation is: set the new key, move the old one to
 * `BANK_SECRETS_KEY_PREVIOUS`, and rows reseal on their next write while the
 * old ones still open.
 *
 * Nothing here logs, and nothing returned from here may reach a browser.
 */

interface SecretKey {
  id: string;
  bytes: Buffer;
}

function readKey(name: string): SecretKey | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) {
    // A key of the wrong size is a configuration error, not "no key": saying
    // nothing would let a typo read as "bank sync unavailable" for everyone.
    throw new Error(`${name} must be 32 bytes, base64-encoded.`);
  }
  return {
    id: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
    bytes,
  };
}

function currentKey(): SecretKey {
  const key = readKey("BANK_SECRETS_KEY");
  if (!key) {
    throw new Error("BANK_SECRETS_KEY is not set.");
  }
  return key;
}

/** Whether this deployment can store bank secrets at all. */
export function secretsConfigured(): boolean {
  try {
    return readKey("BANK_SECRETS_KEY") !== null;
  } catch {
    return false;
  }
}

export interface Sealed {
  ciphertext: string;
  keyId: string;
}

/** `iv.tag.ciphertext`, each base64: everything needed to open it but the key. */
export function sealSecret(plaintext: string): Sealed {
  const key = currentKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key.bytes, iv);
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: [iv, tag, body]
      .map((part) => part.toString("base64"))
      .join("."),
    keyId: key.id,
  };
}

export function openSecret({ ciphertext, keyId }: Sealed): string {
  const key = [
    readKey("BANK_SECRETS_KEY"),
    readKey("BANK_SECRETS_KEY_PREVIOUS"),
  ]
    .filter((candidate): candidate is SecretKey => candidate !== null)
    .find((candidate) => candidate.id === keyId);
  if (!key) {
    throw new Error("No server key opens this secret.");
  }

  const [iv, tag, body] = ciphertext
    .split(".")
    .map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !body) {
    throw new Error("Malformed secret.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key.bytes, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}

/** Whether a sealed value was sealed by a key that is no longer current. */
export function needsReseal({ keyId }: Sealed): boolean {
  return currentKey().id !== keyId;
}
