/** Parse share input — accepts comma or dot decimals (e.g. 1,1465). */
export function parseShareCountInput(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 1_000_000) / 1_000_000;
}
