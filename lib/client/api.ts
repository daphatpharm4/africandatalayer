import { getApiBase, isNative, getPlatform } from './native';

const API_BASE = getApiBase();
const PERMANENT_STATUS_CODES = new Set([401, 403, 409, 422]);

export class ApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = !PERMANENT_STATUS_CODES.has(status);
  }
}

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
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const bodyText = await response.text();

  if (!response.ok) {
    if (path.startsWith('/api/auth')) {
      console.error('[API] apiJson non-OK:', path, response.status, bodyText.slice(0, 200));
    }
    throw new ApiError(bodyText || response.statusText || "Request failed", response.status);
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch (error) {
    const preview = bodyText.slice(0, 200);
    const receivedHtml =
      contentType.includes('text/html') ||
      /^<!doctype html/i.test(bodyText) ||
      /^<html/i.test(bodyText);

    if (path.startsWith('/api/auth')) {
      console.error('[API] apiJson parse failed:', {
        path,
        contentType: contentType || '(missing)',
        bodyPreview: preview,
      });
    }

    if (receivedHtml) {
      const wrapped = new Error(
        `Expected JSON from ${path} but received HTML. This usually means the request hit the SPA fallback instead of the API route.`,
      );
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }

    if (!contentType.includes('application/json')) {
      const wrapped = new Error(
        `Expected JSON from ${path} but received ${contentType || 'a non-JSON response'}.`,
      );
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }

    throw error;
  }
}
