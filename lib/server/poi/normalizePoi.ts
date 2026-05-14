import type { SubmissionCategory, SubmissionDetails, SubmissionLocation } from "../../../shared/types.js";
import { getVertical } from "../../../shared/verticals.js";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export interface NormalizedPoiDraft {
  source: string;
  sourceLicense: string;
  sourceAttribution: string;
  externalId: string;
  raw: Record<string, unknown>;
  normalized: SubmissionDetails;
  category: SubmissionCategory;
  location: SubmissionLocation;
  name: string | null;
  confidence: number;
}

const OSM_SOURCE = "osm";
const OSM_LICENSE = "ODbL-1.0";
const OSM_ATTRIBUTION = "OpenStreetMap contributors";

function trimString(input: unknown, maxLen = 500): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, maxLen);
}

function normalizeBoolean(input: unknown): boolean | undefined {
  const value = trimString(input, 32)?.toLowerCase();
  if (!value) return undefined;
  if (["yes", "true", "1"].includes(value)) return true;
  if (["no", "false", "0"].includes(value)) return false;
  return undefined;
}

function normalizeInteger(input: unknown): number | undefined {
  const raw = typeof input === "number" ? input : typeof input === "string" ? Number(input.trim()) : NaN;
  if (!Number.isFinite(raw)) return undefined;
  return Math.max(0, Math.round(raw));
}

function normalizeProviders(...inputs: unknown[]): string[] | undefined {
  const providers = inputs
    .flatMap((input) => {
      const value = trimString(input);
      return value ? value.split(/[;,/|]+/) : [];
    })
    .map((value) => value.trim())
    .filter(Boolean);
  return providers.length ? Array.from(new Set(providers)) : undefined;
}

function resolveOsmCategory(tags: Record<string, string>): SubmissionCategory | null {
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "fuel") return "fuel_station";
  if (tags.amenity === "bar" || tags.amenity === "pub" || tags.shop === "alcohol") return "alcohol_outlet";
  if (tags.highway === "bus_stop" || tags.public_transport) return "transport_road";
  if (tags.advertising === "billboard" || tags.man_made === "advertising") return "billboard";
  if (tags.amenity === "bank" || tags.amenity === "money_transfer" || tags.shop === "mobile_money") {
    return "mobile_money";
  }
  if (tags.building && tags.building !== "no") return "census_proxy";
  return null;
}

function resolveLocation(element: OsmElement): SubmissionLocation | null {
  const latitude = typeof element.lat === "number" ? element.lat : element.center?.lat;
  const longitude = typeof element.lon === "number" ? element.lon : element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude: latitude as number, longitude: longitude as number };
}

function resolveName(tags: Record<string, string>): string | null {
  return (
    trimString(tags.name) ??
    trimString(tags["name:fr"]) ??
    trimString(tags["name:en"]) ??
    trimString(tags.operator) ??
    trimString(tags.brand)
  );
}

function buildCategoryDetails(
  category: SubmissionCategory,
  tags: Record<string, string>,
  name: string | null,
): SubmissionDetails {
  const brand = trimString(tags.brand);
  const operator = trimString(tags.operator);
  const phone = trimString(tags.phone) ?? trimString(tags["contact:phone"]);
  const website = trimString(tags.website) ?? trimString(tags["contact:website"]);
  const openingHours = trimString(tags.opening_hours);
  const details: SubmissionDetails = {
    name: name ?? undefined,
    siteName: name ?? undefined,
    brand: brand ?? undefined,
    operator: operator ?? undefined,
    phone: phone ?? undefined,
    website: website ?? undefined,
    openingHours: openingHours ?? undefined,
    source: OSM_SOURCE,
    externalId: undefined,
    isImported: true,
  };

  if (category === "pharmacy") {
    const onDuty = normalizeBoolean(tags["pharmacy:on_duty"] ?? tags.on_duty);
    if (typeof onDuty === "boolean") details.isOnDuty = onDuty;
    const licensed = normalizeBoolean(tags["pharmacy:licensed"] ?? tags.licensed);
    if (typeof licensed === "boolean") details.isLicensed = licensed;
  }

  if (category === "fuel_station") {
    details.fuelTypes = normalizeProviders(tags.fuel, tags["fuel:diesel"], tags["fuel:octane_95"]);
    const fuelAvailable = normalizeBoolean(tags["fuel:availability"] ?? tags.availability);
    if (typeof fuelAvailable === "boolean") details.hasFuelAvailable = fuelAvailable;
  }

  if (category === "mobile_money") {
    details.providers = normalizeProviders(tags.brand, tags.operator, tags.network);
    const active = normalizeBoolean(tags.active);
    if (typeof active === "boolean") details.isActive = active;
    details.agentType = trimString(tags.amenity === "money_transfer" ? "money_transfer" : tags.shop) ?? undefined;
  }

  if (category === "alcohol_outlet") {
    details.outletType = trimString(tags.amenity ?? tags.shop) ?? undefined;
    details.priceRange = trimString(tags["payment:cash"] ? "cash" : tags.price_range) ?? undefined;
  }

  if (category === "billboard") {
    details.billboardType = trimString(tags.advertising ?? tags.man_made) ?? undefined;
    details.size = trimString(tags.size) ?? undefined;
    const occupied = normalizeBoolean(tags["advertising:lit"] ?? tags.lit);
    if (typeof occupied === "boolean") details.isLit = occupied;
  }

  if (category === "transport_road") {
    const roadName = name ?? trimString(tags.highway) ?? trimString(tags.public_transport);
    details.roadName = roadName ?? undefined;
    details.segmentType = trimString(tags.highway ?? tags.public_transport) ?? undefined;
    details.surfaceType = trimString(tags.surface) ?? undefined;
  }

  if (category === "census_proxy") {
    details.buildingType = trimString(tags.building) ?? undefined;
    details.storeyCount = normalizeInteger(tags["building:levels"]);
    details.hasCommercialGround = normalizeBoolean(tags.shop ?? tags.commercial);
  }

  return getVertical(category).normalizeDetails(details);
}

function confidenceFor(tags: Record<string, string>, name: string | null): number {
  let confidence = name ? 0.7 : 0.52;
  if (trimString(tags.phone) || trimString(tags["contact:phone"])) confidence += 0.08;
  if (trimString(tags.opening_hours)) confidence += 0.06;
  if (trimString(tags.brand) || trimString(tags.operator)) confidence += 0.04;
  return Math.min(0.9, Math.round(confidence * 100) / 100);
}

export function normalizeOsmElementToPoi(element: OsmElement): NormalizedPoiDraft | null {
  const tags = element.tags ?? {};
  const category = resolveOsmCategory(tags);
  const location = resolveLocation(element);
  if (!category || !location) return null;

  const externalId = `${element.type}/${element.id}`;
  const name = resolveName(tags);
  const normalized = buildCategoryDetails(category, tags, name);
  normalized.source = OSM_SOURCE;
  normalized.externalId = externalId;
  normalized.isImported = true;

  return {
    source: OSM_SOURCE,
    sourceLicense: OSM_LICENSE,
    sourceAttribution: OSM_ATTRIBUTION,
    externalId,
    raw: element as unknown as Record<string, unknown>,
    normalized,
    category,
    location,
    name,
    confidence: confidenceFor(tags, name),
  };
}
