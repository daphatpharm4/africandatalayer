const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

export function buildUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(buildUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      ...(init.headers ?? {}),
    },
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
