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
}
export interface PlatformMembership { organizationId: string; userId: string; role: PlatformRole; createdAt: string }
export type PlatformProjectStatus = "draft" | "active" | "archived";
export interface PlatformProject { id: string; organizationId: string; name: string; status: PlatformProjectStatus; createdAt: string }
export interface PlatformSchemaVersion {
  id: string; projectId: string; organizationId: string; version: number;
  status: "draft" | "published"; definition: PlatformSchemaDefinition; publishedAt: string | null;
}
export interface PlatformInvite {
  id: string; organizationId: string; email: string; role: Exclude<PlatformRole, "owner">;
  expiresAt: string; acceptedAt: string | null; createdAt: string;
}
