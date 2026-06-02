import { createHash } from "node:crypto";

/**
 * Single source of truth for idempotency semantics, shared by both the
 * submission store (submission_idempotency_keys, event-id sentinel) and the
 * generic API store (api_idempotency_keys, response-json sentinel).
 *
 * Previously these two modules diverged: different conflict rules, different
 * orphan handling, and neither enforced single-flight. This core unifies them.
 *
 * The classifier is a pure function (no DB) so it is exhaustively unit-tested.
 * Table I/O and the concrete response payload (event id vs JSON) stay in each
 * store adapter; the *decision* is made here.
 */

/**
 * A reservation whose work never completed past this age is treated as orphaned
 * — the original request crashed between reserve and complete — so a retry may
 * reclaim it instead of being wedged forever. 2 minutes is well past the 30s
 * function timeout. Overridable via IDEMPOTENCY_RESERVATION_TTL_MS.
 */
export const DEFAULT_RESERVATION_TTL_MS =
  Number(process.env.IDEMPOTENCY_RESERVATION_TTL_MS ?? "120000") || 120000;

export interface ReservationSnapshot {
  /** Hash of the request body the existing reservation was created with. */
  requestHash: string;
  /** True once the original request stored its response (completed). */
  hasResponse: boolean;
  /** When the reservation row was created (epoch ms). */
  createdAtMs: number;
}

export type IdempotencyDecision =
  | { kind: "replay" } //     completed before — caller returns the stored response
  | { kind: "in_flight" } //  duplicate currently executing — caller must NOT proceed
  | { kind: "conflict" } //   same key, different body — reject
  | { kind: "reclaim" }; //   orphaned reservation — caller takes over and proceeds

/**
 * Classify an EXISTING reservation row (the caller already lost or skipped the
 * insert race). A caller that wins the insert proceeds directly as the executor
 * and never calls this. Therefore "reserved" is not a possible outcome here.
 */
export function classifyExistingReservation(
  existing: ReservationSnapshot,
  requestHash: string,
  now: number,
  ttlMs: number = DEFAULT_RESERVATION_TTL_MS,
): IdempotencyDecision {
  const orphaned = !existing.hasResponse && now - existing.createdAtMs >= ttlMs;

  if (existing.requestHash !== requestHash) {
    // Mismatched body. Only safe to take over if the prior reservation orphaned.
    return orphaned ? { kind: "reclaim" } : { kind: "conflict" };
  }

  if (existing.hasResponse) return { kind: "replay" };

  // Same body, no response yet: either a live duplicate (block it) or a crashed
  // reservation we may reclaim.
  return orphaned ? { kind: "reclaim" } : { kind: "in_flight" };
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries.map(([key, entry]) => [key, stableSort(entry)]));
}

/** Canonical, order-insensitive hash of a request body. Shared by both stores. */
export function hashIdempotencyPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableSort(payload))).digest("hex");
}

const IDEMPOTENCY_HEADER_NAMES = ["idempotency-key", "x-idempotency-key"];

/**
 * Read the idempotency key from either the standard `Idempotency-Key` header or
 * the legacy `x-idempotency-key` alias the submissions endpoint historically
 * used. Unifies the header contract across endpoints (bd-m7o).
 */
export function readIdempotencyKey(headers: Headers, maxLength = 160): string | null {
  for (const name of IDEMPOTENCY_HEADER_NAMES) {
    const raw = headers.get(name);
    const trimmed = raw?.trim();
    if (trimmed) return trimmed.slice(0, maxLength);
  }
  return null;
}
