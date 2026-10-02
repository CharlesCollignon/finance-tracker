/**
 * The INSEE–Notaires index of existing-home prices: how the price of homes
 * has moved, quarter by quarter, in an area. What carries a sale, or a
 * purchase price, from its quarter to today.
 *
 * Seasonally adjusted (CVS) series, read from `bdm.insee.fr` without a key.
 * The most specific series that covers a place wins — measured in Phase 0 of
 * docs/plans/REAL_ESTATE_PLAN.md: carried by the Lyon agglomeration's
 * series, Lyon 3e's sales of 2023, 2024 and 2025 line up; by the region's,
 * they drift.
 */

/** A series is for apartments, houses, or all homes together. */
export type IndexKind = "apartment" | "house" | "all";

type SeriesByKind = Partial<Record<IndexKind, string>>;

/** The agglomerations INSEE follows, for their central city. */
const AGGLOMERATIONS: readonly {
  covers: (citycode: string) => boolean;
  series: SeriesByKind;
}[] = [
  // Lyon and its nine arrondissements.
  {
    covers: (code) => code === "69123" || /^6938[1-9]$/.test(code),
    series: { apartment: "010567011" },
  },
  // Marseille and its sixteen.
  {
    covers: (code) => code === "13055" || /^132(0[1-9]|1[0-6])$/.test(code),
    series: { apartment: "010567007" },
  },
  { covers: (code) => code === "59350", series: { house: "010567009" } },
];

/** Île-de-France by département; Paris has no house series of its own. */
const IDF_DEPARTMENTS: Record<string, SeriesByKind> = {
  "75": { apartment: "010567013" },
  "77": { apartment: "010567015", all: "010567017", house: "010567019" },
  "78": { apartment: "010567021", all: "010567023", house: "010567025" },
  "91": { apartment: "010567027", all: "010567029", house: "010567031" },
  "92": { apartment: "010567033", all: "010567035", house: "010567037" },
  "93": { apartment: "010567039", all: "010567041", house: "010567043" },
  "94": { apartment: "010567045", all: "010567047", house: "010567049" },
  "95": { apartment: "010567051", all: "010567053", house: "010567055" },
};

/** The regions INSEE follows. Every other département falls to Province. */
const REGIONS: Record<
  string,
  { departments: readonly string[]; series: SeriesByKind }
> = {
  idf: {
    departments: ["75", "77", "78", "91", "92", "93", "94", "95"],
    series: { apartment: "010567077", all: "010567079", house: "010567091" },
  },
  aura: {
    departments: [
      "01",
      "03",
      "07",
      "15",
      "26",
      "38",
      "42",
      "43",
      "63",
      "69",
      "73",
      "74",
    ],
    series: { apartment: "010567129", all: "010567131", house: "010567133" },
  },
  paca: {
    departments: ["04", "05", "06", "13", "83", "84"],
    series: { apartment: "010567111", all: "010567113", house: "010567115" },
  },
  hdf: {
    departments: ["02", "59", "60", "62", "80"],
    series: { apartment: "010567123", all: "010567125", house: "010567127" },
  },
};

const PROVINCE: SeriesByKind = {
  apartment: "010567063",
  all: "010567073",
  house: "010567075",
};

const METROPOLITAN_FRANCE: SeriesByKind = {
  apartment: "010567057",
  all: "010567059",
  house: "010567061",
};

/** France without Mayotte, the one series that covers the overseas départements. */
const FRANCE: SeriesByKind = {
  apartment: "010567117",
  all: "010567119",
  house: "010567121",
};

/** Every series the app reads, to fetch in one request. */
export const INDEX_SERIES: readonly string[] = [
  ...new Set(
    [
      ...AGGLOMERATIONS.map((entry) => entry.series),
      ...Object.values(IDF_DEPARTMENTS),
      ...Object.values(REGIONS).map((region) => region.series),
      PROVINCE,
      METROPOLITAN_FRANCE,
      FRANCE,
    ].flatMap((series) => Object.values(series)),
  ),
];

/**
 * The area's series for this kind, if it has one. A house in Paris, which
 * has none, is carried by the next area's: Île-de-France houses.
 */
function pick(series: SeriesByKind, kind: IndexKind): string[] {
  const own = series[kind];
  return own ? [own] : [];
}

