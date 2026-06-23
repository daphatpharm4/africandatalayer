import assert from "node:assert/strict";
import test from "node:test";
import type { UserProfile } from "../shared/types.js";
import { createPostgresProfilePersistence } from "../lib/server/storage/postgresStore.js";

type QueryCall = {
  text: string;
  values: unknown[];
};

function missingColumn(column: string, relation?: string): Error & { code: string } {
  const target = relation ? `column "${column}" of relation "${relation}"` : `column "${column}"`;
  return Object.assign(new Error(`${target} does not exist`), { code: "42703" });
}

function profileRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "operator@example.com",
    email: "operator@example.com",
    phone: "+237600000000",
    name: "Operator",
    image: "",
    occupation: "",
    xp: 0,
    password_hash: "hash",
    is_admin: false,
    role: "point_operator",
    map_scope: "bonamoussadi",
    must_change_password: true,
    trust_score: 50,
    trust_tier: "standard",
    suspended_until: null,
    wipe_requested: false,
    failed_login_count: 0,
    locked_until: null,
    ...overrides,
  };
}

function pointOperatorProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "operator@example.com",
    email: "operator@example.com",
    phone: "+237600000000",
    name: "Operator",
    XP: 0,
    role: "point_operator",
    mapScope: "bonamoussadi",
    mustChangePassword: true,
    ...overrides,
  };
}

test("maps must_change_password when the migrated column is present", async () => {
  const persistence = createPostgresProfilePersistence(async () => ({
    rows: [profileRow()],
    rowCount: 1,
  }));

  const profile = await persistence.getUserProfile("operator@example.com");

  assert.equal(profile?.mustChangePassword, true);
});

test("falls back to false when must_change_password is missing but phone is present", async () => {
  const calls: QueryCall[] = [];
  const persistence = createPostgresProfilePersistence(async (text, values = []) => {
    calls.push({ text, values });
    if (calls.length === 1) throw missingColumn("must_change_password", "user_profiles");
    return { rows: [profileRow({ must_change_password: undefined })], rowCount: 1 };
  });

  const profile = await persistence.getUserProfile("operator@example.com");

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /phone/);
  assert.match(calls[0].text, /must_change_password/);
  assert.match(calls[1].text, /phone/);
  assert.doesNotMatch(calls[1].text, /must_change_password/);
  assert.equal(profile?.mustChangePassword, false);
});

test("supports profiles where both phone and must_change_password are missing", async () => {
  const calls: QueryCall[] = [];
  const persistence = createPostgresProfilePersistence(async (text, values = []) => {
    calls.push({ text, values });
    if (calls.length === 1) throw missingColumn("phone", "user_profiles");
    if (calls.length === 2) throw missingColumn("must_change_password");
    return {
      rows: [profileRow({ phone: undefined, must_change_password: undefined })],
      rowCount: 1,
    };
  });

  const profile = await persistence.getUserProfile("operator@example.com");

  assert.equal(calls.length, 3);
  assert.doesNotMatch(calls[1].text, /phone/);
  assert.match(calls[1].text, /must_change_password/);
  assert.doesNotMatch(calls[2].text, /phone/);
  assert.doesNotMatch(calls[2].text, /must_change_password/);
  assert.equal(profile?.phone, null);
  assert.equal(profile?.mustChangePassword, false);
});

test("does not swallow unrelated undefined-column errors", async () => {
  const persistence = createPostgresProfilePersistence(async () => {
    throw missingColumn("trust_score");
  });

  await assert.rejects(
    persistence.getUserProfile("operator@example.com"),
    /column "trust_score" does not exist/,
  );
});

test("serializes mustChangePassword in the migrated phone-aware upsert", async () => {
  const calls: QueryCall[] = [];
  const persistence = createPostgresProfilePersistence(async (text, values = []) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 1 };
  });

  await persistence.upsertUserProfile("operator@example.com", pointOperatorProfile());

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /phone/);
  assert.match(calls[0].text, /must_change_password/);
  assert.equal(calls[0].values[11], true);
  assert.equal(calls[0].values[12], 50);
  assert.equal(calls[0].values[13], "standard");
  assert.equal(calls[0].values.length, 18);
});

test("retries writes without must_change_password while preserving phone parameters", async () => {
  const calls: QueryCall[] = [];
  const persistence = createPostgresProfilePersistence(async (text, values = []) => {
    calls.push({ text, values });
    if (calls.length === 1) throw missingColumn("must_change_password", "user_profiles");
    return { rows: [], rowCount: 1 };
  });

  await persistence.upsertUserProfile("operator@example.com", pointOperatorProfile());

  assert.equal(calls.length, 2);
  assert.match(calls[1].text, /phone/);
  assert.doesNotMatch(calls[1].text, /must_change_password/);
  assert.equal(calls[1].values[2], "+237600000000");
  assert.equal(calls[1].values[11], 50);
  assert.equal(calls[1].values[12], "standard");
  assert.equal(calls[1].values.length, 17);
});

test("writes mustChangePassword through the legacy no-phone path when available", async () => {
  const calls: QueryCall[] = [];
  const persistence = createPostgresProfilePersistence(async (text, values = []) => {
    calls.push({ text, values });
    if (calls.length === 1) throw missingColumn("phone", "user_profiles");
    return { rows: [], rowCount: 1 };
  });

  await persistence.upsertUserProfile("operator@example.com", pointOperatorProfile());

  assert.equal(calls.length, 2);
  assert.doesNotMatch(calls[1].text, /\bphone\b/);
  assert.match(calls[1].text, /must_change_password/);
  assert.equal(calls[1].values[10], true);
  assert.equal(calls[1].values[11], 50);
  assert.equal(calls[1].values.length, 17);
});
