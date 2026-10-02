import { describe, expect, it } from "vitest";
import {
  carryToLatest,
  INDEX_SERIES,
  inseeIndexUrl,
  priceIndexFromRows,
  quarterOf,
  readInseeIndex,
  seriesFor,
} from "./price-index";

describe("seriesFor", () => {
  it("starts from the agglomeration for Lyon's arrondissements", () => {
    expect(seriesFor("69383", "apartment")).toEqual([
      "010567011", // Lyon agglomeration
      "010567129", // Auvergne-Rhône-Alpes
      "010567063", // Province
      "010567057", // Metropolitan France
      "010567117", // France
    ]);
  });

  it("starts from the département in Île-de-France, and skips Province", () => {
    expect(seriesFor("75111", "apartment")).toEqual([
      "010567013",
      "010567077",
      "010567057",
      "010567117",
    ]);
  });

  it("carries a house in Paris by Île-de-France's houses", () => {
    expect(seriesFor("75111", "house")[0]).toBe("010567091");
  });

  it("falls to the region, then Province, elsewhere", () => {
    expect(seriesFor("84050", "house")).toEqual([
      "010567115",
      "010567075",
      "010567061",
      "010567121",
    ]);
    expect(seriesFor("2A004", "apartment")[0]).toBe("010567063");
  });

  it("has only France for overseas, and for a place unknown", () => {
    expect(seriesFor("97101", "house")).toEqual(["010567121"]);
    expect(seriesFor(null, "all")).toEqual(["010567119"]);
  });

  it("names every series it can answer in the list to fetch", () => {
    for (const code of [
      "69383",
      "13201",
      "59350",
      "75111",
      "93066",
      "84050",
      "2A004",
      "97101",
    ]) {
      for (const kind of ["apartment", "house", "all"] as const) {
        for (const series of seriesFor(code, kind)) {
          expect(INDEX_SERIES).toContain(series);
        }
      }
    }
  });
});

describe("quarterOf", () => {
  it("places a day in its quarter", () => {
    expect(quarterOf("2025-01-01")).toBe("2025-Q1");
    expect(quarterOf("2025-09-30")).toBe("2025-Q3");
    expect(quarterOf("2025-12-31")).toBe("2025-Q4");
  });
});

describe("carryToLatest", () => {
  const index = priceIndexFromRows([
    { series: "010567013", quarter: "2023-Q1", value: 130.4 },
    { series: "010567013", quarter: "2024-Q1", value: 120.2 },
    { series: "010567013", quarter: "2026-Q2", value: 120.6 },
    { series: "010567077", quarter: "2026-Q2", value: 116.9 },
  ]);

  it("carries a quarter to the series' latest", () => {
    const carry = carryToLatest(index, ["010567013"], "2023-Q1");
    expect(carry).toMatchObject({
      series: "010567013",
      from: "2023-Q1",
      to: "2026-Q2",
    });
    expect(carry!.factor).toBeCloseTo(120.6 / 130.4, 10);
  });

  it("takes the latest quarter before one the series skips", () => {
    expect(carryToLatest(index, ["010567013"], "2023-Q3")?.from).toBe(
      "2023-Q1",
    );
  });

  it("carries a quarter newer than the series by nothing", () => {
    expect(carryToLatest(index, ["010567013"], "2026-Q3")?.factor).toBe(1);
  });

  it("falls to the next candidate when the first has nothing", () => {
    expect(
      carryToLatest(index, ["010567011", "010567077"], "2026-Q2")?.series,
    ).toBe("010567077");
    expect(carryToLatest(index, ["010567011"], "2026-Q2")).toBeNull();
  });
});

describe("readInseeIndex", () => {
  it("reads each series' observations", () => {
    const xml =
      '<Series IDBANK="010567013" TITLE_FR="Paris"><Obs TIME_PERIOD="2026-Q2" OBS_VALUE="120.6"/>' +
      '<Obs TIME_PERIOD="2026-Q1" OBS_VALUE="121.1"/></Series>' +
      '<Series IDBANK="010567063"><Obs TIME_PERIOD="2026-Q2" OBS_VALUE="131.6"/></Series>';

    expect(readInseeIndex(xml)).toEqual([
      { series: "010567013", quarter: "2026-Q2", value: 120.6 },
      { series: "010567013", quarter: "2026-Q1", value: 121.1 },
      { series: "010567063", quarter: "2026-Q2", value: 131.6 },
    ]);
  });

  it("asks for every series at once", () => {
    expect(inseeIndexUrl(["010567013", "010567063"], "2010-Q1")).toBe(
      "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/010567013+010567063?startPeriod=2010-Q1",
    );
  });
});
