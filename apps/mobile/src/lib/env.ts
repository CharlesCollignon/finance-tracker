/**
 * Expo inlines EXPO_PUBLIC_* variables at build time. We validate them once
 * here so a misconfigured .env fails loudly instead of at the first request.
 */
function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing ${name}. Add it to apps/mobile/.env and restart Expo with -c.`,
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
