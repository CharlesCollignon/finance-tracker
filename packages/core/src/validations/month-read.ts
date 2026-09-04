import { z } from "zod";

/**
 * Which month to write about.
 *
 * Coerced because it arrives from a form or a JSON body, and bounded because
 * the month reaches date arithmetic where a 13 rolls silently into the next
 * year. Same shape as `monthCloseSchema`.
 */
export const monthReadRequestSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
