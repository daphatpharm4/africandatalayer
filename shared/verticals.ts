import type { SubmissionDetails } from "./types.js";

// Vertical configuration

export interface VerticalConfig {
  id: string;
  labelEn: string;
  labelFr: string;
  pluralEn: string;
  pluralFr: string;
  icon: string;
  color: string;
  bgColor: string;
  enrichableFields: readonly string[];
  createRequiredFields: readonly string[];
  normalizeDetails: (d: SubmissionDetails) => SubmissionDetails;
}

// Shared normalization helpers

function trimString(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  return trimmed || undefined;
}

function normalizeBoolean(input: unknown): boolean | undefined {
  if (typeof input === "boolean") return input;
  if (typeof input === "number") {
    if (input === 1) return true;
    if (input === 0) return false;
    return undefined;
  }
  if (typeof input !== "string") return undefined;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["true", "yes", "y", "1", "open", "available", "oui"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "closed", "unavailable", "non"].includes(normalized)) return false;
  return undefined;
}

function normalizeInteger(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) return Math.round(input);
  if (typeof input === "string" && input.trim()) {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return undefined;
}

function normalizeStringArray(input: unknown): string[] | undefined {
  if (Array.isArray(input)) {
    const list = input
      .map((value) => trimString(value))
      .filter((value): value is string => Boolean(value));
    return list.length ? Array.from(new Set(list)) : undefined;
  }
  const single = trimString(input);
  return single ? [single] : undefined;
}

function normalizeProviders(input: unknown): string[] | undefined {
  return normalizeStringArray(input);
}

// Identity normalizer for verticals with no special normalization logic
function identityNormalize(d: SubmissionDetails): SubmissionDetails {
  const details = { ...d };
  const name = trimString(details.name) ?? trimString(details.siteName);
  if (name) {
    details.name = name;
    details.siteName = name;
  }

  const openingHours = trimString((details as Record<string, unknown>).opening_hours) ?? trimString(details.openingHours);
  if (openingHours) details.openingHours = openingHours;

  const phone = trimString(details.phone);
  if (phone) details.phone = phone;

  const brand = trimString(details.brand);
  if (brand) details.brand = brand;

  return details;
}

// Per-vertical normalizers

function normalizePharmacy(d: SubmissionDetails): SubmissionDetails {
  const details = identityNormalize(d);
  const raw = details as Record<string, unknown>;

  if (typeof details.isOpenNow !== "boolean" && typeof details.availability === "string") {
    const normalized = details.availability.toLowerCase();
    details.isOpenNow = !normalized.includes("out") && !normalized.includes("closed");
  }

  const isOnDuty = normalizeBoolean(raw.isOnDuty ?? raw.isOnCall ?? raw.onDuty ?? raw.pharmacyDeGarde);
  if (typeof isOnDuty === "boolean") details.isOnDuty = isOnDuty;

  const isLicensed = normalizeBoolean(raw.isLicensed ?? raw.licensed);
  if (typeof isLicensed === "boolean") details.isLicensed = isLicensed;

  const hasPrescriptionService = normalizeBoolean(raw.hasPrescriptionService ?? raw.prescriptionService);
  if (typeof hasPrescriptionService === "boolean") details.hasPrescriptionService = hasPrescriptionService;

  const medicineCategories = normalizeStringArray(raw.medicineCategories ?? raw.medicine_types);
  if (medicineCategories) details.medicineCategories = medicineCategories;

  if (typeof details.isOnDuty !== "boolean" && typeof details.availability === "string") {
    const normalized = details.availability.toLowerCase();
    if (normalized.includes("on-call") || normalized.includes("on call") || normalized.includes("garde")) {
      details.isOnDuty = true;
    }
  }

  return details;
}

function normalizeMobileMoney(d: SubmissionDetails): SubmissionDetails {
  const details = identityNormalize(d);

  const providers = normalizeProviders(details.providers ?? details.provider);
  if (providers) details.providers = providers;

  const cashThreshold =
    normalizeBoolean(details.hasMin50000XafAvailable) ??
    normalizeBoolean(details.hasCashAvailable) ??
    (typeof details.availability === "string" ? !details.availability.toLowerCase().includes("out") : undefined);
  if (typeof cashThreshold === "boolean") {
    details.hasMin50000XafAvailable = cashThreshold;
  }
  if ("hasCashAvailable" in details) {
    delete details.hasCashAvailable;
  }

  const isActive = normalizeBoolean(details.isActive);
  if (typeof isActive === "boolean") details.isActive = isActive;

  const hasFloat = normalizeBoolean(details.hasFloat);
  if (typeof hasFloat === "boolean") details.hasFloat = hasFloat;

  const agentType = trimString(details.agentType);
  if (agentType) details.agentType = agentType;

  if (details.merchantId && providers?.length && !details.merchantIdByProvider) {
    details.merchantIdByProvider = { [providers[0]]: details.merchantId };
  }

  return details;
}

