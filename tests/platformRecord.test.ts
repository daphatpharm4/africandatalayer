import assert from "node:assert/strict";
import test from "node:test";
import { validatePlatformRecord } from "../shared/platformRecord.ts";
import type { PlatformRecordType } from "../shared/platformTypes.ts";

const recordType: PlatformRecordType = {
  key: "retail_outlet",
  label: { en: "Retail outlet", fr: "Point de vente" },
  fields: [
    { key: "name", label: { en: "Name", fr: "Nom" }, type: "text", required: true },
    { key: "employees", label: { en: "Employees", fr: "Employés" }, type: "number", required: true, min: 1, max: 100 },
    { key: "formal", label: { en: "Formal", fr: "Formel" }, type: "boolean", required: true },
  ],
  evidence: { gpsRequired: true, gpsAccuracyMeters: 25, minPhotos: 1, notesRequired: true },
};

test("validatePlatformRecord accepts typed fields and complete evidence", () => {
  assert.deepEqual(validatePlatformRecord(recordType, {
    name: "Central kiosk", employees: 3, formal: false,
  }, {
    gps: { latitude: 4.05, longitude: 9.7, accuracyMeters: 8 },
    photos: ["data:image/jpeg;base64,abc"],
    notes: "Open during visit",
  }), []);
});

test("validatePlatformRecord rejects missing, unknown, out-of-range, and weak evidence", () => {
  const issues = validatePlatformRecord(recordType, {
    employees: 0, formal: "yes", injected: true,
  }, {
    gps: { latitude: 4.05, longitude: 9.7, accuracyMeters: 80 },
    photos: [],
  });
  assert.ok(issues.some((issue) => issue.path === "data.name"));
  assert.ok(issues.some((issue) => issue.path === "data.employees"));
  assert.ok(issues.some((issue) => issue.path === "data.formal"));
  assert.ok(issues.some((issue) => issue.path === "data.injected"));
  assert.ok(issues.some((issue) => issue.path === "evidence.gps.accuracyMeters"));
  assert.ok(issues.some((issue) => issue.path === "evidence.photos"));
  assert.ok(issues.some((issue) => issue.path === "evidence.notes"));
});
