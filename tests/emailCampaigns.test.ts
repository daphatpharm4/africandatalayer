import assert from "node:assert/strict";
import test from "node:test";
import { audienceSchema, campaignCreateSchema } from "../lib/server/email/campaigns.js";

test("audienceSchema accepts empty filter", () => {
  const parsed = audienceSchema.parse({});
  assert.deepEqual(parsed, {});
});

test("audienceSchema validates roles enum", () => {
  const ok = audienceSchema.safeParse({ roles: ["agent", "admin"] });
  assert.equal(ok.success, true);
  const bad = audienceSchema.safeParse({ roles: ["superuser"] });
  assert.equal(bad.success, false);
});

test("audienceSchema rejects non-positive lastActiveDays", () => {
  const bad = audienceSchema.safeParse({ lastActiveDays: 0 });
  assert.equal(bad.success, false);
  const negative = audienceSchema.safeParse({ lastActiveDays: -3 });
  assert.equal(negative.success, false);
  const ok = audienceSchema.safeParse({ lastActiveDays: 30 });
  assert.equal(ok.success, true);
});

test("audienceSchema validates trustTiers enum", () => {
  const ok = audienceSchema.safeParse({ trustTiers: ["new", "trusted", "elite"] });
  assert.equal(ok.success, true);
  const bad = audienceSchema.safeParse({ trustTiers: ["gold"] });
  assert.equal(bad.success, false);
});

test("campaignCreateSchema requires subject and bodies", () => {
  const bad = campaignCreateSchema.safeParse({ subject: "", htmlBody: "x", textBody: "y" });
  assert.equal(bad.success, false);
});

test("campaignCreateSchema accepts language en/fr only", () => {
  const en = campaignCreateSchema.safeParse({
    subject: "Hi",
    htmlBody: "<p>Hi</p>",
    textBody: "Hi",
    language: "en",
    audience: {},
  });
  assert.equal(en.success, true);
  const fr = campaignCreateSchema.safeParse({
    subject: "Salut",
    htmlBody: "<p>Salut</p>",
    textBody: "Salut",
    language: "fr",
    audience: {},
  });
  assert.equal(fr.success, true);
  const es = campaignCreateSchema.safeParse({
    subject: "Hola",
    htmlBody: "<p>Hola</p>",
    textBody: "Hola",
    language: "es",
    audience: {},
  });
  assert.equal(es.success, false);
});

test("campaignCreateSchema defaults language to en when omitted", () => {
  const result = campaignCreateSchema.parse({
    subject: "Hi",
    htmlBody: "<p>Hi</p>",
    textBody: "Hi",
  });
  assert.equal(result.language, "en");
});

test("campaignCreateSchema accepts dryRun flag", () => {
  const result = campaignCreateSchema.parse({
    subject: "Hi",
    htmlBody: "<p>Hi</p>",
    textBody: "Hi",
    dryRun: true,
  });
  assert.equal(result.dryRun, true);
});
