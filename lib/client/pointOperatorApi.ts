import type {
  PointOperatorMeResponse,
  PointOperatorSignalState,
  ProjectedPoint,
} from "../../shared/types";
import { apiFetch } from "./api";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const PERMANENT_STATUS_CODES = new Set([401, 403, 409, 422]);

export type PointOperatorMutationResult = {
  eventId: string;
  point?: ProjectedPoint;
  signal?: PointOperatorSignalState;
};

export class PointOperatorApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PointOperatorApiError";
    this.status = status;
    this.retryable = !PERMANENT_STATUS_CODES.has(status);
  }
}

function idempotencyHeaders(idempotencyKey: string): Record<string, string> {
  return {
    ...JSON_HEADERS,
    "Idempotency-Key": idempotencyKey,
  };
}

async function pointOperatorJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new PointOperatorApiError(bodyText || response.statusText || "Request failed", response.status);
  }

  return JSON.parse(bodyText) as T;
}

export async function fetchPointOperatorMe(): Promise<PointOperatorMeResponse> {
  return pointOperatorJson<PointOperatorMeResponse>("/api/user?view=po_me");
}

export async function submitPointOperatorSignal(
  payload: { field: string; value: boolean; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResult> {
  return pointOperatorJson<PointOperatorMutationResult>("/api/user?view=po_status", {
    method: "POST",
    headers: idempotencyHeaders(options.idempotencyKey),
    body: JSON.stringify(payload),
  });
}

export async function submitPointOperatorPhoto(
  payload: { imageData: string; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResult> {
  return pointOperatorJson<PointOperatorMutationResult>("/api/user?view=po_photo", {
    method: "POST",
    headers: idempotencyHeaders(options.idempotencyKey),
    body: JSON.stringify(payload),
  });
}

export async function changePointOperatorPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ changed: true; reauthenticate: true }> {
  return pointOperatorJson<{ changed: true; reauthenticate: true }>("/api/user?view=po_password", {
    method: "POST",
    headers: idempotencyHeaders(crypto.randomUUID()),
    body: JSON.stringify(payload),
  });
}
