import { describe, expect, it } from "vitest";
import {
  anilDatasetUrl,
  anilFileUrl,
  readAnilCsv,
  rentReference,
  rentSeriesFor,
} from "./rent-reference";

// Rows of the 2025 edition's apartment table, as the ANIL writes them.
const TABLE = [
  '"id_zone";"INSEE_C";"LIBGEO";"EPCI";"DEP";"REG";"loypredm2";"lwr.IPm2";"upr.IPm2";"TYPPRED";"nbobs_com";"nbobs_mail";"R2_adj"',
  '"2889";"69383";"Lyon 3e Arrondissement";"200046977";"69";"84";16,4010917810445;12,8243613172001;20,9753768594671;"commune";30256;30256;0,857923421817506',
  '"683";"84050";"Gordes";"200040442";"84";"93";13,5262813331117;10,8801888073479;16,8159110050484;"maille";29;482;0,709208268728827',
  '"726";"84050x";"Short";"1";"84"',
].join("\r\n");

describe("rentSeriesFor", () => {
  it("reads a house from the houses' table and premises from none", () => {
    expect(rentSeriesFor("house", 4)).toBe("mai");
    expect(rentSeriesFor("other", null)).toBeNull();
  });

  it("splits apartments by rooms, and reads them all together without", () => {
    expect(rentSeriesFor("apartment", 1)).toBe("app12");
    expect(rentSeriesFor("apartment", 2)).toBe("app12");
    expect(rentSeriesFor("apartment", 3)).toBe("app3");
    expect(rentSeriesFor("apartment", null)).toBe("app");
  });
});

describe("anilDatasetUrl", () => {
  it("names each year's map by its year", () => {
    expect(anilDatasetUrl(2025)).toBe(
      "https://www.data.gouv.fr/api/1/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/",
    );
  });
});

describe("anilFileUrl", () => {
  it("finds a table's file among an edition's resources", () => {
    const dataset = {
      resources: [
        { url: "https://static.data.gouv.fr/x/note-methodologique.pdf" },
        { url: "https://static.data.gouv.fr/x/pred-app12-mef-dhup.csv" },
        { url: "https://static.data.gouv.fr/x/pred-app-mef-dhup.csv" },
      ],
    };
    expect(anilFileUrl(dataset, "app")).toBe(
      "https://static.data.gouv.fr/x/pred-app-mef-dhup.csv",
    );
    expect(anilFileUrl(dataset, "mai")).toBeNull();
    expect(anilFileUrl({ message: "Not found" }, "app")).toBeNull();
  });
});

describe("readAnilCsv", () => {
  it("reads decimal commas and quoted text, and skips a row of the wrong width", () => {
    const rows = readAnilCsv(TABLE);
    expect(rows.size).toBe(2);
    expect(rows.get("69383")).toEqual({
      rentM2: 16.4010917810445,
      lowM2: 12.8243613172001,
      highM2: 20.9753768594671,
      scope: "commune",
      observations: 30256,
      r2: 0.857923421817506,
    });
  });
});

describe("rentReference", () => {
  const rows = readAnilCsv(TABLE);

  it("keeps a reliable figure, to the cent", () => {
    expect(rentReference(rows.get("69383"), "app", 2025)).toEqual({
      series: "app",
      rentM2: 16.4,
      lowM2: 12.82,
      highM2: 20.98,
      scope: "commune",
      observations: 30256,
      edition: 2025,
    });
  });

  it("says nothing where the commune has fewer than 30 listings", () => {
    expect(rentReference(rows.get("84050"), "app", 2025)).toBeNull();
  });

  it("says nothing where the model fits poorly, or for a commune not listed", () => {
    expect(
      rentReference({ ...rows.get("69383")!, r2: 0.48 }, "app", 2025),
    ).toBeNull();
    expect(rentReference(undefined, "app", 2025)).toBeNull();
  });
});
