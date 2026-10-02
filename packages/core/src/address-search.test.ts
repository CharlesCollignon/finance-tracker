import { describe, expect, it, vi } from "vitest";
import { readAddressMatches, searchAddresses } from "./address-search";

/** Cut from the geocoder's answer for « 12 rue oberk », 2026-10-02. */
const ANSWER = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [2.36872, 48.863125] },
      properties: {
        label: "12 Rue Oberkampf 75011 Paris",
        type: "housenumber",
        citycode: "75111",
        postcode: "75011",
        city: "Paris",
        district: "Paris 11e Arrondissement",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [5.206044, 43.904613] },
      properties: {
        label: "Gordes",
        type: "municipality",
        citycode: "84050",
        postcode: "84220",
        city: "Gordes",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [1, 2] },
      properties: { label: "Somewhere", type: "poi", citycode: "12345" },
    },
  ],
};

describe("readAddressMatches", () => {
  it("reads an address with its commune and position", () => {
    expect(readAddressMatches(ANSWER)[0]).toEqual({
      label: "12 Rue Oberkampf 75011 Paris",
      citycode: "75111",
      postcode: "75011",
      city: "Paris",
      district: "Paris 11e Arrondissement",
      latitude: 48.863125,
      longitude: 2.36872,
      precision: "address",
    });
  });

  it("says a commune is only a commune", () => {
    expect(readAddressMatches(ANSWER)[1]).toMatchObject({
      citycode: "84050",
      district: null,
      precision: "commune",
    });
  });

  it("leaves out what it cannot place", () => {
    expect(readAddressMatches(ANSWER)).toHaveLength(2);
    expect(readAddressMatches(null)).toEqual([]);
    expect(readAddressMatches({ features: "nope" })).toEqual([]);
  });
});

describe("searchAddresses", () => {
  it("asks for completions of what was typed", async () => {
    const fetcher = vi.fn(async () => Response.json(ANSWER));

    const matches = await searchAddresses("12 rue oberk", 3, fetcher);

    expect(matches).toHaveLength(2);
    const url = new URL(String((fetcher.mock.calls[0] as unknown[])[0]));
    expect(url.origin).toBe("https://data.geopf.fr");
    expect(url.searchParams.get("q")).toBe("12 rue oberk");
    expect(url.searchParams.get("limit")).toBe("3");
    expect(url.searchParams.get("autocomplete")).toBe("1");
  });

  it("asks nothing for a query too short to mean anything", async () => {
    const fetcher = vi.fn();

    expect(await searchAddresses(" ly ", 5, fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers nothing when the geocoder does not", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const refusing = vi.fn(async () => new Response("", { status: 503 }));

    expect(await searchAddresses("12 rue oberk", 5, failing)).toEqual([]);
    expect(await searchAddresses("12 rue oberk", 5, refusing)).toEqual([]);
  });
});
