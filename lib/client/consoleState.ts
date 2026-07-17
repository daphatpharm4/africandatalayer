import type {
  PlatformEvidenceRules,
  PlatformFieldDefinition,
  PlatformFieldOption,
  PlatformRecordType,
  PlatformSchemaDefinition,
  PlatformProjectCoverageScope,
  PlatformRole,
} from "../../shared/platformTypes.js";

// ---------------------------------------------------------------------------
// Screen navigation
// ---------------------------------------------------------------------------

export type ConsoleScreen =
  | "LOADING"
  | "AUTH_REQUIRED"
  | "OVERVIEW"
  | "DATA"
  | "REVIEW"
  | "ONBOARDING"
  | "PROJECTS"
  | "SCHEMA_BUILDER"
  | "MEMBERS"
  | "SETTINGS"
  | "JOIN";

export interface ConsoleRoute {
  screen: ConsoleScreen;
  projectId?: string;
  joinToken?: string;
}

/**
 * Parses a location hash into a ConsoleRoute. Total function: never throws,
 * always falls back to PROJECTS for unknown/garbage input. Tolerates a
 * missing "#/" prefix.
 */
export function parseConsoleHash(hash: string): ConsoleRoute {
  const raw = typeof hash === "string" ? hash : "";
  // Strip a leading "#/" or "#" or "/" if present, so we're tolerant of
  // callers passing window.location.hash, a bare path, or nothing at all.
  let path = raw;
  if (path.startsWith("#/")) path = path.slice(2);
  else if (path.startsWith("#")) path = path.slice(1);
  else if (path.startsWith("/")) path = path.slice(1);

  if (path.length === 0) return { screen: "OVERVIEW" };

  const [pathPart, queryPart] = path.split("?");
  const segments = pathPart.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) return { screen: "OVERVIEW" };

  const [first, second, third] = segments;

  if (first === "join") {
    const params = new URLSearchParams(queryPart ?? "");
    const token = params.get("token") ?? undefined;
    return token ? { screen: "JOIN", joinToken: token } : { screen: "JOIN" };
  }

  if (first === "overview") return { screen: "OVERVIEW" };
  if (first === "data") return { screen: "DATA" };
  if (first === "review") return { screen: "REVIEW" };

  if (first === "projects") {
    if (second && third === "schema") {
      return { screen: "SCHEMA_BUILDER", projectId: second };
    }
    return { screen: "PROJECTS" };
  }

  if (first === "members") return { screen: "MEMBERS" };
  if (first === "settings") return { screen: "SETTINGS" };
  if (first === "onboarding") return { screen: "ONBOARDING" };

  return { screen: "OVERVIEW" };
}

/** Inverse of parseConsoleHash for every screen shape it can produce. */
export function consoleRouteToHash(route: ConsoleRoute): string {
  switch (route.screen) {
    case "JOIN":
      return route.joinToken ? `#/join?token=${encodeURIComponent(route.joinToken)}` : "#/join";
    case "SCHEMA_BUILDER":
      return route.projectId ? `#/projects/${route.projectId}/schema` : "#/projects";
    case "PROJECTS":
      return "#/projects";
    case "OVERVIEW":
      return "#/overview";
    case "DATA":
      return "#/data";
    case "REVIEW":
      return "#/review";
    case "MEMBERS":
      return "#/members";
    case "SETTINGS":
      return "#/settings";
    case "ONBOARDING":
      return "#/onboarding";
    case "LOADING":
    case "AUTH_REQUIRED":
    default:
      return "";
  }
}

export function consoleLandingRoute(role: PlatformRole): ConsoleRoute {
  return role === "reviewer" ? { screen: "REVIEW" } : { screen: "OVERVIEW" };
}

export function canAccessConsoleScreen(
  role: PlatformRole,
  screen: ConsoleScreen,
  isAdlAdmin = false,
): boolean {
  switch (screen) {
    case "JOIN":
    case "OVERVIEW":
    case "PROJECTS":
      return true;
    case "DATA":
      return role !== "collector";
    case "REVIEW":
      return role === "reviewer" || role === "manager" || role === "owner";
    case "SCHEMA_BUILDER":
    case "MEMBERS":
      return role === "manager" || role === "owner";
    case "SETTINGS":
      return role === "owner";
    case "ONBOARDING":
      return isAdlAdmin;
    case "LOADING":
    case "AUTH_REQUIRED":
    default:
      return false;
  }
}

export function shouldRequireCompanyInvitation(
  hasOrganizations: boolean,
  screen: ConsoleScreen,
  isAdlAdmin: boolean,
): boolean {
  return !hasOrganizations && screen !== "JOIN" && !isAdlAdmin;
}

