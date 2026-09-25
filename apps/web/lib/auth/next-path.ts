/**
 * Where an auth link may send the reader next.
 *
 * Only a same-origin path ("/foo"), never "//host", an absolute URL or a
 * backslash trick, so a crafted link cannot bounce a freshly signed-in reader
 * to somebody else's site.
 */
export function sanitizeNextPath(raw: string | null, fallback: string): string {
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
  ) {
    return raw;
  }
  return fallback;
}

/**
 * Where the confirm route sends a reset link.
 *
 * A verified link goes on to choosing a new password. One that has expired or
 * was already used goes back to the reset form with a sentence saying so,
 * rather than to the sign-in page, whose "link expired" message offers no way
 * to ask for another.
 */
export function confirmRedirect({
  verified,
  next,
}: {
  verified: boolean;
  next: string | null;
}): string {
  if (!verified) {
    return "/reset?error=link_expired";
  }
  return sanitizeNextPath(next, "/reset/new");
}

/**
 * Where a failed `/auth/callback` code exchange sends the reader.
 *
 * That route is also where a reset link lands (see `confirmRedirect`'s
 * comment on why). A reset link that fails there — expired, already used, a
 * mail provider's scanner having spent it, or opened on a different device
 * than the one that asked — is failing on the one path a reset link ever
 * takes, so it goes back to the reset form with a sentence saying so, the
 * same as a failure in `/auth/confirm`. Every other failure keeps the
 * generic sign-in screen.
 */
export function callbackFailureRedirect(next: string): string {
  if (next === "/reset/new") {
    return "/reset?error=link_expired";
  }
  return "/login?error=auth_callback";
}
