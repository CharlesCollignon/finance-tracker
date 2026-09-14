import { createMistralInstrumentReadingSource } from "@/lib/instrument-reading/client";

/**
 * The one source the app uses.
 *
 * Module-level so the circuit breaker is shared across requests in the same
 * process; a breaker per request would never trip.
 */
export const instrumentReadingSource = createMistralInstrumentReadingSource();