/**
 * The series that could carry a home's price, most specific first, ending
 * with all of France. With no commune known, France alone.
 */
export function seriesFor(citycode: string | null, kind: IndexKind): string[] {
  const candidates: string[] = [];
  if (citycode) {
    const department = citycode.startsWith("97")
      ? citycode.slice(0, 3)
      : citycode.slice(0, 2);
    for (const agglomeration of AGGLOMERATIONS) {
      if (agglomeration.covers(citycode)) {
        candidates.push(...pick(agglomeration.series, kind));
      }
    }
    const idf = IDF_DEPARTMENTS[department];
    if (idf) {
      candidates.push(...pick(idf, kind));
    }
    const region = Object.values(REGIONS).find((entry) =>
      entry.departments.includes(department),
    );
    if (region) {
      candidates.push(...pick(region.series, kind));
    }
    if (!department.startsWith("97") && !idf) {
      candidates.push(...pick(PROVINCE, kind));
    }
    if (!department.startsWith("97")) {
      candidates.push(...pick(METROPOLITAN_FRANCE, kind));
    }
  }
  candidates.push(...pick(FRANCE, kind));
  return [...new Set(candidates)];
}

/** « 2025-Q3 » for any day of July to September 2025. */
export function quarterOf(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  return `${isoDate.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
}

/** Each series' values by quarter. */
export type PriceIndex = ReadonlyMap<string, ReadonlyMap<string, number>>;

export function priceIndexFromRows(
  rows: readonly { series: string; quarter: string; value: number }[],
): PriceIndex {
  const index = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const series = index.get(row.series) ?? new Map<string, number>();
    series.set(row.quarter, Number(row.value));
    index.set(row.series, series);
  }
  return index;
}

/** The latest quarter a series has a value for, or null for none. */
function latestOf(series: ReadonlyMap<string, number>): string | null {
  let latest: string | null = null;
  for (const quarter of series.keys()) {
    if (latest === null || quarter > latest) {
      latest = quarter;
    }
  }
  return latest;
}

export interface Carry {
  /** The series it was carried by. */
  series: string;
  from: string;
  /** The latest quarter that series has. */
  to: string;
  /** What a price of `from` is multiplied by to be a price of `to`. */
  factor: number;
}

/**
 * How a price of `fromQuarter` moves to the latest quarter, by the first
 * candidate series that has both. A quarter newer than the series' latest
 * carries by nothing; one older than its first is carried from its first.
 * Null when no candidate has any values.
 */
export function carryToLatest(
  index: PriceIndex,
  candidates: readonly string[],
  fromQuarter: string,
): Carry | null {
  for (const id of candidates) {
    const series = index.get(id);
    const to = series ? latestOf(series) : null;
    if (!series || to === null) {
      continue;
    }
    if (fromQuarter >= to) {
      return { series: id, from: to, to, factor: 1 };
    }
    let from = fromQuarter;
    if (!series.has(from)) {
      const earlier = [...series.keys()].filter((quarter) => quarter <= from);
      from =
        earlier.length > 0
          ? earlier.sort().at(-1)!
          : [...series.keys()].sort()[0]!;
    }
    const start = series.get(from)!;
    const end = series.get(to)!;
    return { series: id, from, to, factor: end / start };
  }
  return null;
}

const INSEE_SDMX = "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/";

/** The request for `series` from `startQuarter` on: one call for all. */
export function inseeIndexUrl(
  series: readonly string[],
  startQuarter: string,
): string {
  return `${INSEE_SDMX}${series.join("+")}?startPeriod=${startQuarter}`;
}

/** INSEE's SDMX answer as rows; anything it cannot read is left out. */
export function readInseeIndex(
  xml: string,
): { series: string; quarter: string; value: number }[] {
  const rows: { series: string; quarter: string; value: number }[] = [];
  for (const match of xml.matchAll(
    /<Series [^>]*IDBANK="(\d{9})"[^>]*>([\s\S]*?)<\/Series>/g,
  )) {
    for (const obs of match[2]!.matchAll(
      /TIME_PERIOD="(\d{4}-Q[1-4])" OBS_VALUE="([0-9.]+)"/g,
    )) {
      const value = Number(obs[2]);
      if (Number.isFinite(value) && value > 0) {
        rows.push({ series: match[1]!, quarter: obs[1]!, value });
      }
    }
  }
  return rows;
}
