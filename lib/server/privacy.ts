import type { ProjectedPoint, SubmissionDetails } from "../../shared/types.js";

const PII_DETAIL_KEYS = new Set([
  "name",
  "siteName",
  "phone",
  "merchantId",
  "merchantIdByProvider",
  "website",
  "secondPhotoUrl",
]);

const PUBLIC_DETAIL_KEYS = new Set([
  "name",
  "siteName",
  "openingHours",
  "outletType",
  "isOpenNow",
  "isOnDuty",
  "isLicensed",
  "hasPrescriptionService",
  "medicineCategories",
  "providers",
  "hasCashAvailable",
  "hasMin50000XafAvailable",
  "isActive",
  "hasFloat",
  "agentType",
  "hasFuelAvailable",
  "pricesByFuel",
  "paymentMethods",
  "paymentModes",
  "fuelType",
  "fuelPrice",
  "price",
  "fuelTypes",
  "quality",
  "availability",
  "queueLength",
  "hasConvenienceStore",
  "hasCarWash",
  "hasATM",
  "servesFood",
  "hasSeating",
  "operatingPeriod",
  "priceRange",
  "brandsAvailable",
  "isFormal",
  "billboardType",
  "size",
  "isOccupied",
  "advertiserBrand",
  "advertiserCategory",
  "condition",
  "isLit",
  "facing",
  "roadName",
  "segmentType",
  "surfaceType",
  "isBlocked",
  "blockageType",
  "blockageSeverity",
  "passableBy",
  "hasStreetLight",
  "hasSidewalk",
  "trafficLevel",
  "estimatedWidth",
  "floodRisk",
  "buildingType",
  "storeyCount",
  "occupancyStatus",
  "estimatedUnits",
  "hasElectricity",
  "hasWater",
  "constructionMaterial",
  "roofMaterial",
  "hasCommercialGround",
  "commercialTypes",
  "nearbyInfrastructure",
  "provider",
  "reliability",
  "brand",
  "operator",
  "lastSeenAt",
  "hasPhoto",
  "hasSecondaryPhoto",
]);

export function stripPiiDetails(details: SubmissionDetails): SubmissionDetails {
  const output: SubmissionDetails = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (PII_DETAIL_KEYS.has(key)) continue;
    output[key] = value;
  }
  return output;
}

export function filterPublicSubmissionDetails(details: SubmissionDetails): SubmissionDetails {
  const output: SubmissionDetails = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (!PUBLIC_DETAIL_KEYS.has(key)) continue;
    output[key] = value;
  }
  return output;
}

export function toPublicProjectedPoint(point: ProjectedPoint): ProjectedPoint {
  return {
    ...point,
    details: filterPublicSubmissionDetails(point.details),
    source: undefined,
    externalId: undefined,
    eventIds: [],
  };
}
