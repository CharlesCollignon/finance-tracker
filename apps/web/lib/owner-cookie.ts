/**
 * The cookie naming whose money the shared screens show (`lib/owner.ts`):
 * a space's id under « Commun », absent under « Moi ». Apart from `owner.ts`
 * so the proxy can set it too, when a notification about a space is opened.
 */
export const OWNER_COOKIE = "pluclair-owner";

/** A year: the switch is a standing choice, not a session's. */
export const OWNER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

/**
 * « Avec ma part du commun » on Le point (6b): `1` while the person's
 * spending counts their part of the shared space.
 */
export const MY_SHARE_COOKIE = "pluclair-my-share";
