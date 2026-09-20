import { createMistralWalletReadSource } from "@/lib/wallet-read/client";

/**
 * The one source the app uses.
 *
 * A module-level singleton so the circuit breaker inside it is shared across
 * requests in the same process — a breaker per request would never trip. Same
 * arrangement as `lib/month-read/source.ts`.
 */
export const walletReadSource = createMistralWalletReadSource();
