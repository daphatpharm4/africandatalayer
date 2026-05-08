import { applyUnsubscribe, findRecipientByUnsubscribeToken } from "../../lib/server/email/unsubscribe.js";
import { logError } from "../../lib/server/logger.js";

const HEADERS_HTML: HeadersInit = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

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

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function unsubscribeByToken(token: string | null): Promise<Response> {
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

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return unsubscribeByToken(token);
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");

  if (!token) {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const text = await req.text();
        const params = new URLSearchParams(text);
        token = params.get("List-Unsubscribe") || params.get("token");
      } catch {
        token = null;
      }
    } else if (contentType.includes("application/json")) {
      try {
        const body = (await req.json()) as { token?: unknown };
        token = typeof body.token === "string" ? body.token : null;
      } catch {
        token = null;
      }
    }
  }

  return unsubscribeByToken(token);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") return GET(req);
  if (req.method === "POST") return POST(req);
  return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
}
