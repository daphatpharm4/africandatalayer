import assert from "node:assert/strict";
import test from "node:test";
import {
  RESET_TOKEN_TTL_MINUTES,
  buildResetLandingUrl,
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
} from "../lib/server/auth/passwordReset.js";
import { buildPasswordResetEmail } from "../lib/server/email/templates/passwordReset.js";

test("generateResetToken returns base64url token, matching hash, and ~30min expiry", () => {
  const issued = generateResetToken();
  assert.match(issued.token, /^[A-Za-z0-9_-]+$/);
  assert.equal(issued.tokenHash, hashResetToken(issued.token));
  const ttlMs = issued.expiresAt.getTime() - Date.now();
  assert.ok(ttlMs > (RESET_TOKEN_TTL_MINUTES - 1) * 60 * 1000);
  assert.ok(ttlMs <= RESET_TOKEN_TTL_MINUTES * 60 * 1000);
});

test("generateResetToken produces unique tokens across calls", () => {
  const a = generateResetToken();
  const b = generateResetToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.tokenHash, b.tokenHash);
});

test("isResetTokenValid rejects used tokens", () => {
  const record = {
    userId: "u1",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: new Date(),
  };
  assert.equal(isResetTokenValid(record), false);
});

test("isResetTokenValid rejects expired tokens", () => {
  const record = {
    userId: "u1",
    expiresAt: new Date(Date.now() - 60_000),
    usedAt: null,
  };
  assert.equal(isResetTokenValid(record), false);
});

test("isResetTokenValid accepts unused, unexpired tokens", () => {
  const record = {
    userId: "u1",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
  };
  assert.equal(isResetTokenValid(record), true);
});

test("buildResetLandingUrl encodes token and strips trailing slash", () => {
  assert.equal(
    buildResetLandingUrl("https://adl.example.com/", "abc/+="),
    "https://adl.example.com/reset?token=abc%2F%2B%3D",
  );
});

test("buildPasswordResetEmail renders English subject + link", () => {
  const email = buildPasswordResetEmail({
    resetUrl: "https://adl.example.com/reset?token=t",
    ttlMinutes: 30,
    language: "en",
  });
  assert.match(email.subject, /Reset/);
  assert.match(email.text, /https:\/\/adl\.example\.com\/reset\?token=t/);
  assert.match(email.html, /https:\/\/adl\.example\.com\/reset\?token=t/);
});

test("buildPasswordResetEmail renders French subject + link", () => {
  const email = buildPasswordResetEmail({
    resetUrl: "https://adl.example.com/reset?token=t",
    ttlMinutes: 30,
    language: "fr",
  });
  assert.match(email.subject, /Réinitialiser/);
  assert.match(email.text, /Réinitialiser/);
});

test("buildPasswordResetEmail HTML escapes URL with special chars", () => {
  const email = buildPasswordResetEmail({
    resetUrl: 'https://adl.example.com/reset?token=<script>"',
    ttlMinutes: 30,
    language: "en",
  });
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
});
