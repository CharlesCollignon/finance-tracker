/**
 * Feature flags, as the apps see them.
 *
 * The database decides (`evaluated_feature_flags()`, migration 039): a flag's
 * default, its cut-off for new accounts, and per-account overrides. This
 * module only turns that answer into a set the apps can ask, and its rule is
 * that anything short of a clear "on" is off — a key this build does not
 * know, a row missing, a malformed answer. A flag's off side is the app as it
 * was, so off is the one wrong answer that costs nothing.
 *
 * A flag is added here in the same change that reads it: the database may
 * hold flags an older build has never heard of, and those are ignored.
 */

const FLAG_KEYS = [
  /** Rename, merge and delete tags on the Plan page (Phase 0, T6). */
  "tags.manage",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/** The flags that are on. Anything absent is off. */
export type FlagSet = ReadonlySet<FlagKey>;

export const NO_FLAGS: FlagSet = new Set<FlagKey>();

function isFlagKey(value: unknown): value is FlagKey {
  return (
    typeof value === "string" &&
    (FLAG_KEYS as readonly string[]).includes(value)
  );
}

/** The rows `evaluated_feature_flags()` returned, as the flags that are on. */
export function flagsFromRows(rows: unknown): FlagSet {
  if (!Array.isArray(rows)) {
    return NO_FLAGS;
  }
  const on = new Set<FlagKey>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const { key, enabled } = row as { key?: unknown; enabled?: unknown };
    if (enabled === true && isFlagKey(key)) {
      on.add(key);
    }
  }
  return on;
}

export function isFlagOn(flags: FlagSet, key: FlagKey): boolean {
  return flags.has(key);
}

/** The phone keeps the last answer between launches: the keys that are on. */
export function serializeFlags(flags: FlagSet): string {
  return JSON.stringify([...flags].sort());
}

/**
 * The cached answer, or null when there is none worth trusting.
 *
 * Null rather than "no flags" for a damaged entry, so the caller can tell
 * "nothing cached" from "cached, and everything was off".
 */
export function parseStoredFlags(raw: string | null): FlagSet | null {
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  return new Set(parsed.filter(isFlagKey));
}