function normalizeFuelStation(d: SubmissionDetails): SubmissionDetails {
  const details = identityNormalize(d);

  const fuelType = trimString(details.fuelType);
  if (fuelType && !details.fuelTypes?.length) details.fuelTypes = [fuelType];

  const parsedPrice =
    typeof details.fuelPrice === "number"
      ? details.fuelPrice
      : typeof details.price === "number"
        ? details.price
        : undefined;

  if (typeof details.hasFuelAvailable !== "boolean" && typeof details.availability === "string") {
    details.hasFuelAvailable = !details.availability.toLowerCase().includes("out");
  }

  if (parsedPrice !== undefined) {
    const priceKey = fuelType ?? "super";
    details.pricesByFuel = { ...(details.pricesByFuel ?? {}), [priceKey]: parsedPrice };
    details.fuelPrice = parsedPrice;
    details.price = parsedPrice;
  }

  const queueLength = trimString(details.queueLength);
  if (queueLength) details.queueLength = queueLength;

  return details;
}

function normalizeTransportRoad(d: SubmissionDetails): SubmissionDetails {
  const details = identityNormalize(d);
  const roadName = trimString(details.roadName) ?? trimString(details.name);
  if (roadName) {
    details.roadName = roadName;
    details.name = roadName;
    details.siteName = roadName;
  }

  const isBlocked = normalizeBoolean(details.isBlocked);
  if (typeof isBlocked === "boolean") details.isBlocked = isBlocked;

  const passableBy = normalizeStringArray(details.passableBy);
  if (passableBy) details.passableBy = passableBy;

  const condition = trimString(details.condition);
  if (condition) details.condition = condition;

  const trafficLevel = trimString(details.trafficLevel);
  if (trafficLevel) details.trafficLevel = trafficLevel;

  return details;
}

function normalizeCensusProxy(d: SubmissionDetails): SubmissionDetails {
  const details = identityNormalize(d);

  const storeyCount = normalizeInteger(details.storeyCount);
  if (storeyCount !== undefined) details.storeyCount = storeyCount;

  const estimatedUnits = normalizeInteger(details.estimatedUnits);
  if (estimatedUnits !== undefined) details.estimatedUnits = estimatedUnits;

  const hasCommercialGround = normalizeBoolean(details.hasCommercialGround);
  if (typeof hasCommercialGround === "boolean") details.hasCommercialGround = hasCommercialGround;

  const hasElectricity = normalizeBoolean(details.hasElectricity);
  if (typeof hasElectricity === "boolean") details.hasElectricity = hasElectricity;

  const hasWater = normalizeBoolean(details.hasWater);
  if (typeof hasWater === "boolean") details.hasWater = hasWater;

  const commercialTypes = normalizeStringArray(details.commercialTypes);
  if (commercialTypes) details.commercialTypes = commercialTypes;

  const nearbyInfrastructure = normalizeStringArray(details.nearbyInfrastructure);
  if (nearbyInfrastructure) details.nearbyInfrastructure = nearbyInfrastructure;

  return details;
}

