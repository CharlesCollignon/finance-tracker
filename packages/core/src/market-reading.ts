/**
 * A market reading: what homes of one kind sold for per square metre around
 * a property, or across its commune, read from the public record of sales
 * (DVF, Etalab's per-commune files) and carried to the latest quarter.
 *
 * Every rule here was measured on Paris 11e, Lyon 3e and Gordes in Phase 0 of
 * docs/plans/REAL_ESTATE_PLAN.md:
 *
 * - Only sales (« Vente »): no new builds, exchanges, auctions or land.
 * - One disposition per mutation, and exactly one home in it — a cellar or a
 *   parking space beside it is kept (most sales have one, and keeping them
 *   moved the median by 2 % at most), premises are not.
 * - A home repeats once per parcel it sits on, so homes are told apart by
 *   kind, area, rooms and lot before they are counted.
 * - Each sale is carried to the latest quarter before the median, which is
 *   what lines three years of a falling market up.
 * - Trimmed to a third and three times the median (family sales, life
 *   annuities), then the median and the first and third quartiles.
 * - 30 sales within 500 m, else 20 in the commune, else nothing: a commune
 *   with too few sales has no reading, which is not a reading of zero.
 *
 * Pure: the files are fetched by the web server, and the price index read
 * by the caller, which hands in how to carry a price.
 */

export type MarketKind = "apartment" | "house";

/** One row of a DVF file: one disposition, one parcel, at most one local. */
export interface DvfRow {
  mutation: string;
  date: string;
  nature: string;
  disposition: string;
  price: number;
  /** "1" a house, "2" an apartment, "3" a dependency, "4" premises. */
  localType: string;
  area: number;
  rooms: string;
  lot: string;
  longitude: number | null;
  latitude: number | null;
}

export const MARKET_RULES = {
  radiusMetres: 500,
  minRadiusSales: 30,
  minCommuneSales: 20,
  /** Years read first, and how far a thin commune is widened to. */
  years: 3,
  widenedYears: 5,
  minArea: 9,
} as const;

const DVF_BASE = "https://files.data.gouv.fr/geo-dvf/latest/csv";

/** The DVF file for a commune and a year. */
export function dvfFileUrl(citycode: string, year: number): string {
  const department = citycode.startsWith("97")
    ? citycode.slice(0, 3)
    : citycode.slice(0, 2);
  return `${DVF_BASE}/${year}/communes/${department}/${citycode}.csv`;
}

/** The years the DVF listing has, newest first. */
export function readDvfYears(listing: string): number[] {
  return [...listing.matchAll(/href="[^"]*\/(\d{4})\/"/g)]
    .map((match) => Number(match[1]))
    .sort((a, b) => b - a);
}

function number(value: string | undefined): number {
  return value ? Number(value) : Number.NaN;
}

/**
 * A DVF file's rows. Etalab writes no quoted fields — its commas inside a
 * label are full stops — so a split is enough; a row of the wrong width is
 * left out rather than read askew.
 */
export function readDvfCsv(text: string): DvfRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines.shift()?.split(",") ?? [];
  const at = (name: string) => header.indexOf(name);
  const columns = {
    mutation: at("id_mutation"),
    date: at("date_mutation"),
    disposition: at("numero_disposition"),
    nature: at("nature_mutation"),
    price: at("valeur_fonciere"),
    lot: at("lot1_numero"),
    localType: at("code_type_local"),
    area: at("surface_reelle_bati"),
    rooms: at("nombre_pieces_principales"),
    longitude: at("longitude"),
    latitude: at("latitude"),
  };
  if (Object.values(columns).some((index) => index < 0)) {
    return [];
  }
  return lines.flatMap((line): DvfRow[] => {
    const cells = line.split(",");
    if (cells.length !== header.length) {
      return [];
    }
    const longitude = number(cells[columns.longitude]);
    const latitude = number(cells[columns.latitude]);
    return [
      {
        mutation: cells[columns.mutation]!,
        date: cells[columns.date]!,
        nature: cells[columns.nature]!,
        disposition: cells[columns.disposition]!,
        price: number(cells[columns.price]),
        localType: cells[columns.localType]!,
        area: number(cells[columns.area]),
        rooms: cells[columns.rooms]!,
        lot: cells[columns.lot]!,
        longitude: Number.isFinite(longitude) ? longitude : null,
        latitude: Number.isFinite(latitude) ? latitude : null,
      },
    ];
  });
}

