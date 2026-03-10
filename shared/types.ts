export type SubmissionCategory =
  | "pharmacy"
  | "fuel_station"
  | "mobile_money"
  | "alcohol_outlet"
  | "billboard"
  | "transport_road"
  | "census_proxy";
export type PointEventType = "CREATE_EVENT" | "ENRICH_EVENT";
export type MapScope = "bonamoussadi" | "cameroon" | "global";
export type UserRole = "agent" | "admin" | "client";
export type CollectionAssignmentStatus = "pending" | "in_progress" | "completed" | "expired";
export type DedupDecision = "allow_create" | "use_existing";
export type ConsentStatus = "obtained" | "refused_pii_only" | "not_required" | "withdrawn";
export type TrustTier = "new" | "standard" | "trusted" | "restricted";

export interface SubmissionLocation {
  latitude: number;
  longitude: number;
}

export type SubmissionExifStatus = "ok" | "missing" | "parse_error" | "unsupported_format" | "fallback_recovered";
export type SubmissionExifSource = "upload_buffer" | "remote_url" | "client_fallback" | "none";

export interface SubmissionPhotoMetadata {
  gps: SubmissionLocation | null;
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
  submissionDistanceKm: number | null;
  submissionGpsMatch: boolean | null;
  ipDistanceKm: number | null;
  ipGpsMatch: boolean | null;
  exifStatus: SubmissionExifStatus;
  exifReason: string | null;
  exifSource: SubmissionExifSource;
}

export interface SubmissionFraudCheck {
  submissionLocation: SubmissionLocation | null;
  effectiveLocation: SubmissionLocation;
  ipLocation: SubmissionLocation | null;
  primaryPhoto: SubmissionPhotoMetadata | null;
  secondaryPhoto: SubmissionPhotoMetadata | null;
  submissionMatchThresholdKm: number;
  ipMatchThresholdKm: number;
}

export interface ClientDeviceInfo {
  deviceId: string;
  platform?: string;
  userAgent?: string;
  deviceMemoryGb?: number | null;
  hardwareConcurrency?: number | null;
  isLowEnd?: boolean;
}

export interface GpsIntegrityReport {
  mockLocationDetected: boolean;
  mockLocationMethod: string | null;
  hasAccelerometerData: boolean;
  hasGyroscopeData: boolean;
  accelerometerSampleCount: number;
  motionDetectedDuringCapture: boolean;
  gpsAccuracyMeters: number | null;
  networkType: string | null;
  gpsTimestamp: number | null;
  deviceTimestamp: number;
  timeDeltaMs: number | null;
}

export interface SubmissionDetails {
  name?: string;
  siteName?: string;
  openingHours?: string;
  outletType?: string;
  isOpenNow?: boolean;
  isOnDuty?: boolean;
  isLicensed?: boolean;
  hasPrescriptionService?: boolean;
  medicineCategories?: string[];
  providers?: string[];
  hasCashAvailable?: boolean;
  hasMin50000XafAvailable?: boolean;
  isActive?: boolean;
  hasFloat?: boolean;
  agentType?: string;
  hasFuelAvailable?: boolean;
  pricesByFuel?: Record<string, number>;
  paymentMethods?: string[];
  paymentModes?: string[];
  fuelType?: string;
  fuelPrice?: number;
  price?: number;
  fuelTypes?: string[];
  quality?: string;
  availability?: string;
  queueLength?: string;
  hasConvenienceStore?: boolean;
  hasCarWash?: boolean;
  hasATM?: boolean;
  servesFood?: boolean;
  hasSeating?: boolean;
  operatingPeriod?: string;
  priceRange?: string;
  brandsAvailable?: string[];
  isFormal?: boolean;
  billboardType?: string;
  size?: string;
  isOccupied?: boolean;
  advertiserBrand?: string;
  advertiserCategory?: string;
  condition?: string;
  isLit?: boolean;
  facing?: string;
  roadName?: string;
  segmentType?: string;
  surfaceType?: string;
  isBlocked?: boolean;
  blockageType?: string;
  blockageSeverity?: string;
  passableBy?: string[];
  hasStreetLight?: boolean;
  hasSidewalk?: boolean;
  trafficLevel?: string;
  estimatedWidth?: string;
  floodRisk?: string;
  buildingType?: string;
  storeyCount?: number;
  occupancyStatus?: string;
  estimatedUnits?: number;
  hasElectricity?: boolean;
  hasWater?: boolean;
  constructionMaterial?: string;
  roofMaterial?: string;
  hasCommercialGround?: boolean;
  commercialTypes?: string[];
  nearbyInfrastructure?: string[];
  provider?: string;
  merchantId?: string;
  merchantIdByProvider?: Record<string, string>;
  reliability?: string;
  phone?: string;
  brand?: string;
  operator?: string;
  website?: string;
  confidenceScore?: number;
  lastSeenAt?: string;
  hasPhoto?: boolean;
  hasSecondaryPhoto?: boolean;
  secondPhotoUrl?: string;
  fraudCheck?: SubmissionFraudCheck;
  clientDevice?: ClientDeviceInfo;
  consentStatus?: ConsentStatus;
  consentRecordedAt?: string;
  gpsIntegrity?: GpsIntegrityReport;
  photoEvidenceSha256?: string;
  source?: string;
  externalId?: string;
  isImported?: boolean;
  reviewerApproved?: boolean;
  [key: string]: unknown;
}

