import type { Locale } from "../locale";
import { en, type Messages } from "./en";
import { fr } from "./fr";

export type { Messages };

/**
 * Every catalogue, keyed by locale.
 *
 * Imported eagerly rather than behind the dynamic `import()` the Next.js
 * guide suggests. Two reasons. The phone has no server to load them on, so a
 * promise there buys nothing and costs a suspense boundary on every label.
 * And the catalogues are prose, not code: two languages of it are smaller
 * than a single icon, and small enough that splitting them would trade a real
 * complication for an unmeasurable saving.
 */
export const messages: Record<Locale, Messages> = { en, fr };
