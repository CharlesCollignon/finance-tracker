/**
 * Addresses as the French state's geocoder answers them — the IGN
 * Géoplateforme, `data.geopf.fr/geocodage`, free and keyless — which is where
 * a property's commune and position are read from.
 *
 * Asked from the web server rather than the reader's browser, so what the
 * user types reaches IGN without their IP address. Only an address in France
 * can be found, which is the product's whole audience.
 */

export interface AddressMatch {
  /** « 12 Rue de la Part-Dieu 69003 Lyon », as the geocoder writes it. */
  label: string;
  /** The INSEE code: an arrondissement's in Paris, Lyon and Marseille. */
  citycode: string;
  postcode: string | null;
  city: string;
  /** « Lyon 3e Arrondissement », where the city has them. */
  district: string | null;
  latitude: number;
  longitude: number;
  /** A house number is precise; a street or a commune is approximate. */
  precision: "address" | "street" | "commune";
}

const GEOCODER_URL = "https://data.geopf.fr/geocodage/search";

/** Typed fewer than this, a search would only return noise. */
export const ADDRESS_QUERY_MIN = 3;

function precisionOf(type: unknown): AddressMatch["precision"] | null {
  switch (type) {
    case "housenumber":
      return "address";
    case "street":
    case "locality":
      return "street";
    case "municipality":
      return "commune";
    default:
      return null;
  }
}

/** The geocoder's answer as matches; anything malformed is left out. */
export function readAddressMatches(json: unknown): AddressMatch[] {
  const features = (json as { features?: unknown })?.features;
  if (!Array.isArray(features)) {
    return [];
  }
  return features.flatMap((feature): AddressMatch[] => {
    const properties = (feature as { properties?: Record<string, unknown> })
      ?.properties;
    const coordinates = (feature as { geometry?: { coordinates?: unknown } })
      ?.geometry?.coordinates;
    if (!properties || !Array.isArray(coordinates)) {
      return [];
    }
    const [longitude, latitude] = coordinates.map(Number);
    const precision = precisionOf(properties.type);
    const citycode = properties.citycode;
    const label = properties.label;
    if (
      precision === null ||
      typeof citycode !== "string" ||
      !/^[0-9][0-9AB][0-9]{3}$/.test(citycode) ||
      typeof label !== "string" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return [];
    }
    return [
      {
        label,
        citycode,
        postcode:
          typeof properties.postcode === "string" &&
          /^[0-9]{5}$/.test(properties.postcode)
            ? properties.postcode
            : null,
        city: typeof properties.city === "string" ? properties.city : label,
        district:
          typeof properties.district === "string" ? properties.district : null,
        latitude: latitude!,
        longitude: longitude!,
        precision,
      },
    ];
  });
}

/**
 * Up to `limit` addresses for what was typed so far, best first. An empty
 * list for a query too short to mean anything, and for a geocoder that did
 * not answer: the form then takes the property without a position.
 */
export async function searchAddresses(
  query: string,
  limit = 5,
  fetcher: typeof fetch = fetch,
): Promise<AddressMatch[]> {
  const q = query.trim();
  if (q.length < ADDRESS_QUERY_MIN) {
    return [];
  }
  const url = new URL(GEOCODER_URL);
  url.searchParams.set("q", q.slice(0, 200));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("autocomplete", "1");
  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return [];
    }
    return readAddressMatches(await response.json());
  } catch {
    return [];
  }
}
