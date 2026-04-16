import handler from "../../lib/server/auth/handler.js";
import { preflightResponse, applyCorsHeaders } from "../../lib/server/auth/cors.js";
import { logInfo } from "../../lib/server/logger.js";

function logAuthResponse(request: Request, response: Response): void {
  const pathname = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url || "";
    }
  })();

  logInfo("auth.request", {
    method: request.method,
    path: pathname,
    origin: request.headers.get("origin"),
    host: request.headers.get("host") ?? request.headers.get("x-forwarded-host"),
    status: response.status,
  });
}

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
  logAuthResponse(request, response);
  return response;
}

export async function POST(request: Request): Promise<Response> {
  const response = await handler(request);
  applyCorsHeaders(request, response);
  logAuthResponse(request, response);
  return response;
}
