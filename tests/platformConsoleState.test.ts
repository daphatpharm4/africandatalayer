import assert from "node:assert/strict";
import test from "node:test";
import { validateSchemaDefinition } from "../shared/platformSchema.js";
import {
  builderReducer,
  canAccessConsoleScreen,
  consoleLandingRoute,
  consoleRouteToHash,
  emptyField,
  emptyRecordType,
  initialWizardState,
  parseConsoleHash,
  slugFromName,
  shouldRequireCompanyInvitation,
  wizardReducer,
  wizardRecordTypeDefinition,
  wizardStepValid,
} from "../lib/client/consoleState.ts";
import type { PlatformSchemaDefinition } from "../shared/platformTypes.js";

// ---------------------------------------------------------------------------
// parseConsoleHash / consoleRouteToHash
// ---------------------------------------------------------------------------

test("parseConsoleHash: empty hash resolves to OVERVIEW", () => {
  assert.deepEqual(parseConsoleHash(""), { screen: "OVERVIEW" });
});

test("parseConsoleHash: join route with token", () => {
  assert.deepEqual(parseConsoleHash("#/join?token=abc"), { screen: "JOIN", joinToken: "abc" });
});

test("parseConsoleHash: join route without token", () => {
  assert.deepEqual(parseConsoleHash("#/join"), { screen: "JOIN" });
});

test("parseConsoleHash: project schema builder route", () => {
  assert.deepEqual(parseConsoleHash("#/projects/p1/schema"), {
    screen: "SCHEMA_BUILDER",
    projectId: "p1",
  });
});

test("parseConsoleHash: bare projects route", () => {
  assert.deepEqual(parseConsoleHash("#/projects"), { screen: "PROJECTS" });
});

test("parseConsoleHash: members route", () => {
  assert.deepEqual(parseConsoleHash("#/members"), { screen: "MEMBERS" });
});

test("parseConsoleHash: settings route", () => {
  assert.deepEqual(parseConsoleHash("#/settings"), { screen: "SETTINGS" });
});

test("parseConsoleHash: onboarding route", () => {
  assert.deepEqual(parseConsoleHash("#/onboarding"), { screen: "ONBOARDING" });
});

test("parseConsoleHash: garbage/unknown path falls back to OVERVIEW", () => {
  assert.deepEqual(parseConsoleHash("#/nonsense/xyz"), { screen: "OVERVIEW" });
  assert.deepEqual(parseConsoleHash("#totally-unknown"), { screen: "OVERVIEW" });
  assert.deepEqual(parseConsoleHash("garbage"), { screen: "OVERVIEW" });
});

test("parseConsoleHash: is total — never throws on odd input", () => {
  const inputs = ["", "#", "#/", "/", "#/join?", "#/projects//schema", "###", "#/projects/p1/schema/extra"];
  for (const input of inputs) {
    assert.doesNotThrow(() => parseConsoleHash(input));
  }
});

test("parseConsoleHash: tolerates a missing '#/' prefix", () => {
  assert.deepEqual(parseConsoleHash("members"), { screen: "MEMBERS" });
  assert.deepEqual(parseConsoleHash("projects/p9/schema"), {
    screen: "SCHEMA_BUILDER",
    projectId: "p9",
  });
  assert.deepEqual(parseConsoleHash("join?token=xyz"), { screen: "JOIN", joinToken: "xyz" });
});

test("consoleRouteToHash: inverse of parseConsoleHash for every screen", () => {
  const routes: Array<Parameters<typeof consoleRouteToHash>[0]> = [
    { screen: "OVERVIEW" },
    { screen: "DATA" },
    { screen: "REVIEW" },
    { screen: "PROJECTS" },
    { screen: "MEMBERS" },
    { screen: "SETTINGS" },
    { screen: "ONBOARDING" },
    { screen: "JOIN", joinToken: "abc" },
    { screen: "SCHEMA_BUILDER", projectId: "p1" },
  ];
  for (const route of routes) {
    const hash = consoleRouteToHash(route);
    assert.deepEqual(parseConsoleHash(hash), route);
  }
});

