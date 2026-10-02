import { describe, expect, it } from "vitest";
import {
  dvfFileUrl,
  dvfSales,
  marketReading,
  metresBetween,
  readDvfCsv,
  readDvfYears,
  type DvfRow,
  type DvfSale,
} from "./market-reading";

/** The columns `readDvfCsv` reads, in DVF's own order, padded to its width. */
const HEADER =
  "id_mutation,date_mutation,numero_disposition,nature_mutation,valeur_fonciere,adresse_numero,adresse_suffixe,adresse_nom_voie,adresse_code_voie,code_postal,code_commune,nom_commune,code_departement,ancien_code_commune,ancien_nom_commune,id_parcelle,ancien_id_parcelle,numero_volume,lot1_numero,lot1_surface_carrez,lot2_numero,lot2_surface_carrez,lot3_numero,lot3_surface_carrez,lot4_numero,lot4_surface_carrez,lot5_numero,lot5_surface_carrez,nombre_lots,code_type_local,type_local,surface_reelle_bati,nombre_pieces_principales,code_nature_culture,nature_culture,code_nature_culture_speciale,nature_culture_speciale,surface_terrain,longitude,latitude";

function line(fields: {
  id: string;
  date?: string;
  disposition?: string;
  nature?: string;
  price: number;
  lot?: string;
  type?: string;
  area?: number;
  rooms?: number;
  lon?: number;
  lat?: number;
}): string {
  const cells = new Array<string>(40).fill("");
  cells[0] = fields.id;
  cells[1] = fields.date ?? "2025-03-01";
  cells[2] = fields.disposition ?? "000001";
  cells[3] = fields.nature ?? "Vente";
  cells[4] = String(fields.price);
  cells[18] = fields.lot ?? "";
  cells[29] = fields.type ?? "";
  cells[31] = fields.area === undefined ? "" : String(fields.area);
  cells[32] = fields.rooms === undefined ? "" : String(fields.rooms);
  cells[38] = fields.lon === undefined ? "" : String(fields.lon);
  cells[39] = fields.lat === undefined ? "" : String(fields.lat);
  return cells.join(",");
}

const HOME: [number, number] = [4.841934, 45.759099];

function sale(overrides: Partial<DvfSale> = {}): DvfSale {
  return {
    date: "2025-03-01",
    kind: "apartment",
    area: 50,
    price: 250_000,
    perM2: 5_000,
    point: HOME,
    ...overrides,
  };
}

describe("readDvfCsv", () => {
  it("reads the columns a reading needs", () => {
    const rows = readDvfCsv(
      [
        HEADER,
        line({
          id: "m1",
          price: 220000,
          type: "2",
          area: 42,
          rooms: 2,
          lot: "109",
          lon: 4.857,
          lat: 45.756,
        }),
      ].join("\n"),
    );

    expect(rows).toEqual<DvfRow[]>([
      {
        mutation: "m1",
        date: "2025-03-01",
        nature: "Vente",
        disposition: "000001",
        price: 220000,
        localType: "2",
        area: 42,
        rooms: "2",
        lot: "109",
        longitude: 4.857,
        latitude: 45.756,
      },
    ]);
  });

  it("leaves out a row of the wrong width, and a file it cannot read", () => {
    expect(readDvfCsv([HEADER, "m1,2025-01-01"].join("\n"))).toEqual([]);
    expect(readDvfCsv("not,a,dvf,file\n1,2,3,4")).toEqual([]);
  });
});