export interface DvfSale {
  date: string;
  kind: MarketKind;
  area: number;
  price: number;
  /** € per square metre, as sold. */
  perM2: number;
  /** [longitude, latitude], when the file placed it. */
  point: [number, number] | null;
}

/** The sales a reading can stand on: one home each, nothing else sold. */
export function dvfSales(rows: readonly DvfRow[]): DvfSale[] {
  const byMutation = new Map<string, DvfRow[]>();
  for (const row of rows) {
    const list = byMutation.get(row.mutation) ?? [];
    list.push(row);
    byMutation.set(row.mutation, list);
  }

  const sales: DvfSale[] = [];
  for (const list of byMutation.values()) {
    const first = list[0]!;
    if (
      first.nature !== "Vente" ||
      new Set(list.map((row) => row.disposition)).size > 1 ||
      !(first.price > 0)
    ) {
      continue;
    }
    const locals = new Map<string, DvfRow>();
    for (const row of list) {
      if (row.localType) {
        locals.set(
          [row.localType, row.area, row.rooms, row.lot].join("|"),
          row,
        );
      }
    }
    const unique = [...locals.values()];
    const homes = unique.filter(
      (row) => row.localType === "1" || row.localType === "2",
    );
    if (homes.length !== 1 || unique.some((row) => row.localType === "4")) {
      continue;
    }
    const home = homes[0]!;
    if (!(home.area >= MARKET_RULES.minArea)) {
      continue;
    }
    const placed = list.find(
      (row) => row.longitude !== null && row.latitude !== null,
    );
    sales.push({
      date: first.date,
      kind: home.localType === "1" ? "house" : "apartment",
      area: home.area,
      price: first.price,
      perM2: first.price / home.area,
      point: placed ? [placed.longitude!, placed.latitude!] : null,
    });
  }
  return sales;
}

/** Metres between two [longitude, latitude] points, on a sphere. */
export function metresBetween(
  [lon1, lat1]: readonly [number, number],
  [lon2, lat2]: readonly [number, number],
): number {
  const radians = Math.PI / 180;
  const dLat = (lat2 - lat1) * radians;
  const dLon = (lon2 - lon1) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * radians) *
      Math.cos(lat2 * radians) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

function quantile(sorted: readonly number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

export interface MarketReading {
  scope: "radius" | "commune";
  medianM2: number;
  q1M2: number;
  q3M2: number;
  sales: number;
  periodFrom: string;
  periodTo: string;
}

function readingOf(
  sales: readonly DvfSale[],
  scope: MarketReading["scope"],
  carry: (sale: DvfSale) => number,
): MarketReading | null {
  const carried = sales.map(carry).sort((a, b) => a - b);
  if (carried.length === 0) {
    return null;
  }
  const median = quantile(carried, 0.5);
  const kept = carried.filter(
    (value) => value >= median / 3 && value <= median * 3,
  );
  const dates = sales.map((sale) => sale.date).sort();
  const round = (value: number) => Math.round(value);
  return {
    scope,
    medianM2: round(quantile(kept, 0.5)),
    q1M2: round(quantile(kept, 0.25)),
    q3M2: round(quantile(kept, 0.75)),
    sales: kept.length,
    periodFrom: dates[0]!,
    periodTo: dates.at(-1)!,
  };
}

/**
 * The reading for a home of `kind`, around `point` when there are enough
 * sales near it, else across the commune, else null. `carry` turns a sale's
 * € per m² into one of the latest quarter.
 */
export function marketReading(
  sales: readonly DvfSale[],
  {
    kind,
    point,
    carry,
  }: {
    kind: MarketKind;
    point: readonly [number, number] | null;
    carry: (sale: DvfSale) => number;
  },
): MarketReading | null {
  const ofKind = sales.filter((sale) => sale.kind === kind);
  if (point) {
    const near = ofKind.filter(
      (sale) =>
        sale.point !== null &&
        metresBetween(sale.point, point) <= MARKET_RULES.radiusMetres,
    );
    if (near.length >= MARKET_RULES.minRadiusSales) {
      return readingOf(near, "radius", carry);
    }
  }
  return ofKind.length >= MARKET_RULES.minCommuneSales
    ? readingOf(ofKind, "commune", carry)
    : null;
}
