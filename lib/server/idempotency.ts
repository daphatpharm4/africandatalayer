import { query } from "./db.js";
import { classifyExistingReservation, hashIdempotencyPayload, type ReservationSnapshot } from "./idempotencyCore.js";

// Re-exported for back-compat: callers historically imported the hash helper
// from this module. The implementation now lives in the shared core (bd-m7o).
export { hashIdempotencyPayload };

type ReservationRow = {
  request_hash: string;
  response_event_id: string | null;
  response_status: number;
  created_at: string;
};

export type ReserveResult =
  | { status: "reserved" } //   caller is the executor — proceed and create the event
  | { status: "in_flight" } //  a duplicate is executing right now — caller must NOT create
  | { status: "replay"; eventId: string | null; responseStatus: number }
  | { status: "conflict" };

function toSnapshot(row: ReservationRow): ReservationSnapshot {
  return {
    requestHash: row.request_hash,
    hasResponse: Boolean(row.response_event_id),
    createdAtMs: new Date(row.created_at).getTime(),
  };
}

async function reclaimReservation(userId: string, idempotencyKey: string, requestHash: string): Promise<void> {
  await query(
    `UPDATE submission_idempotency_keys
     SET request_hash = $3, response_event_id = NULL, response_status = 201, created_at = NOW(), last_seen_at = NOW()
     WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, idempotencyKey, requestHash],
  );
}

async function classifyExisting(
  row: ReservationRow,
  input: { userId: string; idempotencyKey: string; requestHash: string },
  now: number,
): Promise<ReserveResult> {
  const decision = classifyExistingReservation(toSnapshot(row), input.requestHash, now);
  switch (decision.kind) {
    case "conflict":
      return { status: "conflict" };
    case "in_flight":
      // Touch last_seen_at so monitoring can see retries pile up behind the live request.
      await query(
        `UPDATE submission_idempotency_keys SET last_seen_at = NOW() WHERE user_id = $1 AND idempotency_key = $2`,
        [input.userId, input.idempotencyKey],
      );
      return { status: "in_flight" };
    case "reclaim":
      await reclaimReservation(input.userId, input.idempotencyKey, input.requestHash);
      return { status: "reserved" };
    case "replay":
      return {
        status: "replay",
        eventId: row.response_event_id,
        responseStatus: Number(row.response_status ?? 201),
      };
  }
}

async function findReservation(userId: string, idempotencyKey: string): Promise<ReservationRow | undefined> {
  const res = await query<ReservationRow>(
    `SELECT request_hash, response_event_id::text, response_status, created_at
     FROM submission_idempotency_keys
     WHERE user_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [userId, idempotencyKey],
  );
  return res.rows[0];
}

export async function reserveIdempotencyKey(input: {
  userId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<ReserveResult> {
  const now = Date.now();

  const existing = await findReservation(input.userId, input.idempotencyKey);
  if (existing) return classifyExisting(existing, input, now);

  // No row yet: insert atomically. ON CONFLICT DO NOTHING makes concurrent
  // duplicate inserts return 0 rows instead of throwing a UNIQUE violation.
  // The single row that inserts (rowCount === 1) is the executor; everyone else
  // re-reads and is classified (in_flight / replay / conflict) — single-flight.
  const inserted = await query(
    `INSERT INTO submission_idempotency_keys (user_id, idempotency_key, request_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
    [input.userId, input.idempotencyKey, input.requestHash],
  );
  if (inserted.rowCount === 1) return { status: "reserved" };

  // Lost the insert race — another request won. Re-read and classify against it.
  const winner = await findReservation(input.userId, input.idempotencyKey);
  if (winner) return classifyExisting(winner, input, now);
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
