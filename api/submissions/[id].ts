import { requireUser } from "../../lib/auth.js";
import { getSubmissions, setSubmissions } from "../../lib/edgeConfig.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { Submission } from "../../shared/types.js";

const INLINE_PHOTO_PREFIX = "data:image/";
const MAX_EDGE_CONFIG_SUBMISSIONS_BYTES =
  Number(process.env.MAX_EDGE_CONFIG_SUBMISSIONS_BYTES ?? "1800000") || 1800000;

function stripInlinePhotoData(submission: Submission): Submission {
  if (typeof submission.photoUrl !== "string" || !submission.photoUrl.startsWith(INLINE_PHOTO_PREFIX)) {
    return submission;
  }
  const { photoUrl: _photoUrl, ...rest } = submission;
  const details = { ...(submission.details ?? {}), hasPhoto: true };
  return { ...rest, details };
}

function estimateJsonBytes(input: unknown): number {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}

function compactSubmissionsForStorage(submissions: Submission[]): Submission[] {
  if (estimateJsonBytes(submissions) <= MAX_EDGE_CONFIG_SUBMISSIONS_BYTES) return submissions;
  const sorted = [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  while (sorted.length > 0 && estimateJsonBytes(sorted) > MAX_EDGE_CONFIG_SUBMISSIONS_BYTES) {
    sorted.pop();
  }
  return sorted;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();

  if (!id) return errorResponse("Missing submission id", 400);

  const submissions = (await getSubmissions()).map(stripInlinePhotoData);
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

  const submissions = (await getSubmissions()).map(stripInlinePhotoData);
  const submission = submissions.find((item) => item.id === id);
  if (!submission) return errorResponse("Submission not found", 404);

  if (submission.userId !== auth.id) {
    return errorResponse("Forbidden", 403);
  }

  if (body?.details && typeof body.details === "object") {
    submission.details = { ...submission.details, ...body.details };
  }

  await setSubmissions(compactSubmissionsForStorage(submissions));
  return jsonResponse(submission, { status: 200 });
}
