import handler from "../../lib/server/auth/handler.js";
import { preflightResponse, applyCorsHeaders } from "../../lib/server/auth/cors.js";

export async function OPTIONS(request: Request): Promise<Response> {
  return preflightResponse(request);
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