test("console role routing gives each role only its work surfaces", () => {
  assert.deepEqual(consoleLandingRoute("reviewer"), { screen: "REVIEW" });
  assert.deepEqual(consoleLandingRoute("viewer"), { screen: "OVERVIEW" });
  assert.equal(canAccessConsoleScreen("viewer", "PROJECTS"), true);
  assert.equal(canAccessConsoleScreen("viewer", "DATA"), true);
  assert.equal(canAccessConsoleScreen("viewer", "REVIEW"), false);
  assert.equal(canAccessConsoleScreen("reviewer", "REVIEW"), true);
  assert.equal(canAccessConsoleScreen("collector", "DATA"), false);
  assert.equal(canAccessConsoleScreen("reviewer", "MEMBERS"), false);
  assert.equal(canAccessConsoleScreen("manager", "MEMBERS"), true);
  assert.equal(canAccessConsoleScreen("manager", "SETTINGS"), false);
  assert.equal(canAccessConsoleScreen("owner", "SETTINGS"), true);
  assert.equal(canAccessConsoleScreen("owner", "ONBOARDING"), false);
  assert.equal(canAccessConsoleScreen("owner", "ONBOARDING", true), true);
});

test("normal accounts without a company must use an invitation", () => {
  assert.equal(shouldRequireCompanyInvitation(false, "OVERVIEW", false), true);
  assert.equal(shouldRequireCompanyInvitation(false, "JOIN", false), false);
  assert.equal(shouldRequireCompanyInvitation(false, "ONBOARDING", true), false);
  assert.equal(shouldRequireCompanyInvitation(true, "OVERVIEW", false), false);
});

test("consoleRouteToHash: LOADING and AUTH_REQUIRED have no addressable hash", () => {
  assert.equal(consoleRouteToHash({ screen: "LOADING" }), "");
  assert.equal(consoleRouteToHash({ screen: "AUTH_REQUIRED" }), "");
});

// ---------------------------------------------------------------------------
// slugFromName
// ---------------------------------------------------------------------------

test("slugFromName: basic case with punctuation", () => {
  assert.equal(slugFromName("Acme Waste!"), "acme-waste");
});

test("slugFromName: strips accents/diacritics", () => {
  assert.equal(slugFromName("Société Générale"), "societe-generale");
  assert.equal(slugFromName("Yaoundé Ãgent"), "yaounde-agent");
});

test("slugFromName: collapses non-alphanumeric runs and trims hyphens", () => {
  assert.equal(slugFromName("  --Multiple   Spaces--  "), "multiple-spaces");
  assert.equal(slugFromName("###"), "");
});

test("slugFromName: clamps to 40 characters", () => {
  const longName = "a".repeat(60);
  const slug = slugFromName(longName);
  assert.equal(slug.length, 40);
  assert.equal(slug, "a".repeat(40));
});

// ---------------------------------------------------------------------------
// Wizard reducer happy path
// ---------------------------------------------------------------------------

test("wizard happy path: org -> project -> record_type -> invite -> done", () => {
  let state = initialWizardState;
  assert.equal(state.step, "org");

  state = wizardReducer(state, { type: "SET_FIELD", field: "orgName", value: "Acme Waste" });
  assert.equal(state.orgSlug, "acme-waste");
  assert.equal(wizardStepValid(state), true);

  state = wizardReducer(state, { type: "ORG_CREATED", organizationId: "org-1" });
  assert.equal(state.step, "project");
  assert.equal(state.organizationId, "org-1");

  state = wizardReducer(state, { type: "SET_FIELD", field: "projectName", value: "Douala Pilot" });
  state = wizardReducer(state, { type: "SET_FIELD", field: "projectCoverageLabel", value: "Douala" });
  assert.equal(wizardStepValid(state), true);

  state = wizardReducer(state, { type: "PROJECT_CREATED", projectId: "proj-1" });
  assert.equal(state.step, "record_type");
  assert.equal(state.projectId, "proj-1");

  state = wizardReducer(state, { type: "SET_FIELD", field: "recordTypeLabelEn", value: "Waste Bin" });
  state = wizardReducer(state, { type: "SET_FIELD", field: "recordTypeLabelFr", value: "Bac à ordures" });
  assert.equal(wizardStepValid(state), true);

  state = wizardReducer(state, { type: "RECORD_TYPE_SAVED" });
  assert.equal(state.step, "invite");
  assert.equal(wizardStepValid(state), true); // invite always valid (skip allowed)

  state = wizardReducer(state, { type: "INVITE_SENT_OR_SKIPPED" });
  assert.equal(state.step, "done");
});

