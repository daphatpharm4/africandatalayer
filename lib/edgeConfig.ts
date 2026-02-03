import { createClient } from "@vercel/edge-config";
import type { Submission, UserProfile } from "../shared/types.js";

type EdgeConfigClient = ReturnType<typeof createClient>;

const memoryStoreKey = "__edgeConfigStore";

function getMemoryStore(): Map<string, unknown> {
  const globalAny = globalThis as typeof globalThis & {
    __edgeConfigStore?: Map<string, unknown>;
  };
  if (!globalAny.__edgeConfigStore) {
    globalAny.__edgeConfigStore = new Map<string, unknown>();
  }
  return globalAny.__edgeConfigStore;
}

function getEdgeConfigId(): string | null {
  if (process.env.EDGE_CONFIG_ID) return process.env.EDGE_CONFIG_ID;
  const connection = process.env.EDGE_CONFIG ?? "";
  const match = connection.match(/ecfg_[A-Za-z0-9]+/);
  return match?.[0] ?? null;
}

function shouldUseRemote(): boolean {
  if (process.env.EDGE_CONFIG_FORCE === "true") return true;
  if (process.env.EDGE_CONFIG_FORCE === "false") return false;
  if (process.env.NODE_ENV === "production") return true;
  return Boolean(process.env.EDGE_CONFIG);
}

function getClient(): EdgeConfigClient | null {
  if (!shouldUseRemote()) return null;
  const connection = process.env.EDGE_CONFIG;
  if (!connection) return null;
  return createClient(connection);
}

async function readKey<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (client) {
    const value = await client.get<T>(key);
    return value ?? null;
  }
  const store = getMemoryStore();
  return (store.get(key) as T) ?? null;
}

async function writeKey(key: string, value: unknown): Promise<void> {
  const configId = getEdgeConfigId();
  const token = process.env.VERCEL_API_TOKEN;

  if (!shouldUseRemote()) {
    const store = getMemoryStore();
    store.set(key, value);
    return;
  }

  if (!configId || !token) {
    throw new Error("Edge Config write requires EDGE_CONFIG_ID and VERCEL_API_TOKEN");
  }

  const res = await fetch(`https://api.vercel.com/v1/edge-config/${configId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key, value }],
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Failed to update Edge Config: ${res.status} ${message}`);
  }
}

export async function getSubmissions(): Promise<Submission[]> {
  return (await readKey<Submission[]>("submissions")) ?? [];
}

export async function setSubmissions(data: Submission[]): Promise<void> {
  await writeKey("submissions", data);
}

function encodeKey(input: string): string {
  const normalized = input.trim().toLowerCase();
  return Buffer.from(normalized).toString("base64url");
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const key = `user_${encodeKey(userId)}`;
  return await readKey<UserProfile>(key);
}

export async function setUserProfile(userId: string, profile: UserProfile): Promise<void> {
  const key = `user_${encodeKey(userId)}`;
  await writeKey(key, profile);
}
