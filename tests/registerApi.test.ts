import assert from "node:assert/strict";
import test from "node:test";
import { createRegisterHandler } from "../api/auth/register.js";

function makeRegisterRequest(body: unknown, ip = "203.0.113.10"): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

test("POST /api/auth/register returns 429 when IP rate limit is exceeded", async () => {
  const handler = createRegisterHandler({
    consumeRateLimitFn: async ({ route }) => ({
      allowed: route.endsWith(":ip") ? false : true,
      remaining: 0,
      retryAfterSeconds: 300,
      count: 21,
    }),
  });

  const response = await handler(makeRegisterRequest({ identifier: "agent@example.com", password: "Password123!" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "300");
  const body = (await response.json()) as { code?: string };
  assert.equal(body.code, "rate_limited");
});

test("POST /api/auth/register returns 409 when the identifier already exists", async () => {
  const handler = createRegisterHandler({
    consumeRateLimitFn: async () => ({
      allowed: true,
      remaining: 10,
      retryAfterSeconds: 60,
      count: 1,
    }),
    getUserProfileFn: async () => ({
      id: "agent@example.com",
      name: "Existing Agent",
      email: "agent@example.com",
      XP: 0,
    }),
  });

  const response = await handler(makeRegisterRequest({ identifier: "agent@example.com", password: "Password123!" }));
  assert.equal(response.status, 409);
});

test("POST /api/auth/register creates a new user when rate limits allow it", async () => {
  let savedProfile: { id: string; passwordHash?: string | null } | null = null;
  const handler = createRegisterHandler({
    consumeRateLimitFn: async () => ({
      allowed: true,
      remaining: 10,
      retryAfterSeconds: 60,
      count: 1,
    }),
    getUserProfileFn: async () => null,
    hashPasswordFn: async (password) => `hashed:${password}`,
    upsertUserProfileFn: async (id, profile) => {
      savedProfile = { id, passwordHash: profile.passwordHash };
    },
  });

  const response = await handler(
    makeRegisterRequest({ identifier: "new.agent@example.com", password: "Password123!", name: "New Agent" }),
  );
  assert.equal(response.status, 201);
  assert.deepEqual(savedProfile, {
    id: "new.agent@example.com",
    passwordHash: "hashed:Password123!",
  });
});