test("wizard: SET_FIELD orgName auto-derives orgSlug until slugTouched", () => {
  let state = initialWizardState;
  state = wizardReducer(state, { type: "SET_FIELD", field: "orgName", value: "Acme Waste" });
  assert.equal(state.orgSlug, "acme-waste");
  assert.equal(state.slugTouched, false);

  // Manually touching the slug locks it.
  state = wizardReducer(state, { type: "SET_FIELD", field: "orgSlug", value: "custom-slug" });
  assert.equal(state.orgSlug, "custom-slug");
  assert.equal(state.slugTouched, true);

  // Further orgName changes no longer overwrite the slug.
  state = wizardReducer(state, { type: "SET_FIELD", field: "orgName", value: "Something Else" });
  assert.equal(state.orgName, "Something Else");
  assert.equal(state.orgSlug, "custom-slug");
});

test("SET_FIELD ignores non-text fields (step, slugTouched, organizationId)", () => {
  const afterStep = wizardReducer(initialWizardState, { type: "SET_FIELD", field: "step", value: "bogus" } as any);
  assert.equal(afterStep.step, initialWizardState.step);

  const afterTouched = wizardReducer(initialWizardState, { type: "SET_FIELD", field: "slugTouched", value: "true" } as any);
  assert.equal(afterTouched.slugTouched, false);

  const afterOrg = wizardReducer(initialWizardState, { type: "SET_FIELD", field: "organizationId", value: "evil" } as any);
  assert.equal(afterOrg.organizationId, null);
});

test("wizardStepValid: false on empty required inputs per step", () => {
  assert.equal(wizardStepValid(initialWizardState), false); // org: empty name/slug

  const projectStep = { ...initialWizardState, step: "project" as const };
  assert.equal(wizardStepValid(projectStep), false);

  const recordTypeStep = {
    ...initialWizardState,
    step: "record_type" as const,
    recordTypeLabelEn: "Waste Bin",
    recordTypeLabelFr: "",
  };
  assert.equal(wizardStepValid(recordTypeStep), false);

  const inviteStep = { ...initialWizardState, step: "invite" as const };
  assert.equal(wizardStepValid(inviteStep), true);
});

test("wizard project coverage accepts town, country, or worldwide", () => {
  const projectState = {
    ...initialWizardState,
    step: "project" as const,
    projectName: "Market census",
  };
  assert.equal(wizardStepValid(projectState), false, "town needs a name");
  assert.equal(wizardStepValid({ ...projectState, projectCoverageLabel: "Nairobi" }), true);
  assert.equal(wizardStepValid({ ...projectState, projectCoverageScope: "country", projectCoverageLabel: "Kenya" }), true);
  assert.equal(wizardStepValid({ ...projectState, projectCoverageScope: "worldwide", projectCoverageLabel: "" }), true);
});

// ---------------------------------------------------------------------------
// wizardRecordTypeDefinition
// ---------------------------------------------------------------------------

test("wizardRecordTypeDefinition: produces a definition that passes validateSchemaDefinition", () => {
  const state = {
    ...initialWizardState,
    recordTypeLabelEn: "Waste Bin",
    recordTypeLabelFr: "Bac à ordures",
  };
  const definition = wizardRecordTypeDefinition(state);
  const result = validateSchemaDefinition(definition);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify((result as { issues: unknown }).issues));

  assert.equal(definition.recordTypes.length, 1);
  const recordType = definition.recordTypes[0];
  assert.equal(recordType.label.en, "Waste Bin");
  assert.equal(recordType.label.fr, "Bac à ordures");
  assert.equal(recordType.fields.length, 1);
  assert.deepEqual(recordType.fields[0], {
    key: "name",
    label: { en: "Name", fr: "Nom" },
    type: "text",
    required: true,
  });
  assert.deepEqual(recordType.evidence, { gpsRequired: true, minPhotos: 1, notesRequired: false });
});

