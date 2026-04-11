import type {
  CollectionAssignment,
  LeaderboardEntry,
  PointEvent,
  ProjectedPoint,
  SubmissionFraudCheck,
  SubmissionPhotoMetadata,
  SubmissionLocation,
  TrendDataPoint,
} from "../../shared/types";

export const BONAMOUSSADI_LOCATION: SubmissionLocation = {
  latitude: 4.0877,
  longitude: 9.7394,
};

export const PLACEHOLDER_IMAGE_DATA_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f2b46" />
        <stop offset="100%" stop-color="#c86b4a" />
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#bg)" />
    <rect x="96" y="108" width="1008" height="584" rx="40" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)" />
    <text x="120" y="182" fill="#ffffff" font-size="44" font-family="Arial, sans-serif" font-weight="700">African Data Layer</text>
    <text x="120" y="246" fill="#ffffff" font-size="30" font-family="Arial, sans-serif">Evidence-ready field capture fixture</text>
    <circle cx="1000" cy="244" r="92" fill="rgba(255,255,255,0.14)" />
    <rect x="120" y="312" width="300" height="212" rx="24" fill="rgba(255,255,255,0.16)" />
    <rect x="450" y="312" width="300" height="212" rx="24" fill="rgba(255,255,255,0.16)" />
    <rect x="780" y="312" width="300" height="212" rx="24" fill="rgba(255,255,255,0.16)" />
    <text x="120" y="610" fill="#ffffff" font-size="24" font-family="Arial, sans-serif">Bonamoussadi fixture image</text>
  </svg>`,
)}`;

export const NOW_ISO = "2026-04-11T09:00:00.000Z";
export const YESTERDAY_ISO = "2026-04-10T08:30:00.000Z";
export const LAST_WEEK_ISO = "2026-04-03T09:00:00.000Z";

export const projectedPoints: ProjectedPoint[] = [
  {
    id: "projected-pharmacy-1",
    pointId: "pt-pharmacy-001",
    category: "pharmacy",
    location: { latitude: 4.0883, longitude: 9.7398 },
    details: {
      name: "Bonamoussadi Pharmacy Center",
      siteName: "Bonamoussadi Pharmacy Center",
      openingHours: "24/7",
      isOpenNow: true,
      isOnDuty: true,
      provider: "Independent",
      confidenceScore: 92,
      lastSeenAt: YESTERDAY_ISO,
      hasPhoto: true,
      reviewerApproved: true,
    },
    photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
    createdAt: LAST_WEEK_ISO,
    updatedAt: YESTERDAY_ISO,
    gaps: ["phone", "website"],
    eventsCount: 3,
    eventIds: ["event-pharmacy-001", "event-pharmacy-002", "event-pharmacy-003"],
  },
  {
    id: "projected-mobile-money-1",
    pointId: "pt-mobile-001",
    category: "mobile_money",
    location: { latitude: 4.0864, longitude: 9.7421 },
    details: {
      name: "Orange Money Corner",
      siteName: "Orange Money Corner",
      providers: ["Orange Money", "MTN MoMo"],
      hasMin50000XafAvailable: true,
      isActive: true,
      confidenceScore: 88,
      lastSeenAt: YESTERDAY_ISO,
      hasPhoto: true,
      reviewerApproved: true,
    },
    photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
    createdAt: LAST_WEEK_ISO,
    updatedAt: NOW_ISO,
    gaps: ["merchantIdByProvider"],
    eventsCount: 2,
    eventIds: ["event-mobile-001", "event-mobile-002"],
  },
  {
    id: "projected-fuel-1",
    pointId: "pt-fuel-001",
    category: "fuel_station",
    location: { latitude: 4.0904, longitude: 9.7368 },
    details: {
      name: "Tradex Bonamoussadi",
      siteName: "Tradex Bonamoussadi",
      fuelType: "super",
      pricesByFuel: { super: 865, diesel: 845 },
      hasFuelAvailable: true,
      paymentMethods: ["Cash", "Orange Money"],
      confidenceScore: 90,
      lastSeenAt: YESTERDAY_ISO,
      hasPhoto: true,
      reviewerApproved: true,
    },
    photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
    createdAt: LAST_WEEK_ISO,
    updatedAt: NOW_ISO,
    gaps: [],
    eventsCount: 1,
    eventIds: ["event-fuel-001"],
  },
];

const makePhotoMetadata = (submissionLocation: SubmissionLocation): SubmissionPhotoMetadata => ({
  gps: submissionLocation,
  capturedAt: YESTERDAY_ISO,
  deviceMake: "Samsung",
  deviceModel: "Galaxy A15",
  submissionDistanceKm: 0.04,
  submissionGpsMatch: true,
  ipDistanceKm: 0.22,
  ipGpsMatch: true,
  exifStatus: "ok",
  exifReason: null,
  exifSource: "upload_buffer",
});

const makeFraudCheck = (location: SubmissionLocation): SubmissionFraudCheck => ({
  submissionLocation: location,
  effectiveLocation: location,
  ipLocation: { latitude: 4.088, longitude: 9.74 },
  primaryPhoto: makePhotoMetadata(location),
  secondaryPhoto: null,
  submissionMatchThresholdKm: 0.3,
  ipMatchThresholdKm: 4,
});

