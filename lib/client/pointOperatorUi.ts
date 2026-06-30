import { Screen } from "../../types";
import type { PointOperatorSignalState, UserRole } from "../../shared/types";
import type { PointOperatorQueueItem } from "./pointOperatorQueue";

export function routesForRole(role: UserRole): Screen[] {
  if (role === "point_operator") {
    return [Screen.POINT_OPERATOR_STATUS, Screen.POINT_OPERATOR_PROFILE];
  }
  if (role === "admin") {
    return [
      Screen.ADMIN,
      Screen.HOME,
      Screen.DELTA_DASHBOARD,
      Screen.AGENT_PERFORMANCE,
      Screen.PROFILE,
    ];
  }
  if (role === "client") {
    return [
      Screen.DELTA_DASHBOARD,
      Screen.INVESTOR_DASHBOARD,
      Screen.HOME,
      Screen.CLIENT_INSIGHTS,
      Screen.PROFILE,
    ];
  }
  return [Screen.HOME, Screen.CONTRIBUTE, Screen.ANALYTICS, Screen.PROFILE];
}

export function defaultScreenForRole(role: UserRole): Screen {
  return routesForRole(role)[0] ?? Screen.HOME;
}

export function resolveOperatorSignalLabel(
  signal: Pick<PointOperatorSignalState, "isExpired" | "value"> | null | undefined,
): "on" | "off" | "unknown" {
  if (!signal || signal.isExpired || signal.value === null) return "unknown";
  return signal.value ? "on" : "off";
}

export interface PointOperatorQueueSummary {
  total: number;
  photos: number;
  signals: number;
  pending: number;
  syncing: number;
  failed: number;
  lastError: string;
}

export function summarizePointOperatorQueue(items: readonly PointOperatorQueueItem[]): PointOperatorQueueSummary {
  let photos = 0;
  let signals = 0;
  let pending = 0;
  let syncing = 0;
  let failed = 0;
  let lastError = "";

  for (const item of items) {
    if (item.mutation.kind === "photo") photos += 1;
    if (item.mutation.kind === "signal") signals += 1;
    if (item.status === "syncing") syncing += 1;
    else if (item.status === "failed") {
      failed += 1;
      if (item.lastError) lastError = item.lastError;
    } else {
      pending += 1;
    }
  }

  return {
    total: items.length,
    photos,
    signals,
    pending,
    syncing,
    failed,
    lastError,
  };
}
