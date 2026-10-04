import "server-only";
import { createSealer } from "../secrets/sealer";

/**
 * Sealing what lets this server call a user's AI account: the key OpenRouter
 * created for them, and the PKCE verifier of a round trip in progress.
 * Under `AI_SECRETS_KEY` (32 random bytes, base64), its own key rather than
 * the bank's, with `AI_SECRETS_KEY_PREVIOUS` for rotation.
 */
export const aiSealer = createSealer("AI_SECRETS_KEY");
