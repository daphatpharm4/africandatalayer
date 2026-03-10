import { createHash } from "node:crypto";
import { query } from "./db.js";

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries.map(([key, entry]) => [key, stableSort(entry)]));
}

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableSort(payload))).digest("hex");
}

export async function reserveIdempotencyKey(input: {
  userId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<
  | { status: "reserved" }
  | { status: "replay"; eventId: string | null; responseStatus: number }
  | { status: "conflict" }
> {
  const existing = await query<{ request_hash: string; response_event_id: string | null; response_status: number }>(
    `SELECT request_hash, response_event_id::text, response_status
     FROM submission_idempotency_keys
     WHERE user_id = $1
       AND idempotency_key = $2
     LIMIT 1`,
    [input.userId, input.idempotencyKey],
  );

  const row = existing.rows[0];
  if (row) {
    if (row.request_hash !== input.requestHash) {
      return { status: "conflict" };
    }
    if (!row.response_event_id) {
      await query(
        `UPDATE submission_idempotency_keys
         SET last_seen_at = NOW()
         WHERE user_id = $1
           AND idempotency_key = $2`,
        [input.userId, input.idempotencyKey],
      );
      return { status: "reserved" };
    }
    return {
      status: "replay",
      eventId: row.response_event_id,
      responseStatus: Number(row.response_status ?? 201),
    };
  }

  await query(
    `INSERT INTO submission_idempotency_keys (user_id, idempotency_key, request_hash)
     VALUES ($1, $2, $3)`,
    [input.userId, input.idempotencyKey, input.requestHash],
  );
  return { status: "reserved" };
}

export async function completeIdempotencyKey(input: {
  userId: string;
  idempotencyKey: string;
  eventId: string;
  responseStatus?: number;
}): Promise<void> {
  await query(
    `UPDATE submission_idempotency_keys
     SET response_event_id = $3::uuid,
         response_status = $4,
         last_seen_at = NOW()
     WHERE user_id = $1
       AND idempotency_key = $2`,
    [input.userId, input.idempotencyKey, input.eventId, input.responseStatus ?? 201],
  );
}
