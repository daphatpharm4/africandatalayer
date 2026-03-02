import type { SubmissionDetails } from "./types.js";

// ── Vertical configuration ─────────────────────────────────────────────

export interface VerticalConfig {
  id: string;
  labelEn: string;
  labelFr: string;
  pluralEn: string;
  pluralFr: string;
  icon: string;          // lucide-react icon name
  color: string;         // hex color for map markers / UI accents
  bgColor: string;       // light background for selected state
  enrichableFields: readonly string[];
  createRequiredFields: readonly string[];
  normalizeDetails: (d: SubmissionDetails) => SubmissionDetails;
}

// ── Shared normalization helpers ────────────────────────────────────────

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

function normalizeProviders(input: unknown): string[] | undefined {
  if (Array.isArray(input)) {
    const list = input
      .map((value) => trimString(value))
      .filter((value): value is string => Boolean(value));
    return list.length ? Array.from(new Set(list)) : undefined;
  }
  const single = trimString(input);
  return single ? [single] : undefined;
}

/** Identity normalizer for verticals with no special normalization logic */
function identityNormalize(d: SubmissionDetails): SubmissionDetails {
  const details = { ...d };
  const name = trimString(details.name) ?? trimString(details.siteName);
  if (name) { details.name = name; details.siteName = name; }
  const openingHours = trimString((details as Record<string, unknown>).opening_hours as string) ?? trimString(details.openingHours);
  if (openingHours) details.openingHours = openingHours;
  return details;
}

// ── Per-vertical normalizers ────────────────────────────────────────────

function normalizePharmacy(d: SubmissionDetails): SubmissionDetails {
  const details = identityNormalize(d);

  if (typeof details.isOpenNow !== "boolean" && typeof details.availability === "string") {
    const normalized = details.availability.toLowerCase();
    details.isOpenNow = !normalized.includes("out") && !normalized.includes("closed");
  }

  const raw = details as Record<string, unknown>;
  const isOnDuty = normalizeBoolean(raw.isOnDuty ?? raw.isOnCall ?? raw.onDuty ?? raw.pharmacyDeGarde);
  if (typeof isOnDuty === "boolean") details.isOnDuty = isOnDuty;

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

  return details;
}

// ── Registry ────────────────────────────────────────────────────────────

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
    enrichableFields: ["openingHours", "isOpenNow", "isOnDuty"],
    createRequiredFields: ["name", "isOpenNow"],
    normalizeDetails: normalizePharmacy,
  },
  mobile_money: {
    id: "mobile_money",
    labelEn: "Mobile Money Kiosk",
    labelFr: "Kiosque mobile money",
    pluralEn: "Mobile Money Kiosks",
    pluralFr: "Kiosques mobile money",
    icon: "landmark",
    color: "#0f2b46",
    bgColor: "#e7eef4",
    enrichableFields: ["merchantIdByProvider", "paymentMethods", "openingHours", "providers"],
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
    enrichableFields: ["fuelTypes", "pricesByFuel", "quality", "paymentMethods", "openingHours", "hasFuelAvailable"],
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
    enrichableFields: ["brand", "openingHours", "paymentMethods"],
    createRequiredFields: ["name"],
    normalizeDetails: identityNormalize,
  },
  retail_kiosk: {
    id: "retail_kiosk",
    labelEn: "Retail Kiosk",
    labelFr: "Kiosque de detail",
    pluralEn: "Retail Kiosks",
    pluralFr: "Kiosques de detail",
    icon: "store",
    color: "#6b46c1",
    bgColor: "#ede9fe",
    enrichableFields: ["openingHours", "paymentMethods"],
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
    enrichableFields: ["brand"],
    createRequiredFields: ["name"],
    normalizeDetails: identityNormalize,
  },
};

// ── Derived helpers ─────────────────────────────────────────────────────

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
  const v = VERTICALS[id];
  if (!v) return id;
  return lang === "fr" ? v.labelFr : v.labelEn;
}

export function categoryPluralLabel(id: string, lang: "en" | "fr"): string {
  const v = VERTICALS[id];
  if (!v) return id;
  return lang === "fr" ? v.pluralFr : v.pluralEn;
}

/** Map legacy Category enum values to SubmissionCategory IDs */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  PHARMACY: "pharmacy",
  FUEL: "fuel_station",
  MOBILE_MONEY: "mobile_money",
  KIOSK: "mobile_money",
};

export function normalizeCategoryAlias(raw: string): string | null {
  if (raw in VERTICALS) return raw;
  const mapped = LEGACY_CATEGORY_MAP[raw];
  return mapped ?? null;
}
