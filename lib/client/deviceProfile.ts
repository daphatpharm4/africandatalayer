import type { ClientDeviceInfo } from "../../shared/types";

const DEVICE_ID_STORAGE_KEY = "adl_device_id";
let inMemoryDeviceId: string | null = null;

export interface DeviceHints {
  userAgent: string;
  platform: string;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  effectiveType: string | null;
  saveData: boolean | null;
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

function trimString(input: unknown, maxLen = 256): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function normalizeNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  return null;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `adl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readDeviceHints(): DeviceHints {
  if (typeof navigator === "undefined") {
    return {
      userAgent: "",
      platform: "",
      deviceMemoryGb: null,
      hardwareConcurrency: null,
      effectiveType: null,
      saveData: null,
    };
  }

  const nav = navigator as NavigatorWithHints;
  return {
    userAgent: nav.userAgent ?? "",
    platform: nav.platform ?? "",
    deviceMemoryGb: normalizeNumber(nav.deviceMemory),
    hardwareConcurrency: normalizeNumber(nav.hardwareConcurrency),
    effectiveType: trimString(nav.connection?.effectiveType, 20) ?? null,
    saveData: typeof nav.connection?.saveData === "boolean" ? nav.connection.saveData : null,
  };
}

export function detectLowEndFromHints(hints: DeviceHints): boolean {
  const ua = hints.userAgent.toLowerCase();
  const memoryLow = hints.deviceMemoryGb !== null && hints.deviceMemoryGb <= 2;
  const cpuLow = hints.hardwareConcurrency !== null && hints.hardwareConcurrency <= 4;
  const networkLow = hints.effectiveType === "slow-2g" || hints.effectiveType === "2g";
  const saveDataEnabled = hints.saveData === true;
  const userAgentLow =
    ua.includes("itel") || ua.includes("android go") || ua.includes("go edition") || ua.includes("infinix smart");
  if (userAgentLow || memoryLow || networkLow || saveDataEnabled) return true;

  const cpuOnlyLowSignal = cpuLow && hints.deviceMemoryGb === null && !ua.includes("android");
  if (cpuOnlyLowSignal) return false;

  return cpuLow;
}

export function detectLowEndDevice(): boolean {
  return detectLowEndFromHints(readDeviceHints());
}

export function getStableDeviceId(): string {
  if (inMemoryDeviceId) return inMemoryDeviceId;

  const storage = getStorage();
  if (storage) {
    try {
      const existing = storage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
      if (existing) {
        inMemoryDeviceId = existing;
        return existing;
      }
      const next = createDeviceId();
      storage.setItem(DEVICE_ID_STORAGE_KEY, next);
      inMemoryDeviceId = next;
      return next;
    } catch {
      // Fall back to in-memory ID when storage is unavailable.
    }
  }

  inMemoryDeviceId = createDeviceId();
  return inMemoryDeviceId;
}

export function getClientDeviceInfo(): ClientDeviceInfo {
  const hints = readDeviceHints();
  return {
    deviceId: getStableDeviceId(),
    platform: trimString(hints.platform, 64),
    userAgent: trimString(hints.userAgent, 256),
    deviceMemoryGb: hints.deviceMemoryGb,
    hardwareConcurrency: hints.hardwareConcurrency,
    isLowEnd: detectLowEndFromHints(hints),
  };
}
