import { requireUser } from "../../lib/auth.js";
import { getSubmissions, setSubmissions } from "../../lib/edgeConfig.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { Submission } from "../../shared/types.js";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();

  if (!id) return errorResponse("Missing submission id", 400);

  const submissions = await getSubmissions();
  const submission = submissions.find((item) => item.id === id);
  if (!submission) return errorResponse("Submission not found", 404);

  return jsonResponse(submission, { status: 200 });
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();

  if (!id) return errorResponse("Missing submission id", 400);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const submissions = await getSubmissions();
  const submission = submissions.find((item) => item.id === id);
  if (!submission) return errorResponse("Submission not found", 404);

  if (submission.userId !== auth.id) {
    return errorResponse("Forbidden", 403);
  }

  if (body?.details && typeof body.details === "object") {
    submission.details = { ...submission.details, ...body.details };
  }

  await setSubmissions(submissions);
  return jsonResponse(submission, { status: 200 });
}