test("wizardRecordTypeDefinition: falls back to a safe key when the label yields none", () => {
  const state = { ...initialWizardState, recordTypeLabelEn: "!!!", recordTypeLabelFr: "!!!" };
  const definition = wizardRecordTypeDefinition(state);
  assert.equal(definition.recordTypes[0].key, "record_type_1");
  const result = validateSchemaDefinition(definition);
  assert.equal(result.ok, true);
});

test("wizardRecordTypeDefinition: derives a snake_case key from the English label", () => {
  const state = { ...initialWizardState, recordTypeLabelEn: "Waste Bin", recordTypeLabelFr: "Bac" };
  const definition = wizardRecordTypeDefinition(state);
  assert.equal(definition.recordTypes[0].key, "waste_bin");
});

// ---------------------------------------------------------------------------
// Schema builder reducer: emptyRecordType / emptyField
// ---------------------------------------------------------------------------

test("emptyRecordType: builds expected shape", () => {
  const recordType = emptyRecordType(2);
  assert.equal(recordType.key, "record_type_3");
  assert.deepEqual(recordType.label, { en: "", fr: "" });
  assert.equal(recordType.fields.length, 1);
  assert.equal(recordType.fields[0].type, "text");
  assert.deepEqual(recordType.evidence, { gpsRequired: true, minPhotos: 0, notesRequired: false });
});

test("emptyField: builds expected shape", () => {
  const field = emptyField(3);
  assert.equal(field.key, "field_4");
  assert.equal(field.type, "text");
  assert.equal(field.required, false);
});

// ---------------------------------------------------------------------------
// builderReducer: immutability + ADD/REMOVE/UPDATE for types, fields, options, evidence
// ---------------------------------------------------------------------------

function baseDefinition(): PlatformSchemaDefinition {
  return {
    recordTypes: [
      {
        key: "waste_bin",
        label: { en: "Waste Bin", fr: "Bac" },
        fields: [
          { key: "name", label: { en: "Name", fr: "Nom" }, type: "text", required: true },
          {
            key: "condition",
            label: { en: "Condition", fr: "Etat" },
            type: "select",
            required: false,
            options: [{ value: "good", label: { en: "Good", fr: "Bon" } }],
          },
        ],
        evidence: { gpsRequired: true, minPhotos: 1, notesRequired: false },
      },
    ],
  };
}

test("builderReducer: ADD_RECORD_TYPE appends an empty record type immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, { type: "ADD_RECORD_TYPE" });
  assert.notEqual(result, input);
  assert.notEqual(result.recordTypes, input.recordTypes);
  assert.equal(result.recordTypes.length, 2);
  assert.equal(result.recordTypes[1].key, "record_type_2");
  // original untouched
  assert.equal(input.recordTypes.length, 1);
});

test("builderReducer: REMOVE_RECORD_TYPE removes by index immutably", () => {
  const input = baseDefinition();
  const withSecond = builderReducer(input, { type: "ADD_RECORD_TYPE" });
  const result = builderReducer(withSecond, { type: "REMOVE_RECORD_TYPE", typeIndex: 0 });
  assert.notEqual(result, withSecond);
  assert.equal(result.recordTypes.length, 1);
  assert.equal(result.recordTypes[0].key, "record_type_2");
  assert.equal(withSecond.recordTypes.length, 2); // original untouched
});

test("builderReducer: SET_TYPE_LABEL updates one language immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, {
    type: "SET_TYPE_LABEL",
    typeIndex: 0,
    lang: "fr",
    value: "Bac à ordures",
  });
  assert.notEqual(result, input);
  assert.notEqual(result.recordTypes[0], input.recordTypes[0]);
  assert.equal(result.recordTypes[0].label.fr, "Bac à ordures");
  assert.equal(result.recordTypes[0].label.en, "Waste Bin");
  assert.equal(input.recordTypes[0].label.fr, "Bac"); // original untouched
});

test("builderReducer: SET_TYPE_KEY updates the key immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, { type: "SET_TYPE_KEY", typeIndex: 0, value: "bin_v2" });
  assert.notEqual(result, input);
  assert.equal(result.recordTypes[0].key, "bin_v2");
  assert.equal(input.recordTypes[0].key, "waste_bin");
});

