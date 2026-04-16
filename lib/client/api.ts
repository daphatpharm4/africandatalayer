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

  const url = buildUrl(path);
  const method = init.method ?? 'GET';
  if (path.startsWith('/api/auth')) {
    console.log('[API]', method, url);
  }

  try {
    const response = await fetch(url, {
      credentials: "include",
      ...init,
      headers,
    });
    if (path.startsWith('/api/auth')) {
      console.log('[API]', method, url, '→', response.status);
    }
    return response;
  } catch (error) {
    console.error('[API]', method, url, '→ NETWORK ERROR', error);
    throw error;
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    if (path.startsWith('/api/auth')) {
      console.error('[API] apiJson non-OK:', path, response.status, text.slice(0, 200));
    }
    throw new Error(text || "Request failed");
  }
  return (await response.json()) as T;
}
