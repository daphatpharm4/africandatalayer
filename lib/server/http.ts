import { createHash } from "node:crypto";

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(
  message: string,
  status: number,
  options: { code?: string; retryAfterSeconds?: number } = {},
): Response {
  const body: { error: string; code?: string } = { error: message };
  if (options.code) body.code = options.code;
  const headers = new Headers();
  if (typeof options.retryAfterSeconds === "number" && options.retryAfterSeconds > 0) {
    headers.set("retry-after", String(Math.ceil(options.retryAfterSeconds)));
  }
  return jsonResponse(body, { status, headers });
}

export function computeWeakEtag(body: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 32);
  return `W/"${digest}"`;
}

export interface CachedJsonOptions {
  sMaxAge: number;
  staleWhileRevalidate?: number;
  etag?: string;
  ifNoneMatch?: string | null;
  status?: number;
}

export function cachedJsonResponse(body: unknown, options: CachedJsonOptions): Response {
  const parts = ["public", `s-maxage=${options.sMaxAge}`];
  if (options.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  const headers = new Headers({ "cache-control": parts.join(", ") });
  if (options.etag) headers.set("etag", options.etag);

  if (options.etag && options.ifNoneMatch && options.ifNoneMatch === options.etag) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status: options.status ?? 200, headers });
}
