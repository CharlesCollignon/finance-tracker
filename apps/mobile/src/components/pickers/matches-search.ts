/**
 * Case- and accent-blind, so "cafe" finds "Café" and "epargne" finds
 * "Épargne" — the web picker's `matchesSearch`, for the phone's.
 *
 * The combining marks are stripped by range rather than with
 * `\p{Diacritic}`, which not every Hermes build understands.
 */
export function matchesSearch(text: string, query: string): boolean {
  return fold(text).includes(fold(query.trim()));
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
