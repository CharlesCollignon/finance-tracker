function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local and restart the dev server.`,
    );
  }

  if (
    name === "NEXT_PUBLIC_SUPABASE_URL" &&
    !value.includes("supabase.co")
  ) {
    throw new Error(
      `${name} must be your Supabase project URL ` +
        "(e.g. https://xxxx.supabase.co), not your app URL.",
    );
  }

  return value;
}

export function getSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