export const VERTICALS: Record<string, VerticalConfig> = {
  pharmacy: {
    id: "pharmacy",
    labelEn: "Pharmacy",
    labelFr: "Pharmacie",
    pluralEn: "Pharmacies",
    pluralFr: "Pharmacies",
    icon: "pill",
    color: "#2f855a",
    bgColor: "#eaf3ee",
    enrichableFields: ["openingHours", "isOpenNow", "isOnDuty", "isLicensed", "hasPrescriptionService", "medicineCategories"],
    createRequiredFields: ["name", "isOpenNow"],
    normalizeDetails: normalizePharmacy,
  },
  mobile_money: {
    id: "mobile_money",
    labelEn: "Mobile Money",
    labelFr: "Mobile money",
    pluralEn: "Mobile Money Points",
    pluralFr: "Points mobile money",
    icon: "landmark",
    color: "#0f2b46",
    bgColor: "#e7eef4",
    enrichableFields: ["merchantIdByProvider", "paymentMethods", "openingHours", "providers", "isActive", "hasFloat", "agentType"],
    createRequiredFields: ["providers"],
    normalizeDetails: normalizeMobileMoney,
  },
  fuel_station: {
    id: "fuel_station",
    labelEn: "Fuel Station",
    labelFr: "Station-service",
    pluralEn: "Fuel Stations",
    pluralFr: "Stations-service",
    icon: "fuel",
    color: "#c86b4a",
    bgColor: "#f7e8e1",
    enrichableFields: ["fuelTypes", "pricesByFuel", "quality", "paymentMethods", "openingHours", "hasFuelAvailable", "queueLength", "hasConvenienceStore", "hasCarWash", "hasATM"],
    createRequiredFields: ["name", "hasFuelAvailable"],
    normalizeDetails: normalizeFuelStation,
  },
  alcohol_outlet: {
    id: "alcohol_outlet",
    labelEn: "Alcohol Outlet",
    labelFr: "Point de vente d'alcool",
    pluralEn: "Alcohol Outlets",
    pluralFr: "Points de vente d'alcool",
    icon: "wine",
    color: "#9b2c2c",
    bgColor: "#fde8e8",
    enrichableFields: ["brand", "openingHours", "paymentMethods", "outletType", "isFormal", "servesFood", "brandsAvailable", "priceRange"],
    createRequiredFields: ["name"],
    normalizeDetails: identityNormalize,
  },
  billboard: {
    id: "billboard",
    labelEn: "Billboard",
    labelFr: "Panneau publicitaire",
    pluralEn: "Billboards",
    pluralFr: "Panneaux publicitaires",
    icon: "rectangle-horizontal",
    color: "#d69e2e",
    bgColor: "#fefcbf",
    enrichableFields: ["brand", "billboardType", "isOccupied", "advertiserBrand", "advertiserCategory", "condition", "size", "isLit"],
    createRequiredFields: ["name"],
    normalizeDetails: identityNormalize,
  },
  transport_road: {
    id: "transport_road",
    labelEn: "Road Segment",
    labelFr: "Segment routier",
    pluralEn: "Road Segments",
    pluralFr: "Segments routiers",
    icon: "route",
    color: "#718096",
    bgColor: "#edf2f7",
    enrichableFields: ["condition", "isBlocked", "blockageType", "surfaceType", "passableBy", "trafficLevel", "hasStreetLight"],
    createRequiredFields: ["roadName", "condition"],
    normalizeDetails: normalizeTransportRoad,
  },
  census_proxy: {
    id: "census_proxy",
    labelEn: "Building / Census Point",
    labelFr: "Batiment / Point de recensement",
    pluralEn: "Buildings",
    pluralFr: "Batiments",
    icon: "building-2",
    color: "#4a5568",
    bgColor: "#e2e8f0",
    enrichableFields: ["occupancyStatus", "storeyCount", "estimatedUnits", "hasElectricity", "constructionMaterial", "hasCommercialGround"],
    createRequiredFields: ["buildingType", "occupancyStatus"],
    normalizeDetails: normalizeCensusProxy,
  },
};

export const VERTICAL_IDS = Object.keys(VERTICALS) as string[];

export function isValidCategory(value: string): boolean {
  return value in VERTICALS;
}

export function getVertical(id: string): VerticalConfig {
  const vertical = VERTICALS[id];
  if (!vertical) throw new Error(`Unknown vertical: ${id}`);
  return vertical;
}

export function categoryLabel(id: string, lang: "en" | "fr"): string {
  const vertical = VERTICALS[id];
  if (!vertical) return id;
  return lang === "fr" ? vertical.labelFr : vertical.labelEn;
}

export function categoryPluralLabel(id: string, lang: "en" | "fr"): string {
  const vertical = VERTICALS[id];
  if (!vertical) return id;
  return lang === "fr" ? vertical.pluralFr : vertical.pluralEn;
}

// Map legacy Category enum values to SubmissionCategory IDs.
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  PHARMACY: "pharmacy",
  FUEL: "fuel_station",
  MOBILE_MONEY: "mobile_money",
  ALCOHOL_OUTLET: "alcohol_outlet",
  BILLBOARD: "billboard",
  TRANSPORT_ROAD: "transport_road",
  CENSUS_PROXY: "census_proxy",
  KIOSK: "mobile_money",
};

export function normalizeCategoryAlias(raw: string): string | null {
  if (raw in VERTICALS) return raw;
  const mapped = LEGACY_CATEGORY_MAP[raw];
  return mapped ?? null;
}
