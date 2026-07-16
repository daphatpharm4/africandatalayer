import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildInviteEmail, createInviteToken, hashInviteToken, sendInviteEmail } from "../lib/server/platform/invites.js";

test("createInviteToken returns 64-hex token and matching sha256 hash", () => {
  const { token, tokenHash } = createInviteToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(hashInviteToken(token), tokenHash);
});

test("tokens are unique across calls", () => {
  assert.notEqual(createInviteToken().token, createInviteToken().token);
});

test("invite email is bilingual and contains join link", () => {
  const email = buildInviteEmail({
    orgName: "Acme Waste", role: "collector",
    joinUrl: "https://console.example.com/join?token=abc", invitedBy: "owner@acme.com",
  });
  assert.match(email.subject, /Acme Waste/);
  assert.match(email.html, /https:\/\/console\.example\.com\/join\?token=abc/);
  assert.match(email.text, /https:\/\/console\.example\.com\/join\?token=abc/);
  assert.match(email.html, /invit/i);   // EN "invited" / FR "invité"
  assert.match(email.text, /rejoindre/i); // FR present
});

test("sendInviteEmail delegates to transactional provider with idempotency key", async () => {
  const sent: any[] = [];
  await sendInviteEmail(
    {
      email: "new@example.com", orgName: "Acme", role: "collector",
      joinUrl: "https://x.test/join?token=t", invitedBy: "boss@acme.com",
      idempotencyKey: "invite-inv-1",
    },
    { sendFn: async (params) => { sent.push(params); return { status: "sent", providerMessageId: "m1" }; } },
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient.email, "new@example.com");
  assert.equal(sent[0].idempotencyKey, "invite-inv-1");
  assert.equal(sent[0].emailClass, "transactional");
});
