import type { EntraideFilter, EntraideSort } from "@finance/core/entraide";

/**
 * Entraide's list in its address, in French — `?filtre=sans-reponse&tri=utiles`
 * — so a view can be shared; the default view says nothing.
 */
export const ENTRAIDE_FILTER_PARAM: Record<EntraideFilter, string> = {
  all: "toutes",
  unanswered: "sans-reponse",
  solved: "resolues",
  shares: "partages",
};

export const ENTRAIDE_SORT_PARAM: Record<EntraideSort, string> = {
  recent: "recentes",
  useful: "utiles",
};

function fromParam<T extends string>(
  table: Record<T, string>,
  value: unknown,
  fallback: T,
): T {
  const found = (Object.keys(table) as T[]).find((key) => table[key] === value);
  return found ?? fallback;
}

export function filterFromParam(value: unknown): EntraideFilter {
  return fromParam(ENTRAIDE_FILTER_PARAM, value, "all");
}

export function sortFromParam(value: unknown): EntraideSort {
  return fromParam(ENTRAIDE_SORT_PARAM, value, "recent");
}
