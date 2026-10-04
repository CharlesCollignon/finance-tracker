import { walletReadJsonSchema } from "@finance/core/wallet-read";
import type { ReadSourceConfig } from "@/lib/ai/read-source";

/**
 * The portfolio review's request, sent by the one adapter
 * (`lib/ai/read-source.ts`) to whichever writer the user has.
 *
 * Room for the largest answer the schema permits, and then some: a headline,
 * four observations and four suggestions at 240 characters each, every one
 * carrying a basis array and four enum fields. Pretty-printed that is past a
 * thousand tokens, and an answer cut off mid-string fails `JSON.parse` — a
 * paid call that produces nothing. The longest of the reads, so the most
 * patient.
 */
export const WALLET_READ_SOURCE: ReadSourceConfig = {
  responseFormat: walletReadJsonSchema,
  maxTokens: 2000,
  timeoutMs: 30_000,
  logPrefix: "wallet-read",
};
