import handler from "../../lib/server/auth/handler.js";
import { preflightResponse, applyCorsHeaders } from "../../lib/server/auth/cors.js";
import { logInfo } from "../../lib/server/logger.js";

export async function OPTIONS(request: Request): Promise<Response> {
  const response = preflightResponse(request);
  logInfo("auth.preflight", {
    path: new URL(request.url).pathname,
    origin: request.headers.get("origin"),
    status: response.status,
  });
  return response;
}

export async function GET(request: Request): Promise<Response> {
  const response = await handler(request);
  applyCorsHeaders(request, response);
  return response;
}

export async function POST(request: Request): Promise<Response> {
  const response = await handler(request);
  applyCorsHeaders(request, response);
  return response;
}
