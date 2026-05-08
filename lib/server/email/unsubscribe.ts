import { query } from "../db.js";
import { logError } from "../logger.js";
import { suppressEmail } from "./provider.js";

export interface UnsubscribeRecipient {
  userId: string;
  email: string;
}

const HEADERS_HTML: HeadersInit = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlPage(title: string, body: string, status: number): Response {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; color: #0f2b46; }
      h1 { font-size: 22px; margin: 0 0 12px; }
      p  { font-size: 15px; line-height: 1.6; color: #4a5b70; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
    <p>${safeBody}</p>
  </body>
</html>`;
  return new Response(html, { status, headers: HEADERS_HTML });
}

export async function handleUnsubscribeRequest(token: string | null): Promise<Response> {
  if (!token) {
    return htmlPage(
      "Invalid unsubscribe link",
      "The unsubscribe token is missing or malformed. No changes were made.",
      400,
    );
  }
  try {
    const recipient = await findRecipientByUnsubscribeToken(token);
    if (!recipient) {
      return htmlPage(
        "Link expired or invalid",
        "We could not match this unsubscribe link to an account. No changes were made.",
        404,
      );
    }
    await applyUnsubscribe(recipient);
    return htmlPage(
      "You've been unsubscribed",
      "You will no longer receive marketing emails from African Data Layer. Transactional messages (account, security, payouts) will still be delivered.",
      200,
    );
  } catch (error) {
    logError("comms.unsubscribe_failed", { error: error instanceof Error ? error.message : "unknown" });
    return htmlPage(
      "Something went wrong",
      "We could not process your unsubscribe request. Please try again later or contact support.",
      500,
    );
  }
}

export async function readPostUnsubscribeToken(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const text = await req.text();
      const params = new URLSearchParams(text);
      return params.get("List-Unsubscribe") || params.get("token");
    } catch {
      return null;
    }
  }
  if (contentType.includes("application/json")) {
    try {
      const body = (await req.json()) as { token?: unknown };
      return typeof body.token === "string" ? body.token : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function findRecipientByUnsubscribeToken(
  token: string,
): Promise<UnsubscribeRecipient | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const result = await query<{ id: string; email: string }>(
    `SELECT id, email
     FROM public.user_profiles
     WHERE unsubscribe_token = $1
     LIMIT 1`,
    [trimmed],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.id, email: row.email };
}

export async function applyUnsubscribe(recipient: UnsubscribeRecipient): Promise<void> {
  await query(
    `UPDATE public.user_profiles
     SET email_opt_in = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [recipient.userId],
  );
  await suppressEmail(recipient.email, "unsubscribe", "user_action");
}

export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/comms/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildInternalUnsubscribeUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/privacy?view=unsubscribe&token=${encodeURIComponent(token)}`;
}
