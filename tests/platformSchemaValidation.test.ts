import assert from "node:assert/strict";
import test from "node:test";
import { roleAtLeast, validateSchemaDefinition } from "../shared/platformSchema.js";

const validDefinition = {
  recordTypes: [
    {
      key: "waste_bin",
      label: { en: "Waste bin", fr: "Bac à ordures" },
      evidence: { gpsRequired: true, gpsAccuracyMeters: 25, minPhotos: 1, notesRequired: false },
      fields: [
        { key: "condition", label: { en: "Condition", fr: "État" }, type: "select", required: true,
          options: [
            { value: "good", label: { en: "Good", fr: "Bon" } },
            { value: "damaged", label: { en: "Damaged", fr: "Endommagé" } },
          ] },
        { key: "capacity_liters", label: { en: "Capacity (L)", fr: "Capacité (L)" }, type: "number",
          required: false, min: 0, max: 5000 },
      ],
    },
  ],
};

test("role hierarchy ranks owner above viewer", () => {
  assert.equal(roleAtLeast("owner", "manager"), true);
  assert.equal(roleAtLeast("viewer", "collector"), false);
  assert.equal(roleAtLeast("reviewer", "reviewer"), true);
});

test("valid schema definition passes", () => {
  const result = validateSchemaDefinition(validDefinition);
  assert.equal(result.ok, true);
});

test("empty record types rejected", () => {
  const result = validateSchemaDefinition({ recordTypes: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.issues[0].message, /at least one record type/i);
});

test("record type without fields rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].fields = [];
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("duplicate field keys rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].fields[1].key = "condition";
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.issues[0].message, /duplicate/i);
});

test("select without options rejected", () => {
  const bad = structuredClone(validDefinition);
  delete (bad.recordTypes[0].fields[0] as Record<string, unknown>).options;
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("missing french label rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].label.fr = "";
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("number min above max rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].fields[1].min = 10;
  bad.recordTypes[0].fields[1].max = 5;
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});

test("invalid key format rejected", () => {
  const bad = structuredClone(validDefinition);
  bad.recordTypes[0].key = "Waste Bin!";
  const result = validateSchemaDefinition(bad);
  assert.equal(result.ok, false);
});
