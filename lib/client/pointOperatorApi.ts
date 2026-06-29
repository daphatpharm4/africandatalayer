import type { PointOperatorMeResponse, PointOperatorMutationResponse } from "../../shared/types";
import { apiJson } from "./api";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function idempotencyHeaders(idempotencyKey: string): Record<string, string> {
  return {
    ...JSON_HEADERS,
    "Idempotency-Key": idempotencyKey,
  };
}

export async function fetchPointOperatorMe(): Promise<PointOperatorMeResponse> {
  return apiJson<PointOperatorMeResponse>("/api/user?view=po_me");
}

export async function submitPointOperatorSignal(
  payload: { field: string; value: boolean; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResponse> {
  return apiJson<PointOperatorMutationResponse>("/api/user?view=po_status", {
    method: "POST",
    headers: idempotencyHeaders(options.idempotencyKey),
    body: JSON.stringify(payload),
  });
}

export async function submitPointOperatorPhoto(
  payload: { imageData: string; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResponse> {
  return apiJson<PointOperatorMutationResponse>("/api/user?view=po_photo", {
    method: "POST",
    headers: idempotencyHeaders(options.idempotencyKey),
    body: JSON.stringify(payload),
  });
}

export async function changePointOperatorPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ changed: true; reauthenticate: true }> {
  return apiJson<{ changed: true; reauthenticate: true }>("/api/user?view=po_password", {
    method: "POST",
    headers: idempotencyHeaders(crypto.randomUUID()),
    body: JSON.stringify(payload),
  });
}
