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

export function errorResponse(message: string, status: number, options: { code?: string } = {}): Response {
  const body: { error: string; code?: string } = { error: message };
  if (options.code) body.code = options.code;
  return jsonResponse(body, { status });
}
