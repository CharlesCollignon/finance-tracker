import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Sealing a secret the server must keep but must never keep in the clear.
 *
 * AES-256-GCM under a key that lives only in the server's environment (32
 * random bytes in base64). The database row alone opens nothing, and GCM's
 * tag means a row altered at rest fails to open rather than opening to
 * something else. Each sealed value names the key that sealed it by a short
 * fingerprint, so rotation is: set the new key, move the old one to the
 * `…_PREVIOUS` variable, and rows reseal on their next write while the old
 * ones still open.
 *
 * One sealer per kind of secret, each under its own key — the bank's
 * credentials (`BANK_SECRETS_KEY`) and an AI account's key
 * (`AI_SECRETS_KEY`) — so one leaked or rotated key never touches the other.
 *
 * Nothing here logs, and nothing returned from here may reach a browser.
 */

interface SecretKey {
  id: string;
  bytes: Buffer;
}

export interface Sealed {
  ciphertext: string;
  keyId: string;
}

export interface Sealer {
  /** Whether this deployment holds the key at all. */
  configured(): boolean;
  /** `iv.tag.ciphertext`, each base64: everything needed to open it but the key. */
  seal(plaintext: string): Sealed;
  open(sealed: Sealed): string;
  /** Whether a sealed value was sealed by a key that is no longer current. */
  needsReseal(sealed: Sealed): boolean;
}

function readKey(name: string): SecretKey | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) {
    // A key of the wrong size is a configuration error, not "no key": saying
    // nothing would let a typo read as "unavailable" for everyone.
    throw new Error(`${name} must be 32 bytes, base64-encoded.`);
  }
  return {
    id: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
    bytes,
  };
}

/** A sealer over `name`, with `${name}_PREVIOUS` still opening old rows. */
export function createSealer(name: string): Sealer {
  const previous = `${name}_PREVIOUS`;

  function currentKey(): SecretKey {
    const key = readKey(name);
    if (!key) {
      throw new Error(`${name} is not set.`);
    }
    return key;
  }

  return {
    configured() {
      try {
        return readKey(name) !== null;
      } catch {
        return false;
      }
    },

    seal(plaintext) {
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
    },

    open({ ciphertext, keyId }) {
      const key = [readKey(name), readKey(previous)]
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
    },

    needsReseal({ keyId }) {
      return currentKey().id !== keyId;
    },
  };
}
