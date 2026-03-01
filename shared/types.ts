export type SubmissionCategory = "pharmacy" | "fuel_station" | "mobile_money";
export type PointEventType = "CREATE_EVENT" | "ENRICH_EVENT";
export type MapScope = "bonamoussadi" | "cameroon" | "global";

export interface SubmissionLocation {
  latitude: number;
  longitude: number;
}

export type SubmissionExifStatus = "ok" | "missing" | "parse_error" | "unsupported_format" | "fallback_recovered";
export type SubmissionExifSource = "upload_buffer" | "remote_url" | "none";

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

export interface SubmissionDetails {
  name?: string;
  siteName?: string;
  openingHours?: string;
  isOpenNow?: boolean;
  isOnDuty?: boolean;
  providers?: string[];
  hasCashAvailable?: boolean;
  hasMin50000XafAvailable?: boolean;
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
  source?: string;
  externalId?: string;
  isImported?: boolean;
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

export interface Submission extends PointEvent {}

export interface AdminSubmissionEvent {
  event: PointEvent;
  user: {
    id: string;
    name: string;
    email: string | null;
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
  mapScope?: MapScope;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  contributions: number;
  lastContributionAt: string | null;
  lastLocation: string;
}
