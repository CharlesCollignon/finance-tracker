/**
 * The feature pages' addresses: `/fonctionnalites/<slug>`, in the words a
 * French reader would type, whatever language the page is read in (the
 * language is a cookie, not a path).
 *
 * Keyed by the page's id (`LandingPageId`, checked in `landing-copy.ts`).
 * Imports nothing, because `next.config.ts` reads it too: it sends the old
 * `/features/<id>` addresses here, permanently.
 */
export const FEATURES_BASE = "/fonctionnalites";

export const FEATURE_SLUGS = {
  bearing: "le-point",
  ledger: "journal",
  charges: "recurrents",
  plan: "plan",
  wallets: "placements",
  property: "immobilier",
  "month-close": "cloture-du-mois",
  "month-read": "lectures-ecrites",
  questions: "questions",
  together: "espace-commun",
} as const;

/**
 * Every address a feature page has had, and where it lives now. The first
 * names were the app's routes (`/features/home` described the Bearing,
 * `/features/planning` Plan); then the ids under `/features/`. The calendar
 * has no page of its own: it is a view of the Ledger, described there.
 */
export function legacyFeatureRedirects(): {
  source: string;
  destination: string;
}[] {
  const byId = Object.entries(FEATURE_SLUGS) as [string, string][];
  const renamed: [string, keyof typeof FEATURE_SLUGS][] = [
    ["home", "bearing"],
    ["transactions", "ledger"],
    ["recurring", "charges"],
    ["planning", "plan"],
    ["calendar", "ledger"],
  ];
  return [
    ...byId.map(([id, slug]) => ({
      source: `/features/${id}`,
      destination: `${FEATURES_BASE}/${slug}`,
    })),
    ...renamed.map(([from, to]) => ({
      source: `/features/${from}`,
      destination: `${FEATURES_BASE}/${FEATURE_SLUGS[to]}`,
    })),
  ];
}
