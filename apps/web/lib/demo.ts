/**
 * The demo account (migration 081): one auth user whose app metadata says
 * `demo: true`, set by `scripts/seed-demo.mjs` and never by the app. Safe
 * on either side: the metadata rides with the session.
 */
export function isDemoUser(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  return user?.app_metadata?.demo === true;
}
