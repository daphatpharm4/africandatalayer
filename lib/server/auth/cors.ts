/**
 * Shared CORS helpers for auth API endpoints.
 *
 * Native Capacitor apps make cross-origin requests (WebView → Vercel API).
 * All auth routes need CORS headers so preflight checks pass.
 */

const ALLOWED_ORIGINS: readonly string[] = [
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
  "https://africandatalayer.vercel.app",
  "https://app.africandatalayer.com",
  "https://www.app.africandatalayer.com",
  "https://www.africandatalayer.com",
];

export function getCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = getCorsOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Idempotency-Key, X-Capacitor-Platform",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export function preflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function applyCorsHeaders(request: Request, response: Response): void {
  const origin = getCorsOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
}