export interface PointEvent {
  id: string;
  pointId: string;
  eventType: PointEventType;
  userId: string;
  category: SubmissionCategory;
  location: SubmissionLocation;
  details: SubmissionDetails;
  photoUrl?: string;
  createdAt: string;
  source?: string;
  externalId?: string;
  consentStatus?: ConsentStatus;
  consentRecordedAt?: string;
  erasedAt?: string | null;
  erasedBy?: string | null;
  erasureReason?: string | null;
}

export interface ProjectedPoint {
  id: string;
  pointId: string;
  category: SubmissionCategory;
  location: SubmissionLocation;
  details: SubmissionDetails;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
  source?: string;
  externalId?: string;
  gaps: string[];
  eventsCount: number;
  eventIds: string[];
}

export type Submission = PointEvent;

export interface AdminSubmissionEvent {
  event: PointEvent;
  user: {
    id: string;
    name: string;
    email: string | null;
    trustScore?: number;
    trustTier?: TrustTier;
    suspendedUntil?: string | null;
  };
  fraudCheck: SubmissionFraudCheck | null;
}

export interface LegacySubmission {
  id: string;
  userId: string;
  category: Exclude<SubmissionCategory, "pharmacy">;
  location: SubmissionLocation;
  details: SubmissionDetails;
  photoUrl?: string;
  createdAt: string;
}

export interface ClientExifData {
  latitude?: number | null;
  longitude?: number | null;
  capturedAt?: string | null;
  deviceMake?: string | null;
  deviceModel?: string | null;
}

export interface SubmissionInput {
  eventType?: PointEventType;
  pointId?: string;
  category: SubmissionCategory;
  location?: SubmissionLocation;
  details?: SubmissionDetails;
  imageBase64?: string;
  secondImageBase64?: string;
  clientExif?: ClientExifData | null;
  dedupDecision?: DedupDecision;
  dedupTargetPointId?: string;
  consentStatus?: ConsentStatus;
  consentRecordedAt?: string;
  gpsIntegrity?: GpsIntegrityReport;
  photoEvidenceSha256?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  image?: string;
  occupation?: string;
  XP: number;
  passwordHash?: string;
  isAdmin?: boolean;
  role?: UserRole;
  mapScope?: MapScope;
  trustScore?: number;
  trustTier?: TrustTier;
  suspendedUntil?: string | null;
  wipeRequested?: boolean;
  failedLoginCount?: number;
  lockedUntil?: string | null;
}

export interface PrivacyRequest {
  id: string;
  requestType: "access" | "rectification" | "erasure";
  status: "open" | "in_progress" | "completed" | "rejected";
  subjectReference: string;
  createdBy: string;
  assignedTo?: string | null;
  notes?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  contributions: number;
  lastContributionAt: string | null;
  lastLocation: string;
  averageQualityScore: number;
  rankingScore: number;
  verticalBreakdown: Partial<Record<SubmissionCategory, number>>;
}

// Delta / Snapshot types
export type DeltaType = "new" | "removed" | "changed" | "unchanged";
export type DeltaDirection = "increase" | "decrease" | "stable" | "not_applicable";
export type DeltaSignificance = "high" | "medium" | "low";

export interface SnapshotDelta {
  id: string;
  snapshotDate: string;
  baselineSnapshotDate: string;
  verticalId: string;
  pointId: string;
  deltaType: DeltaType;
  deltaField: string | null;
  previousValue: string | null;
  currentValue: string | null;
  deltaMagnitude: number | null;
  deltaDirection: DeltaDirection;
  deltaSummary: string | null;
  significance: DeltaSignificance;
  isPublishable: boolean;
  isFromPartialSnapshot: boolean;
}

export interface AnomalyFlag {
  metric: string;
  zScore: number;
  direction: DeltaDirection;
}

export interface SnapshotStats {
  id: string;
  snapshotDate: string;
  verticalId: string;
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
  newCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  avgPrice: number | null;
  weekOverWeekGrowth: number | null;
  movingAvg4w: number | null;
  zScoreTotalPoints: number | null;
  zScoreNewCount: number | null;
  zScoreRemovedCount: number | null;
  anomalyFlags: AnomalyFlag[];
  isBaseline: boolean;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  movingAvg: number | null;
}

export interface ZoneBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface CollectionAssignment {
  id: string;
  agentUserId: string;
  zoneId: string;
  zoneLabel: string;
  zoneBounds: ZoneBounds;
  assignedVerticals: SubmissionCategory[];
  assignedDate: string;
  dueDate: string;
  status: CollectionAssignmentStatus;
  pointsExpected: number;
  pointsSubmitted: number;
  completionRate: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionAssignmentCreateInput {
  agentUserId: string;
  zoneId: string;
  assignedVerticals: SubmissionCategory[];
  assignedDate?: string;
  dueDate: string;
  pointsExpected?: number;
  notes?: string | null;
}

export interface CollectionAssignmentUpdateInput {
  status?: CollectionAssignmentStatus;
  pointsSubmitted?: number;
  notes?: string | null;
}

export interface AssignmentPlannerContext {
  zones: Array<{
    id: string;
    label: string;
    bounds: ZoneBounds;
  }>;
  agents: Array<{
    id: string;
    name: string;
    email: string | null;
  }>;
}

export interface DedupCandidate {
  pointId: string;
  category: SubmissionCategory;
  siteName: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  similarityScore: number;
  matchScore: number;
}

export interface DedupCheckResult {
  shouldPrompt: boolean;
  radiusMeters: number;
  bestCandidatePointId: string | null;
  candidates: DedupCandidate[];
}
