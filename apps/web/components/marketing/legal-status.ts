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
