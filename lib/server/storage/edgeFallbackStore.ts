import { getPointEvents, getSubmissions, getUserProfile } from "../../edgeConfig.js";
import type { StorageReadFallback } from "./types.js";

export const edgeFallbackStore: StorageReadFallback = {
  getUserProfile,
  getPointEvents,
  getLegacySubmissions: getSubmissions,
};
