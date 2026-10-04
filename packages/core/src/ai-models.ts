/**
 * The writers a connected AI account may use, by OpenRouter's id
 * (docs/plans/AI_ACCOUNT_PLAN.md, « Models »). A short list rather than the
 * whole catalogue: each is one the reads' checks were run against, and each
 * takes structured outputs. Mistral first and by default — the closest to
 * the reads Pluclair wrote before accounts were the user's.
 */
export interface AiModel {
  /** OpenRouter's id, as sent in a request. */
  id: string;
  /** The name a reader recognises. */
  name: string;
  /** Whether the model refuses a `temperature` (the GPT-6 family does). */
  fixedTemperature: boolean;
}

export const AI_MODELS: readonly AiModel[] = [
  {
    id: "mistralai/mistral-medium-3-5",
    name: "Mistral Medium 3.5",
    fixedTemperature: false,
  },
  { id: "openai/gpt-6-sol", name: "GPT-6 Sol", fixedTemperature: true },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    fixedTemperature: false,
  },
];

export const DEFAULT_AI_MODEL: AiModel = AI_MODELS[0]!;

/** The model behind an id, or the default for one no longer on the list. */
export function aiModel(id: string | null | undefined): AiModel {
  return AI_MODELS.find((model) => model.id === id) ?? DEFAULT_AI_MODEL;
}

/**
 * What a screen needs to know about who would write a read — never the key.
 * `account` says which rules apply: the user's own AI account (no monthly
 * allowance, and nothing until one is connected) or Pluclair's key (its
 * allowances).
 */
export interface WriterState {
  account: boolean;
  /** Whether a read can be written at all right now. */
  writable: boolean;
  /** The name a reader recognises, for the button that spends a call. */
  name: string;
}

/**
 * No monthly ceiling on one's own AI account — the user pays for every call
 * — so a number no month reaches. The cooldown and the guard against a
 * double press stay, in the same reservation.
 */
export const ACCOUNT_ALLOWANCE = 10_000;

/**
 * What a connected account's key has spent and may still spend, as
 * OpenRouter reports it, in US dollars. The account's own balance is not
 * among it: reading that takes a management key, which the key an OAuth
 * connection buys is not.
 */
export interface AiCredit {
  /** Spent through the key since it was made. */
  usage: number;
  /** Spent through it this UTC month. */
  usageMonthly: number;
  /** The key's spending limit, or null without one. */
  limit: number | null;
  /** What that limit still leaves, or null without one. */
  limitRemaining: number | null;
}

/**
 * The account's credit, for the Profile: no account connected; a key
 * OpenRouter no longer accepts (deleted there, or the account closed);
 * OpenRouter not answering; or what it said.
 */
export type AiCreditState =
  | { state: "none" }
  | { state: "refused" }
  | { state: "unknown" }
  | { state: "ok"; credit: AiCredit };
