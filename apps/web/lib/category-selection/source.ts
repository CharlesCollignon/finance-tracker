import { categorySelectionJsonSchema } from "@finance/core/category-selection";
import { createMistralReadSource } from "@/lib/month-read/client";

/**
 * The chooser of the band's order: `createMistralReadSource`, fixed to this
 * surface's own schema and token ceiling.
 *
 * There is one Mistral key, one model choice, one endpoint and one
 * failure/cooldown state machine on this deployment, all defined once in
 * `lib/month-read/client.ts`, and `apiKey()` there stays the only place
 * `MISTRAL_API_KEY` is read. Nothing here opens a socket or reads an
 * environment variable — `lib/category-read/client.ts` records what the
 * second copy of that adapter cost when it existed.
 *
 * ## The ceiling
 *
 * The largest legal answer is five picks, each an id of about forty
 * characters and a remark of seventy, pretty-printed as JSON: comfortably
 * under two hundred tokens. Set well above that rather than close to it, for
 * the reason `month-read/client.ts` gives its own: a ceiling that cuts a
 * genuine answer off mid-string produces JSON that will not parse, which
 * reaches the caller as "no answer" — a paid call that produces nothing.
 */
const MAX_TOKENS = 500;

export const categorySelectionSource = createMistralReadSource({
  responseFormat: categorySelectionJsonSchema,
  maxTokens: MAX_TOKENS,
  logPrefix: "category-selection",
});
