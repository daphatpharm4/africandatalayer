import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { captureServerException, initServerSentry } from "../lib/server/sentry.ts";
import { GET as healthGet } from "../api/health/index.ts";

const ORIGINAL_DSN = process.env.SENTRY_DSN;
const ORIGINAL_CRON = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_DSN === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = ORIGINAL_DSN;
  if (ORIGINAL_CRON === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_CRON;
});

test("captureServerException is a resolved no-op returning false when SENTRY_DSN is unset", async () => {
  delete process.env.SENTRY_DSN;
  const result = await captureServerException(new Error("boom"), { route: "unit" });
  assert.equal(result, false);
});

test("initServerSentry (cold-start hook) is a safe no-op when SENTRY_DSN is unset", () => {
  delete process.env.SENTRY_DSN;
  // Runs at module load in every serverless function; must never throw or load the
  // SDK when the DSN is absent.
  assert.doesNotThrow(() => initServerSentry());
});

function sentryTestRequest(bearer?: string): Request {
  const headers = new Headers();
  if (bearer !== undefined) headers.set("authorization", `Bearer ${bearer}`);
  return new Request("https://example.test/api/health?view=sentry-test", { method: "GET", headers });
}

test("sentry-test trigger requires the CRON_SECRET bearer", async () => {
  process.env.CRON_SECRET = "cron-secret";
  const noHeader = await healthGet(sentryTestRequest());
  assert.equal(noHeader.status, 401);
  const wrong = await healthGet(sentryTestRequest("nope"));
  assert.equal(wrong.status, 401);
});

test("sentry-test trigger is unauthorized when CRON_SECRET is not configured", async () => {
  delete process.env.CRON_SECRET;
  const res = await healthGet(sentryTestRequest("anything"));
  assert.equal(res.status, 401);
});

test("sentry-test reports no delivery and emits a marker when SENTRY_DSN is unset", async () => {
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.SENTRY_DSN;
  const res = await healthGet(sentryTestRequest("cron-secret"));
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    ok: boolean;
    dsnConfigured: boolean;
    captured: boolean;
    marker: string;
  };
  assert.equal(body.ok, true);
  assert.equal(body.dsnConfigured, false);
  assert.equal(body.captured, false);
  assert.match(body.marker, /^sentry-test-\d+-[a-z0-9]+$/);
});