export const pointEvents: PointEvent[] = [
  {
    id: "event-pharmacy-001",
    pointId: "pt-pharmacy-001",
    eventType: "CREATE_EVENT",
    userId: "agent.bonamoussadi@adl.test",
    category: "pharmacy",
    location: { latitude: 4.0883, longitude: 9.7398 },
    details: {
      name: "Bonamoussadi Pharmacy Center",
      siteName: "Bonamoussadi Pharmacy Center",
      openingHours: "24/7",
      isOpenNow: true,
      isOnDuty: true,
      confidenceScore: 92,
      reviewStatus: "pending_review",
      riskScore: 24,
      clientDevice: { deviceId: "device-agent-01", isLowEnd: true, platform: "Android" },
    },
    photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
    createdAt: YESTERDAY_ISO,
  },
  {
    id: "event-mobile-001",
    pointId: "pt-mobile-001",
    eventType: "CREATE_EVENT",
    userId: "agent.bonamoussadi@adl.test",
    category: "mobile_money",
    location: { latitude: 4.0864, longitude: 9.7421 },
    details: {
      name: "Orange Money Corner",
      siteName: "Orange Money Corner",
      providers: ["Orange Money", "MTN MoMo"],
      hasMin50000XafAvailable: true,
      isActive: true,
      confidenceScore: 88,
      reviewStatus: "approved",
      riskScore: 18,
    },
    photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
    createdAt: NOW_ISO,
  },
  {
    id: "event-fuel-001",
    pointId: "pt-fuel-001",
    eventType: "CREATE_EVENT",
    userId: "agent.bonamoussadi@adl.test",
    category: "fuel_station",
    location: { latitude: 4.0904, longitude: 9.7368 },
    details: {
      name: "Tradex Bonamoussadi",
      siteName: "Tradex Bonamoussadi",
      fuelType: "super",
      pricesByFuel: { super: 865, diesel: 845 },
      hasFuelAvailable: true,
      confidenceScore: 90,
      reviewStatus: "approved",
      riskScore: 14,
    },
    photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
    createdAt: NOW_ISO,
  },
];

export const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: "agent.bonamoussadi@adl.test",
    name: "Chantal Field Ops",
    xp: 1280,
    contributions: 78,
    lastContributionAt: NOW_ISO,
    lastLocation: "Bonamoussadi",
    averageQualityScore: 91,
    rankingScore: 94,
    verticalBreakdown: {
      pharmacy: 28,
      mobile_money: 30,
      fuel_station: 20,
    },
  },
  {
    rank: 2,
    userId: "field.reviewer@adl.test",
    name: "Serge Route Mapper",
    xp: 940,
    contributions: 55,
    lastContributionAt: YESTERDAY_ISO,
    lastLocation: "Bonapriso",
    averageQualityScore: 86,
    rankingScore: 88,
    verticalBreakdown: {
      pharmacy: 18,
      fuel_station: 22,
    },
  },
  {
    rank: 3,
    userId: "mobile.money@adl.test",
    name: "Mireille Signal Lead",
    xp: 720,
    contributions: 41,
    lastContributionAt: LAST_WEEK_ISO,
    lastLocation: "Akwa",
    averageQualityScore: 84,
    rankingScore: 82,
    verticalBreakdown: {
      mobile_money: 26,
      alcohol_outlet: 7,
    },
  },
];

export const agentAssignments: CollectionAssignment[] = [
  {
    id: "assignment-bonamoussadi-core",
    agentUserId: "agent.bonamoussadi@adl.test",
    zoneId: "zone-bonamoussadi-core",
    zoneLabel: "Bonamoussadi Core North",
    zoneBounds: {
      south: 4.0848,
      west: 9.7362,
      north: 4.0909,
      east: 9.7446,
    },
    assignedVerticals: ["pharmacy", "mobile_money"],
    assignedDate: "2026-04-10",
    dueDate: "2026-04-13",
    status: "in_progress",
    pointsExpected: 12,
    pointsSubmitted: 5,
    completionRate: 41.7,
    notes: "Prioritize stale pharmacies and active kiosks near Carrefour Market.",
    createdAt: "2026-04-10T07:00:00.000Z",
    updatedAt: NOW_ISO,
  },
];

export const adminFraudCheckByPointId: Record<string, SubmissionFraudCheck> = {
  "pt-pharmacy-001": makeFraudCheck({ latitude: 4.0883, longitude: 9.7398 }),
  "pt-mobile-001": makeFraudCheck({ latitude: 4.0864, longitude: 9.7421 }),
  "pt-fuel-001": makeFraudCheck({ latitude: 4.0904, longitude: 9.7368 }),
};

export const clientTrendData: TrendDataPoint[] = [
  { date: "2026-01-24", value: 18, movingAvg: 18 },
  { date: "2026-01-31", value: 22, movingAvg: 20 },
  { date: "2026-02-07", value: 24, movingAvg: 21.3 },
  { date: "2026-02-14", value: 29, movingAvg: 23.3 },
  { date: "2026-02-21", value: 33, movingAvg: 27 },
  { date: "2026-02-28", value: 37, movingAvg: 30.8 },
  { date: "2026-03-07", value: 42, movingAvg: 35.3 },
  { date: "2026-03-14", value: 46, movingAvg: 39.5 },
  { date: "2026-03-21", value: 49, movingAvg: 43.5 },
  { date: "2026-03-28", value: 54, movingAvg: 47.8 },
  { date: "2026-04-04", value: 58, movingAvg: 51.8 },
  { date: "2026-04-11", value: 63, movingAvg: 56 },
];
