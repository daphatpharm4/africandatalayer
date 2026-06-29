import { Screen } from "../../types";
import type { PointOperatorSignalState, UserRole } from "../../shared/types";

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
