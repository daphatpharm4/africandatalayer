import { getApiBase, isNative, getPlatform } from './native';

const API_BASE = getApiBase();

export function buildUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> ?? {}),
  };

  // Only auth routes need the native platform hint for cookie/CSRF handling.
  // Adding it to every native request forces a CORS preflight that breaks
  // simple public reads like GET /api/submissions in the iOS app.
  if (isNative() && path.startsWith("/api/auth")) {
    headers['X-Capacitor-Platform'] = getPlatform();
  }
  return fetch(buildUrl(path), {
    credentials: "include",
    ...init,
    headers,
  });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  return (await response.json()) as T;
}
