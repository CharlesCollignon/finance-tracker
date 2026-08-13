/** Native app identifiers used by passkey domain association. */

export const PASSKEY_RP_ID = "pluclair.com";
export const IOS_BUNDLE_ID = "com.salutcharles.pluclair";
export const ANDROID_PACKAGE = "com.salut_charles.pluclair";

const WELL_KNOWN_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

export function wellKnownJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: WELL_KNOWN_HEADERS,
  });
}

export function appleTeamId(): string | null {
  const value = process.env.APPLE_TEAM_ID?.trim();
  return value || null;
}

export function androidSha256Fingerprints(): string[] {
  const raw = process.env.ANDROID_SHA256_FINGERPRINTS ?? "";
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
