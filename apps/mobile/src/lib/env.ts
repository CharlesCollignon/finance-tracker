/**
 * Expo inlines EXPO_PUBLIC_* variables at build time. We validate them once
 * here so a misconfigured .env fails loudly instead of at the first request.
 */
function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing ${name}. Local: add it to apps/mobile/.env and restart with -c. EAS: set it on the Expo environment for this build profile, then rebuild.`,
    );
  }
  return trimmed;
}

export const SUPABASE_URL = required(
  "EXPO_PUBLIC_SUPABASE_URL",
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Where the web app lives, for the one thing the phone cannot do itself.
 *
 * The open-banking credentials bundle is a decryption key and stays in the web
 * server's environment, so asking the bank for anything new has to go through
 * it. Optional rather than required: without it the app still works exactly
 * as it did — a refresh re-reads Supabase — and only the "ask the bank" half
 * is unavailable. Making it required would stop the app booting for anyone
 * who has not connected a bank at all.
 */
export const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL?.trim().replace(/\/+$/, "") || null;
