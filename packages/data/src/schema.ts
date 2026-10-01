/**
 * Whether an error means "this feature's tables are not here yet".
 *
 * PostgREST's missing table, Postgres' missing table, and a missing column.
 * A database that has not run an optional feature's migration answers with
 * one of these, and a screen people use every day must not fall over because
 * an enhancement's migration has not been run: the caller treats it as "no
 * such feature" and every other error still throws.
 *
 * Twenty copies of this lived across the two apps before it moved here.
 */
export function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}
