/**
 * Asking rents around a property: what homes like it are advertised for per
 * square metre in its commune, from the ANIL's « Carte des loyers » — one
 * edition a year on data.gouv.fr, four tables (apartments, of one or two
 * rooms, of three or more, houses), one row per commune.
 *
 * What the figure is, from the ANIL's own guide (December 2025): a model's
 * prediction for a reference home — 52 m² for an apartment, 37 for one or
 * two rooms, 72 for three or more, 92 for a house — let unfurnished,
 * charges included, advertised in the third quarter of the edition's year.
 * Not a median of leases signed, and not the legal « loyer de référence »
 * of the towns that cap rents. Its interval is a 95 % prediction interval.
 *
 * The guide asks for caution where the commune has fewer than 30 listings
 * or the model fits poorly (adjusted R² under 0.5). Such a figure is not
 * kept at all: no figure is said, rather than a fragile one.
 *
 * Pure: the files are fetched by the web server.
 */

import type {
  PropertyKind,
  RentScope,
  RentSeries,
} from "./types/database";

export const ANIL_RULES = {
  minObservations: 30,
  minR2: 0.5,
} as const;

/** The table a property is read from: by its rooms when known. */
export function rentSeriesFor(
  kind: PropertyKind,
  rooms: number | null,
): RentSeries | null {
  if (kind === "house") {
    return "mai";
  }
  if (kind !== "apartment") {
    return null;
  }
  if (rooms === null) {
    return "app";
  }
  return rooms <= 2 ? "app12" : "app3";
}

const DATASET =
  "https://www.data.gouv.fr/api/1/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-";

/**
 * data.gouv.fr's description of an edition, which lists its files. Each
 * year's map is a dataset of its own, under the same name and the year.
 */
export function anilDatasetUrl(edition: number): string {
  return `${DATASET}${edition}/`;
}

/**
 * A table's file in an edition's description, or null. The files have kept
 * their names since the 2023 edition: `pred-app-mef-dhup.csv` and so on.
 */
export function anilFileUrl(
  dataset: unknown,
  series: RentSeries,
): string | null {
  const resources =
    typeof dataset === "object" && dataset !== null && "resources" in dataset
      ? (dataset as { resources: unknown }).resources
      : null;
  if (!Array.isArray(resources)) {
    return null;
  }
  const file = `/pred-${series}-mef-dhup.csv`;
  for (const resource of resources) {
    const url =
      typeof resource === "object" && resource !== null && "url" in resource
        ? (resource as { url: unknown }).url
        : null;
    if (typeof url === "string" && url.endsWith(file)) {
      return url;
    }
  }
  return null;
}

/** One commune's row of a table. */
export interface AnilRow {
  rentM2: number;
  lowM2: number;
  highM2: number;
  scope: string;
  observations: number;
  r2: number;
}

function unquote(cell: string): string {
  return cell.replace(/^"(.*)"$/, "$1");
}

function decimal(cell: string | undefined): number {
  return cell ? Number(unquote(cell).replace(",", ".")) : Number.NaN;
}

/**
 * A table's rows by commune code. The ANIL writes semicolons, quoted text,
 * decimal commas and no semicolon inside a field, so a split is enough; a
 * row of the wrong width is left out rather than read askew.
 */
export function readAnilCsv(text: string): Map<string, AnilRow> {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const header = (lines.shift() ?? "").split(";").map(unquote);
  const at = (name: string) => header.indexOf(name);
  const columns = {
    citycode: at("INSEE_C"),
    rent: at("loypredm2"),
    low: at("lwr.IPm2"),
    high: at("upr.IPm2"),
    scope: at("TYPPRED"),
    observations: at("nbobs_com"),
    r2: at("R2_adj"),
  };
  const rows = new Map<string, AnilRow>();
  if (Object.values(columns).some((index) => index < 0)) {
    return rows;
  }
  for (const line of lines) {
    const cells = line.split(";");
    if (cells.length !== header.length) {
      continue;
    }
    rows.set(unquote(cells[columns.citycode]!), {
      rentM2: decimal(cells[columns.rent]),
      lowM2: decimal(cells[columns.low]),
      highM2: decimal(cells[columns.high]),
      scope: unquote(cells[columns.scope]!).toLowerCase(),
      observations: decimal(cells[columns.observations]),
      r2: decimal(cells[columns.r2]),
    });
  }
  return rows;
}

export interface RentReference {
  series: RentSeries;
  /** € per m², charges included, rounded to the cent. */
  rentM2: number;
  lowM2: number;
  highM2: number;
  scope: RentScope;
  /** Listings in the commune behind it. */
  observations: number;
  /** The map's edition: « 2025 » is listings of the third quarter of 2025. */
  edition: number;
}

const SCOPES: readonly RentScope[] = ["commune", "epci", "maille"];

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A commune's figure, when the ANIL's own cautions leave one to say. */
export function rentReference(
  row: AnilRow | undefined,
  series: RentSeries,
  edition: number,
): RentReference | null {
  if (
    !row ||
    !(row.rentM2 > 0) ||
    !(row.lowM2 > 0 && row.lowM2 <= row.rentM2 && row.rentM2 <= row.highM2) ||
    !(row.observations >= ANIL_RULES.minObservations) ||
    !(row.r2 >= ANIL_RULES.minR2) ||
    !SCOPES.includes(row.scope as RentScope)
  ) {
    return null;
  }
  return {
    series,
    rentM2: cents(row.rentM2),
    lowM2: cents(row.lowM2),
    highM2: cents(row.highM2),
    scope: row.scope as RentScope,
    observations: row.observations,
    edition,
  };
}
