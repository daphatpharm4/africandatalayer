import { handleAnalyticsCronDispatchRequest } from "../analytics/index.js";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return handleAnalyticsCronDispatchRequest(request);
}
