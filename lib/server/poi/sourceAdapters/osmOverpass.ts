import { normalizeOsmElementToPoi, type NormalizedPoiDraft, type OsmElement } from "../normalizePoi.js";

export interface OverpassBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OverpassResponse {
  elements?: OsmElement[];
}

export interface FetchOverpassOptions {
  endpoint?: string;
  fetchFn?: typeof fetch;
}

const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export function normalizeOverpassResponse(response: OverpassResponse): NormalizedPoiDraft[] {
  return (response.elements ?? [])
    .map((element) => normalizeOsmElementToPoi(element))
    .filter((candidate): candidate is NormalizedPoiDraft => Boolean(candidate));
}

export function buildOverpassQuery(bounds: OverpassBounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `
[out:json][timeout:25];
(
  node["amenity"="pharmacy"](${bbox});
  way["amenity"="pharmacy"](${bbox});
  relation["amenity"="pharmacy"](${bbox});
  node["amenity"="fuel"](${bbox});
  way["amenity"="fuel"](${bbox});
  relation["amenity"="fuel"](${bbox});
  node["amenity"~"bar|pub"](${bbox});
  way["amenity"~"bar|pub"](${bbox});
  node["shop"="alcohol"](${bbox});
  way["shop"="alcohol"](${bbox});
  node["highway"="bus_stop"](${bbox});
  way["public_transport"](${bbox});
  node["advertising"="billboard"](${bbox});
  way["advertising"="billboard"](${bbox});
  node["man_made"="advertising"](${bbox});
  way["man_made"="advertising"](${bbox});
  node["amenity"~"bank|money_transfer"](${bbox});
  way["amenity"~"bank|money_transfer"](${bbox});
  node["shop"="mobile_money"](${bbox});
  way["shop"="mobile_money"](${bbox});
  node["building"](${bbox});
  way["building"](${bbox});
);
out center tags;
`;
}

export async function fetchOverpassPoiCandidates(
  bounds: OverpassBounds,
  options: FetchOverpassOptions = {},
): Promise<{ query: string; response: OverpassResponse; candidates: NormalizedPoiDraft[] }> {
  const fetchFn = options.fetchFn ?? fetch;
  const endpoint = options.endpoint ?? DEFAULT_OVERPASS_ENDPOINT;
  const query = buildOverpassQuery(bounds);
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ data: query }),
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OverpassResponse;
  return {
    query,
    response: payload,
    candidates: normalizeOverpassResponse(payload),
  };
}
