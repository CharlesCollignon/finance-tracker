/**
 * `?review=inbox`, stamped with when it was asked for.
 *
 * The Journal is a tab and stays mounted, so a second ask for the review —
 * another "6 entries need a category" tapped, the Bearing's row pressed —
 * landed on the same address as the first, onto a sheet the reader had
 * already closed, which stayed closed. The stamp makes every ask a new
 * address, and the Journal opens the review again for each one.
 */
export function reviewAsk(): { review: "inbox"; at: string } {
  return { review: "inbox", at: String(Date.now()) };
}

/** `params` with a fresh stamp when they ask for the review, as they were otherwise. */
export function stampReviewAsk(
  params: Record<string, string>,
): Record<string, string> {
  return params.review === "inbox" ? { ...params, ...reviewAsk() } : params;
}
