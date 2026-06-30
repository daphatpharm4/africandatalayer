import type {
  PointOperatorMeResponse,
  PointOperatorMutationResponse,
} from "../../shared/types";
import { apiJson } from "./api";
import { compactPointOperatorPhotoDataUrl } from "./pointOperatorPhoto";

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
  const mutation = await apiJson<{ eventId: string }>("/api/user?view=po_status", {
    method: "POST",
    headers: idempotencyHeaders(options.idempotencyKey),
    body: JSON.stringify(payload),
  });
  const me = await fetchPointOperatorMe();
  return {
    eventId: mutation.eventId,
    point: me.point,
    signal: me.signals[payload.field],
  };
}

export async function submitPointOperatorPhoto(
  payload: { imageData: string; capturedAt: string },
  options: { idempotencyKey: string },
): Promise<PointOperatorMutationResponse> {
  const uploadPayload = {
    ...payload,
    imageData: await compactPointOperatorPhotoDataUrl(payload.imageData),
  };
  const mutation = await apiJson<{ eventId: string }>("/api/user?view=po_photo", {
    method: "POST",
    headers: idempotencyHeaders(options.idempotencyKey),
    body: JSON.stringify(uploadPayload),
  });
  const me = await fetchPointOperatorMe();
  return {
    eventId: mutation.eventId,
    point: me.point,
  };
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