// ---------------------------------------------------------------------------
// Onboarding wizard state machine
// ---------------------------------------------------------------------------

export type WizardStep = "org" | "project" | "record_type" | "invite" | "done";

export interface WizardState {
  step: WizardStep;
  orgName: string;
  orgSlug: string;
  slugTouched: boolean;
  projectName: string;
  projectCoverageScope: PlatformProjectCoverageScope;
  projectCoverageLabel: string;
  recordTypeLabelEn: string;
  recordTypeLabelFr: string;
  inviteEmail: string;
  inviteRole: "manager" | "reviewer" | "collector" | "viewer";
  organizationId: string | null;
  projectId: string | null;
}

export const initialWizardState: WizardState = {
  step: "org",
  orgName: "",
  orgSlug: "",
  slugTouched: false,
  projectName: "",
  projectCoverageScope: "town",
  projectCoverageLabel: "",
  recordTypeLabelEn: "",
  recordTypeLabelFr: "",
  inviteEmail: "",
  inviteRole: "collector",
  organizationId: null,
  projectId: null,
};

export type WizardAction =
  | { type: "SET_FIELD"; field: keyof WizardState; value: string }
  | { type: "ORG_CREATED"; organizationId: string }
  | { type: "PROJECT_CREATED"; projectId: string }
  | { type: "RECORD_TYPE_SAVED" }
  | { type: "INVITE_SENT_OR_SKIPPED" };

/**
 * SET_FIELD may only write the free-text string fields. step/slugTouched/
 * organizationId/projectId change exclusively via their dedicated actions —
 * a stray SET_FIELD against them is ignored rather than corrupting state.
 */
const WIZARD_TEXT_FIELDS: ReadonlySet<keyof WizardState> = new Set([
  "orgName",
  "orgSlug",
  "projectName",
  "projectCoverageScope",
  "projectCoverageLabel",
  "recordTypeLabelEn",
  "recordTypeLabelFr",
  "inviteEmail",
  "inviteRole",
]);

/**
 * "Acme Waste!" -> "acme-waste"
 * lowercase -> NFD normalize -> strip diacritics -> non-alphanumeric runs to "-"
 * -> trim leading/trailing "-" -> clamp to 40 chars.
 */
export function slugFromName(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hyphenated = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return hyphenated.slice(0, 40);
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_FIELD": {
      if (action.field === "orgName") {
        const next: WizardState = { ...state, orgName: action.value };
        if (!state.slugTouched) {
          next.orgSlug = slugFromName(action.value);
        }
        return next;
      }
      if (action.field === "orgSlug") {
        return { ...state, orgSlug: action.value, slugTouched: true };
      }
      if (!WIZARD_TEXT_FIELDS.has(action.field)) return state;
      return { ...state, [action.field]: action.value } as WizardState;
    }
    case "ORG_CREATED":
      return { ...state, organizationId: action.organizationId, step: "project" };
    case "PROJECT_CREATED":
      return { ...state, projectId: action.projectId, step: "record_type" };
    case "RECORD_TYPE_SAVED":
      return { ...state, step: "invite" };
    case "INVITE_SENT_OR_SKIPPED":
      return { ...state, step: "done" };
    default:
      return state;
  }
}

export function wizardStepValid(state: WizardState): boolean {
  switch (state.step) {
    case "org":
      return state.orgName.trim().length >= 2 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(state.orgSlug);
    case "project":
      return state.projectName.trim().length >= 2
        && ["town", "country", "worldwide"].includes(state.projectCoverageScope)
        && (state.projectCoverageScope === "worldwide" || state.projectCoverageLabel.trim().length >= 2);
    case "record_type":
      return state.recordTypeLabelEn.trim().length > 0 && state.recordTypeLabelFr.trim().length > 0;
    case "invite":
      return true;
    case "done":
      return true;
    default:
      return false;
  }
}

/**
 * Builds a minimal one-record-type schema definition from the wizard inputs:
 * one required text field "name" + GPS-required, 1-photo evidence.
 */
const RECORD_TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export function wizardRecordTypeDefinition(state: WizardState): PlatformSchemaDefinition {
  const derivedKey = slugFromName(state.recordTypeLabelEn).replace(/-/g, "_");
  const key = RECORD_TYPE_KEY_PATTERN.test(derivedKey) ? derivedKey : "record_type_1";

  const recordType: PlatformRecordType = {
    key,
    label: { en: state.recordTypeLabelEn, fr: state.recordTypeLabelFr },
    fields: [
      {
        key: "name",
        label: { en: "Name", fr: "Nom" },
        type: "text",
        required: true,
      },
    ],
    evidence: {
      gpsRequired: true,
      minPhotos: 1,
      notesRequired: false,
    },
  };

  return { recordTypes: [recordType] };
}

