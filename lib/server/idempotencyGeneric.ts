import { createHash } from "node:crypto";
import { query } from "./db.js";

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries.map(([key, entry]) => [key, stableSort(entry)]));
}

export function hashRequestPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableSort(payload))).digest("hex");
}

interface StoredRow {
  requestHash: string;
  responseJson: unknown;
  responseStatus: number;
}

export interface IdempotencyStore {
  find(scope: string, userId: string, key: string): Promise<StoredRow | null>;
  insert(scope: string, userId: string, key: string, requestHash: string): Promise<void>;
  complete(scope: string, userId: string, key: string, responseJson: unknown, responseStatus: number): Promise<void>;
}

export type IdempotencyResult =
  | { status: "reserved" }
  | { status: "replay"; responseJson: unknown; responseStatus: number }
  | { status: "conflict" };

export async function resolveIdempotency(
  store: IdempotencyStore,
  input: { scope: string; userId: string; idempotencyKey: string; requestHash: string },
): Promise<IdempotencyResult> {
  const existing = await store.find(input.scope, input.userId, input.idempotencyKey);
  if (existing) {
    if (existing.requestHash !== input.requestHash) return { status: "conflict" };
    if (existing.responseStatus === 0) return { status: "reserved" };
    return { status: "replay", responseJson: existing.responseJson, responseStatus: existing.responseStatus };
  }
  await store.insert(input.scope, input.userId, input.idempotencyKey, input.requestHash);
  return { status: "reserved" };
}

/** Postgres-backed store over api_idempotency_keys. */
export const postgresIdempotencyStore: IdempotencyStore = {
  async find(scope, userId, key) {
    const res = await query<{ request_hash: string; response_json: unknown; response_status: number }>(
      `SELECT request_hash, response_json, response_status
       FROM api_idempotency_keys
       WHERE scope = $1 AND user_id = $2 AND idempotency_key = $3
       LIMIT 1`,
      [scope, userId, key],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { requestHash: row.request_hash, responseJson: row.response_json, responseStatus: Number(row.response_status ?? 0) };
  },
  async insert(scope, userId, key, requestHash) {
    await query(
      `INSERT INTO api_idempotency_keys (scope, user_id, idempotency_key, request_hash, response_status)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (scope, user_id, idempotency_key) DO NOTHING`,
      [scope, userId, key, requestHash],
    );
  },
  async complete(scope, userId, key, responseJson, responseStatus) {
    await query(
      `UPDATE api_idempotency_keys
       SET response_json = $4::jsonb, response_status = $5, last_seen_at = NOW()
       WHERE scope = $1 AND user_id = $2 AND idempotency_key = $3`,
      [scope, userId, key, JSON.stringify(responseJson ?? null), responseStatus],
    );
  },
};
