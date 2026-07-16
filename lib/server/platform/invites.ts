// lib/server/platform/invites.ts
// Invite token generation (only hashes are stored) and bilingual invite email.
import { createHash, randomBytes } from "node:crypto";
import { sendTransactional } from "../email/provider.js";

export const INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashInviteToken(token) };
}

export interface InviteEmailInput {
  orgName: string;
  role: string;
  joinUrl: string;
  invitedBy: string;
}

export function buildInviteEmail(input: InviteEmailInput): { subject: string; html: string; text: string } {
  const subject = `You're invited to join ${input.orgName} / Invitation à rejoindre ${input.orgName}`;
  const text = [
    `${input.invitedBy} invited you to join ${input.orgName} as ${input.role} on the ADL Data Operations Platform.`,
    `Accept the invitation: ${input.joinUrl}`,
    `This link expires in ${INVITE_TTL_DAYS} days.`,
    ``,
    `${input.invitedBy} vous a invité à rejoindre ${input.orgName} en tant que ${input.role} sur la plateforme ADL Data Operations.`,
    `Accepter l'invitation : ${input.joinUrl}`,
    `Ce lien expire dans ${INVITE_TTL_DAYS} jours.`,
  ].join("\n");
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #0f2b46;">
      <h2 style="color: #0f2b46;">${escapeHtml(input.orgName)}</h2>
      <p>${escapeHtml(input.invitedBy)} invited you to join <strong>${escapeHtml(input.orgName)}</strong>
        as <strong>${escapeHtml(input.role)}</strong> on the ADL Data Operations Platform.</p>
      <p><a href="${input.joinUrl}" style="display:inline-block;padding:12px 24px;background:#0f2b46;color:#ffffff;border-radius:12px;text-decoration:none;">Accept invitation</a></p>
      <hr style="border:none;border-top:1px solid #e3ebf2;margin:24px 0;" />
      <p>${escapeHtml(input.invitedBy)} vous a invité à rejoindre <strong>${escapeHtml(input.orgName)}</strong>
        en tant que <strong>${escapeHtml(input.role)}</strong>.</p>
      <p><a href="${input.joinUrl}" style="display:inline-block;padding:12px 24px;background:#c86b4a;color:#ffffff;border-radius:12px;text-decoration:none;">Accepter l'invitation</a></p>
      <p style="color:#5a708a;font-size:13px;">This link expires in ${INVITE_TTL_DAYS} days. / Ce lien expire dans ${INVITE_TTL_DAYS} jours.</p>
    </div>`;
  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SendInviteDeps {
  sendFn?: typeof sendTransactional;
}

export async function sendInviteEmail(
  input: InviteEmailInput & { email: string; idempotencyKey: string },
  deps: SendInviteDeps = {},
): Promise<void> {
  const sendFn = deps.sendFn ?? sendTransactional;
  const email = buildInviteEmail(input);
  await sendFn({
    recipient: { email: input.email, userId: null },
    templateId: "platform_org_invite",
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: input.idempotencyKey,
    emailClass: "transactional",
  });
}
