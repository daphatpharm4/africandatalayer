import { agentAssignments } from "./shared";
import type { MockApiResolver } from "./types";

export const resolveAgentApi: MockApiResolver = (url, method) => {
  if (method !== "GET") return null;

  if (url.pathname === "/api/user" && url.searchParams.get("view") === "assignments") {
    return { body: agentAssignments };
  }

  return null;
};
