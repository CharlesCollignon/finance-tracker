/**
 * Whether the privacy policy and terms are still drafts awaiting the
 * operator's review.
 *
 * While true, a production deployment answers 404 on both pages and every
 * link to them is left out; preview and local builds show them, with a banner
 * saying so, so they can be read where they will live. Flip it once every
 * `[[…]]` in `legal-copy.ts` and `legal-copy.fr.ts` is filled and the text has
 * been checked.
 *
 * A module of its own so a client component can ask without shipping both
 * documents to the browser.
 */
export const LEGAL_DRAFT = true;

/**
 * Whether the documents may be served, and linked to, on this deployment.
 *
 * Server-side only in effect: `VERCEL_ENV` is not exposed to a browser, where
 * this would always answer yes. A client component asks `LEGAL_DRAFT` instead,
 * and so links to the documents only once they are final.
 */
export function legalPagesVisible(): boolean {
  return !LEGAL_DRAFT || process.env.VERCEL_ENV !== "production";
}

/**
 * Whether « Les règles d'Entraide » (`entraide-rules-copy.ts`) is still a
 * draft. Apart from `LEGAL_DRAFT`, so the privacy policy and the terms can
 * be signed off before Entraide exists. While true, production answers 404
 * on the page; flip it when every `[[…]]` in it is filled, the text has been
 * checked, and Entraide is about to open.
 */
export const ENTRAIDE_RULES_DRAFT = true;

/** Whether « Les règles d'Entraide » may be served on this deployment. */
export function entraideRulesVisible(): boolean {
  return !ENTRAIDE_RULES_DRAFT || process.env.VERCEL_ENV !== "production";
}
