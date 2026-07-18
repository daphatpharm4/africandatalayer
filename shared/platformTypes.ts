export type PlatformRole = "owner" | "manager" | "reviewer" | "collector" | "viewer";
export interface BilingualLabel { en: string; fr: string }
export type PlatformFieldType = "text" | "number" | "select" | "multi_select" | "date" | "boolean" | "photo" | "gps";
export interface PlatformFieldOption { value: string; label: BilingualLabel }
export interface PlatformFieldDefinition {
  key: string; label: BilingualLabel; type: PlatformFieldType; required: boolean;
  options?: PlatformFieldOption[]; min?: number; max?: number;
}
export interface PlatformEvidenceRules {
  gpsRequired: boolean; gpsAccuracyMeters?: number; minPhotos: number; notesRequired: boolean;
}
export interface PlatformRecordType {
  key: string; label: BilingualLabel; fields: PlatformFieldDefinition[]; evidence: PlatformEvidenceRules;
}
export interface PlatformSchemaDefinition { recordTypes: PlatformRecordType[] }
export interface PlatformOrganization {
  id: string; name: string; slug: string; logoUrl: string | null; accentColor: string | null; createdAt: string;
  accessStatus?: PlatformOrganizationAccessStatus;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
}
export type PlatformOrganizationAccessStatus = "active" | "suspended";
export interface PlatformMembership { organizationId: string; userId: string; role: PlatformRole; createdAt: string }
export type PlatformProjectStatus = "draft" | "active" | "archived";
export type PlatformProjectCoverageScope = "town" | "country" | "worldwide";
export interface PlatformProject {
  id: string;
  organizationId: string;
  name: string;
  status: PlatformProjectStatus;
  coverageScope: PlatformProjectCoverageScope;
  coverageLabel: string | null;
  createdAt: string;
}
export interface PlatformSchemaVersion {
  id: string; projectId: string; organizationId: string; version: number;
  status: "draft" | "published"; definition: PlatformSchemaDefinition; publishedAt: string | null;
}
export interface PlatformRecordGps {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}
export interface PlatformRecordEvidence {
  gps?: PlatformRecordGps;
  photos: string[];
  notes?: string;
  capturedAt?: string;
  device?: {
    platform?: string;
    userAgent?: string;
    language?: string;
  };
  photoMetadata?: Array<{
    mimeType: string;
    originalBytes: number;
    storedBytes: number;
    width?: number;
    height?: number;
    capturedAt?: string;
  }>;
}
export interface PlatformRecord {
  id: string;
  projectId: string;
  organizationId: string;
  schemaVersionId: string;
  recordTypeKey: string;
  data: Record<string, unknown>;
  evidence: PlatformRecordEvidence;
  status: "pending_review" | "approved" | "rejected";
  capturedBy: string;
  createdAt: string;
  pointId?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}
export interface PlatformRecordSummary {
  total: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  submittedToday: number;
}
export interface PlatformNearbyPoint {
  pointId: string;
  category: string;
  name: string | null;
  location: { latitude: number; longitude: number };
  updatedAt: string;
  distanceMeters: number;
}
export interface PlatformInvite {
  id: string; organizationId: string; email: string; role: Exclude<PlatformRole, "owner">;
  expiresAt: string; acceptedAt: string | null; createdAt: string;
}

export interface PlatformAdminMemberSummary {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: PlatformRole;
  joinedAt: string;
  suspendedUntil: string | null;
}

export interface PlatformAdminProjectSummary {
  id: string;
  name: string;
  status: PlatformProjectStatus;
  coverageScope: PlatformProjectCoverageScope;
  coverageLabel: string | null;
  recordCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface PlatformAdminOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string | null;
  accessStatus: PlatformOrganizationAccessStatus;
  suspensionReason: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  createdAt: string;
  memberCount: number;
  projectCount: number;
  recordCount: number;
  pendingReviewCount: number;
  members: PlatformAdminMemberSummary[];
  projects: PlatformAdminProjectSummary[];
}
