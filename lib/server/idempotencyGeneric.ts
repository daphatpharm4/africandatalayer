import { query } from "./db.js";
import { classifyExistingReservation, hashIdempotencyPayload } from "./idempotencyCore.js";

// Re-exported for back-compat: callers import the hash helper from this module.
// Implementation now lives in the shared core (bd-m7o). `hashRequestPayload` is
// kept as an alias of the canonical name.
export { hashIdempotencyPayload };
export const hashRequestPayload = hashIdempotencyPayload;

interface StoredRow {
  requestHash: string;
  responseJson: unknown;
  /** 0 is the "reserved, not yet completed" sentinel. */
  responseStatus: number;
  createdAtMs: number;
}

export interface IdempotencyStore {
  find(scope: string, userId: string, key: string): Promise<StoredRow | null>;
  /** Insert a fresh reservation. Returns true iff this caller won the insert race. */
  insert(scope: string, userId: string, key: string, requestHash: string): Promise<boolean>;
  /** Reset an orphaned reservation so the current caller can take it over. */
  reclaim(scope: string, userId: string, key: string, requestHash: string): Promise<void>;
  complete(scope: string, userId: string, key: string, responseJson: unknown, responseStatus: number): Promise<void>;
}

export type IdempotencyResult =
  | { status: "reserved" } //   caller is the executor — proceed
  | { status: "in_flight" } //  a duplicate is executing right now — caller must NOT proceed
  | { status: "replay"; responseJson: unknown; responseStatus: number }
  | { status: "conflict" };

async function classify(
  store: IdempotencyStore,
  existing: StoredRow,
  input: { scope: string; userId: string; idempotencyKey: string; requestHash: string },
  now: number,
): Promise<IdempotencyResult> {
  const decision = classifyExistingReservation(
    { requestHash: existing.requestHash, hasResponse: existing.responseStatus !== 0, createdAtMs: existing.createdAtMs },
    input.requestHash,
    now,
  );
  switch (decision.kind) {
    case "conflict":
      return { status: "conflict" };
    case "in_flight":
      return { status: "in_flight" };
    case "reclaim":
      await store.reclaim(input.scope, input.userId, input.idempotencyKey, input.requestHash);
      return { status: "reserved" };
    case "replay":
      return { status: "replay", responseJson: existing.responseJson, responseStatus: existing.responseStatus };
  }
}

export async function resolveIdempotency(
  store: IdempotencyStore,
  input: { scope: string; userId: string; idempotencyKey: string; requestHash: string },
): Promise<IdempotencyResult> {
  const now = Date.now();

  const existing = await store.find(input.scope, input.userId, input.idempotencyKey);
  if (existing) return classify(store, existing, input, now);

  // No row yet: attempt the reservation. Only the caller that wins the insert
  // becomes the executor; concurrent losers re-read and are classified
  // (in_flight / replay / conflict) — single-flight (bd-ke3).
  const won = await store.insert(input.scope, input.userId, input.idempotencyKey, input.requestHash);
  if (won) return { status: "reserved" };

  const winner = await store.find(input.scope, input.userId, input.idempotencyKey);
  if (winner) return classify(store, winner, input, now);
  return { status: "reserved" };
}

/** Postgres-backed store over api_idempotency_keys. */
export const postgresIdempotencyStore: IdempotencyStore = {
  async find(scope, userId, key) {
    const res = await query<{
      request_hash: string;
      response_json: unknown;
      response_status: number;
      created_at: string;
    }>(
      `SELECT request_hash, response_json, response_status, created_at
       FROM api_idempotency_keys
       WHERE scope = $1 AND user_id = $2 AND idempotency_key = $3
       LIMIT 1`,
      [scope, userId, key],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      requestHash: row.request_hash,
      responseJson: row.response_json,
      responseStatus: Number(row.response_status ?? 0),
      createdAtMs: new Date(row.created_at).getTime(),
    };
  },
  async insert(scope, userId, key, requestHash) {
    const res = await query(
      `INSERT INTO api_idempotency_keys (scope, user_id, idempotency_key, request_hash, response_status)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (scope, user_id, idempotency_key) DO NOTHING`,
      [scope, userId, key, requestHash],
    );
    return res.rowCount === 1;
  },
  async reclaim(scope, userId, key, requestHash) {
    await query(
      `UPDATE api_idempotency_keys
       SET request_hash = $4, response_json = NULL, response_status = 0, created_at = NOW(), last_seen_at = NOW()
       WHERE scope = $1 AND user_id = $2 AND idempotency_key = $3`,
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