// ---------------------------------------------------------------------------
// Schema builder editing state
// ---------------------------------------------------------------------------

export type BuilderAction =
  | { type: "ADD_RECORD_TYPE" }
  | { type: "REMOVE_RECORD_TYPE"; typeIndex: number }
  | { type: "SET_TYPE_LABEL"; typeIndex: number; lang: "en" | "fr"; value: string }
  | { type: "SET_TYPE_KEY"; typeIndex: number; value: string }
  | { type: "ADD_FIELD"; typeIndex: number }
  | { type: "REMOVE_FIELD"; typeIndex: number; fieldIndex: number }
  | { type: "UPDATE_FIELD"; typeIndex: number; fieldIndex: number; patch: Partial<PlatformFieldDefinition> }
  | { type: "ADD_OPTION"; typeIndex: number; fieldIndex: number }
  | {
      type: "UPDATE_OPTION";
      typeIndex: number;
      fieldIndex: number;
      optionIndex: number;
      patch: Partial<PlatformFieldOption>;
    }
  | { type: "REMOVE_OPTION"; typeIndex: number; fieldIndex: number; optionIndex: number }
  | { type: "UPDATE_EVIDENCE"; typeIndex: number; patch: Partial<PlatformEvidenceRules> };

export function emptyField(index: number): PlatformFieldDefinition {
  return {
    key: `field_${index + 1}`,
    label: { en: "", fr: "" },
    type: "text",
    required: false,
  };
}

export function emptyRecordType(index: number): PlatformRecordType {
  return {
    key: `record_type_${index + 1}`,
    label: { en: "", fr: "" },
    fields: [emptyField(0)],
    evidence: {
      gpsRequired: true,
      minPhotos: 0,
      notesRequired: false,
    },
  };
}

function emptyOption(index: number): PlatformFieldOption {
  return {
    value: `option_${index + 1}`,
    label: { en: "", fr: "" },
  };
}

export function builderReducer(
  definition: PlatformSchemaDefinition,
  action: BuilderAction,
): PlatformSchemaDefinition {
  switch (action.type) {
    case "ADD_RECORD_TYPE": {
      return {
        ...definition,
        recordTypes: [...definition.recordTypes, emptyRecordType(definition.recordTypes.length)],
      };
    }
    case "REMOVE_RECORD_TYPE": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.filter((_, index) => index !== action.typeIndex),
      };
    }
    case "SET_TYPE_LABEL": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            label: { ...recordType.label, [action.lang]: action.value },
          };
        }),
      };
    }
    case "SET_TYPE_KEY": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return { ...recordType, key: action.value };
        }),
      };
    }
    case "ADD_FIELD": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            fields: [...recordType.fields, emptyField(recordType.fields.length)],
          };
        }),
      };
    }
    case "REMOVE_FIELD": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            fields: recordType.fields.filter((_, fieldIndex) => fieldIndex !== action.fieldIndex),
          };
        }),
      };
    }
    case "UPDATE_FIELD": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            fields: recordType.fields.map((field, fieldIndex) => {
              if (fieldIndex !== action.fieldIndex) return field;
              return { ...field, ...action.patch };
            }),
          };
        }),
      };
    }
    case "ADD_OPTION": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            fields: recordType.fields.map((field, fieldIndex) => {
              if (fieldIndex !== action.fieldIndex) return field;
              const options = field.options ?? [];
              return { ...field, options: [...options, emptyOption(options.length)] };
            }),
          };
        }),
      };
    }
    case "UPDATE_OPTION": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            fields: recordType.fields.map((field, fieldIndex) => {
              if (fieldIndex !== action.fieldIndex) return field;
              const options = field.options ?? [];
              return {
                ...field,
                options: options.map((option, optionIndex) => {
                  if (optionIndex !== action.optionIndex) return option;
                  return { ...option, ...action.patch };
                }),
              };
            }),
          };
        }),
      };
    }
    case "REMOVE_OPTION": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            fields: recordType.fields.map((field, fieldIndex) => {
              if (fieldIndex !== action.fieldIndex) return field;
              const options = field.options ?? [];
              return {
                ...field,
                options: options.filter((_, optionIndex) => optionIndex !== action.optionIndex),
              };
            }),
          };
        }),
      };
    }
    case "UPDATE_EVIDENCE": {
      return {
        ...definition,
        recordTypes: definition.recordTypes.map((recordType, index) => {
          if (index !== action.typeIndex) return recordType;
          return {
            ...recordType,
            evidence: { ...recordType.evidence, ...action.patch },
          };
        }),
      };
    }
    default:
      return definition;
  }
}