describe("dvfSales", () => {
  const rows = readDvfCsv(
    [
      HEADER,
      // An apartment with its cellar: kept.
      line({
        id: "a",
        price: 300000,
        type: "2",
        area: 60,
        rooms: 3,
        lot: "12",
        lon: 4.84,
        lat: 45.76,
      }),
      line({ id: "a", price: 300000, type: "3", lot: "40" }),
      // The same house on two parcels: one home, kept.
      line({ id: "b", price: 500000, type: "1", area: 100, rooms: 5 }),
      line({ id: "b", price: 500000, type: "1", area: 100, rooms: 5 }),
      // Two apartments sold together: no single price.
      line({ id: "c", price: 400000, type: "2", area: 40, rooms: 2, lot: "1" }),
      line({ id: "c", price: 400000, type: "2", area: 45, rooms: 2, lot: "2" }),
      // An apartment and a shop: no.
      line({ id: "d", price: 600000, type: "2", area: 50, rooms: 2 }),
      line({ id: "d", price: 600000, type: "4", area: 80 }),
      // New build, two dispositions, a box room: no.
      line({
        id: "e",
        nature: "Vente en l'état futur d'achèvement",
        price: 280000,
        type: "2",
        area: 50,
      }),
      line({
        id: "f",
        price: 200000,
        type: "2",
        area: 40,
        disposition: "000001",
      }),
      line({
        id: "f",
        price: 200000,
        type: "2",
        area: 40,
        disposition: "000002",
      }),
      line({ id: "g", price: 30000, type: "2", area: 7 }),
    ].join("\n"),
  );

  it("keeps one home per sale, a dependency beside it allowed", () => {
    expect(dvfSales(rows)).toEqual<DvfSale[]>([
      {
        date: "2025-03-01",
        kind: "apartment",
        area: 60,
        price: 300000,
        perM2: 5000,
        point: [4.84, 45.76],
      },
      {
        date: "2025-03-01",
        kind: "house",
        area: 100,
        price: 500000,
        perM2: 5000,
        point: null,
      },
    ]);
  });
});

describe("marketReading", () => {
  const byLatestQuarter = (s: DvfSale) => s.perM2;

  it("reads the sales within 500 m when there are thirty of them", () => {
    const near = Array.from({ length: 30 }, (_, i) =>
      sale({ perM2: 4_000 + i * 50 }),
    );
    const far = Array.from({ length: 50 }, () =>
      sale({ perM2: 9_000, point: [4.9, 45.8] }),
    );

    const reading = marketReading([...near, ...far], {
      kind: "apartment",
      point: HOME,
      carry: byLatestQuarter,
    });

    expect(reading).toMatchObject({
      scope: "radius",
      sales: 30,
      medianM2: 4725,
    });
  });

  it("reads the commune when the neighbourhood is thin", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({ perM2: 5_000 + i * 10, point: i < 5 ? HOME : [4.9, 45.8] }),
    );

    expect(
      marketReading(sales, {
        kind: "apartment",
        point: HOME,
        carry: byLatestQuarter,
      }),
    ).toMatchObject({ scope: "commune", sales: 25, medianM2: 5120 });
  });

  it("gives no reading on too few sales, and counts only the kind asked", () => {
    const sales = [
      ...Array.from({ length: 19 }, () => sale()),
      ...Array.from({ length: 40 }, () => sale({ kind: "house" })),
    ];

    expect(
      marketReading(sales, {
        kind: "apartment",
        point: null,
        carry: byLatestQuarter,
      }),
    ).toBeNull();
  });

  it("carries each sale before the median, and trims what is not a market price", () => {
    const sales = [
      ...Array.from({ length: 20 }, (_, i) =>
        sale({ perM2: 5_000, date: `2023-0${(i % 9) + 1}-01` }),
      ),
      sale({ perM2: 500 }), // a family sale
      sale({ perM2: 60_000 }), // a slip of a decimal
    ];

    const reading = marketReading(sales, {
      kind: "apartment",
      point: null,
      // As if prices had since fallen by a tenth.
      carry: (s) => s.perM2 * 0.9,
    });

    expect(reading).toMatchObject({
      scope: "commune",
      sales: 20,
      medianM2: 4500,
      q1M2: 4500,
      q3M2: 4500,
      periodFrom: "2023-01-01",
      periodTo: "2025-03-01",
    });
  });
});

describe("files and distances", () => {
  it("finds a commune's file by its département", () => {
    expect(dvfFileUrl("69383", 2025)).toBe(
      "https://files.data.gouv.fr/geo-dvf/latest/csv/2025/communes/69/69383.csv",
    );
    expect(dvfFileUrl("2A004", 2024)).toContain("/communes/2A/2A004.csv");
    expect(dvfFileUrl("97101", 2024)).toContain("/communes/971/97101.csv");
  });

  it("reads the years the listing has, newest first", () => {
    expect(
      readDvfYears(
        '<a href="../">../</a><a href="/geo-dvf/latest/csv/2021/">2021/</a><a href="/geo-dvf/latest/csv/2025/">2025/</a>',
      ),
    ).toEqual([2025, 2021]);
  });

  it("measures metres on the ground", () => {
    // Two points in Lyon about 1.3 km apart.
    expect(
      metresBetween([4.841934, 45.759099], [4.857107, 45.756496]),
    ).toBeCloseTo(1214, -1);
  });
});
