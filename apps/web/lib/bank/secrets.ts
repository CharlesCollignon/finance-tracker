import "server-only";
import { createSealer, type Sealed } from "../secrets/sealer";

/**
 * Sealing the values that let this server read someone's bank.
 *
 * A credentials file is an API key plus the user's private key, and the
 * private key decrypts their whole statement history. It is stored, because
 * the four-a-day sync runs with nobody present, but never in the clear: the
 * shared sealer (`lib/secrets/sealer.ts`) under `BANK_SECRETS_KEY`, with
 * `BANK_SECRETS_KEY_PREVIOUS` for rotation.
 *
 * Nothing here logs, and nothing returned from here may reach a browser.
 */

export type { Sealed };

const bankSealer = createSealer("BANK_SECRETS_KEY");

/** Whether this deployment can store bank secrets at all. */
export function secretsConfigured(): boolean {
  return bankSealer.configured();
}

export function sealSecret(plaintext: string): Sealed {
  return bankSealer.seal(plaintext);
}

export function openSecret(sealed: Sealed): string {
  return bankSealer.open(sealed);
}

/** Whether a sealed value was sealed by a key that is no longer current. */
export function needsReseal(sealed: Sealed): boolean {
  return bankSealer.needsReseal(sealed);
}