test("builderReducer: ADD_FIELD appends an empty field immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, { type: "ADD_FIELD", typeIndex: 0 });
  assert.notEqual(result, input);
  assert.notEqual(result.recordTypes[0].fields, input.recordTypes[0].fields);
  assert.equal(result.recordTypes[0].fields.length, 3);
  assert.equal(result.recordTypes[0].fields[2].key, "field_3");
  assert.equal(input.recordTypes[0].fields.length, 2); // original untouched
});

test("builderReducer: REMOVE_FIELD removes by index immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, { type: "REMOVE_FIELD", typeIndex: 0, fieldIndex: 0 });
  assert.notEqual(result, input);
  assert.equal(result.recordTypes[0].fields.length, 1);
  assert.equal(result.recordTypes[0].fields[0].key, "condition");
  assert.equal(input.recordTypes[0].fields.length, 2); // original untouched
});

test("builderReducer: UPDATE_FIELD applies a partial patch immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, {
    type: "UPDATE_FIELD",
    typeIndex: 0,
    fieldIndex: 0,
    patch: { required: false, label: { en: "Full Name", fr: "Nom complet" } },
  });
  assert.notEqual(result, input);
  assert.notEqual(result.recordTypes[0].fields[0], input.recordTypes[0].fields[0]);
  assert.equal(result.recordTypes[0].fields[0].required, false);
  assert.equal(result.recordTypes[0].fields[0].label.en, "Full Name");
  assert.equal(result.recordTypes[0].fields[0].type, "text"); // untouched props preserved
  assert.equal(input.recordTypes[0].fields[0].required, true); // original untouched
});

test("builderReducer: ADD_OPTION appends an option immutably (creates array if absent)", () => {
  const input = baseDefinition();
  // field 0 ("name") has no options at all yet.
  const result = builderReducer(input, { type: "ADD_OPTION", typeIndex: 0, fieldIndex: 0 });
  assert.notEqual(result, input);
  assert.equal(result.recordTypes[0].fields[0].options?.length, 1);
  assert.equal(result.recordTypes[0].fields[0].options?.[0].value, "option_1");
  assert.equal(input.recordTypes[0].fields[0].options, undefined); // original untouched

  const resultTwo = builderReducer(result, { type: "ADD_OPTION", typeIndex: 0, fieldIndex: 1 });
  assert.equal(resultTwo.recordTypes[0].fields[1].options?.length, 2);
});

test("builderReducer: UPDATE_OPTION patches by index immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, {
    type: "UPDATE_OPTION",
    typeIndex: 0,
    fieldIndex: 1,
    optionIndex: 0,
    patch: { value: "damaged" },
  });
  assert.notEqual(result, input);
  assert.equal(result.recordTypes[0].fields[1].options?.[0].value, "damaged");
  assert.equal(input.recordTypes[0].fields[1].options?.[0].value, "good"); // original untouched
});

test("builderReducer: REMOVE_OPTION removes by index immutably", () => {
  const input = baseDefinition();
  const withTwoOptions = builderReducer(input, { type: "ADD_OPTION", typeIndex: 0, fieldIndex: 1 });
  assert.equal(withTwoOptions.recordTypes[0].fields[1].options?.length, 2);

  const result = builderReducer(withTwoOptions, {
    type: "REMOVE_OPTION",
    typeIndex: 0,
    fieldIndex: 1,
    optionIndex: 0,
  });
  assert.notEqual(result, withTwoOptions);
  assert.equal(result.recordTypes[0].fields[1].options?.length, 1);
  assert.equal(result.recordTypes[0].fields[1].options?.[0].value, "option_2");
});

test("builderReducer: UPDATE_EVIDENCE patches evidence rules immutably", () => {
  const input = baseDefinition();
  const result = builderReducer(input, {
    type: "UPDATE_EVIDENCE",
    typeIndex: 0,
    patch: { minPhotos: 3, notesRequired: true },
  });
  assert.notEqual(result, input);
  assert.notEqual(result.recordTypes[0].evidence, input.recordTypes[0].evidence);
  assert.deepEqual(result.recordTypes[0].evidence, {
    gpsRequired: true,
    minPhotos: 3,
    notesRequired: true,
  });
  assert.deepEqual(input.recordTypes[0].evidence, {
    gpsRequired: true,
    minPhotos: 1,
    notesRequired: false,
  }); // original untouched
});
