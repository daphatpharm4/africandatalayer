import { apiFetch, apiJson, buildUrl } from "./api";
import { normalizeIdentifier } from "../shared/identifier";
import { looksLikeHtml, sanitizeErrorMessage } from "./errorUtils";

export interface AuthSession {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin?: boolean;
  };
  expires?: string;
}

export interface SignInWithCredentialsOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
}

export type AuthClientErrorCode =
  | "invalid_credentials"
  | "callback_error"
  | "configuration_error"
  | "access_denied"
  | "auth_unavailable"
  | "storage_unavailable"
  | "registration_conflict"
  | "validation_error"
  | "request_error"
  | "unknown_error";

export class AuthClientError extends Error {
  code: AuthClientErrorCode;
  retryable: boolean;

  constructor(
    code: AuthClientErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "AuthClientError";
    this.code = code;
    this.retryable = Boolean(options.retryable);
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

type AuthRedirectPayload = {
  url?: unknown;
};

const DEFAULT_SIGN_IN_ERROR = "Unable to sign in. Please try again.";
const DEFAULT_SIGN_OUT_ERROR = "Unable to sign out";
const DEFAULT_SIGN_UP_ERROR = "Unable to create account";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAttempts(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value as number));
}

function normalizeDelayMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return 500;
  return Math.max(0, Math.floor(value as number));
}


async function safeReadJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type ApiErrorPayload = {
  message: string;
  code?: string;
};

async function extractResponseErrorPayload(response: Response, fallback: string): Promise<ApiErrorPayload> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    const payload = await safeReadJson<{ error?: unknown; message?: unknown; code?: unknown }>(response);
    if (payload) {
      const message = sanitizeErrorMessage(payload.error ?? payload.message, fallback);
      const code = typeof payload.code === "string" && payload.code.trim() ? payload.code.trim() : undefined;
      return { message, code };
    }
    return { message: fallback };
  }
  const text = await response.text().catch(() => "");
  return { message: sanitizeErrorMessage(text, fallback) };
}

function mapAuthJsError(errorType: string | null, errorCode: string | null): AuthClientError {
  switch (errorType) {
    case "CredentialsSignin":
      return new AuthClientError("invalid_credentials", "Invalid phone/email or password.", { retryable: true });
    case "Callback":
    case "CallbackRouteError":
      return new AuthClientError("callback_error", DEFAULT_SIGN_IN_ERROR, { retryable: true });
    case "Configuration":
      return new AuthClientError("configuration_error", DEFAULT_SIGN_IN_ERROR, { retryable: true });
    case "AccessDenied":
      return new AuthClientError("access_denied", "Access denied for this account.");
    default:
      if (errorCode === "credentials") {
        return new AuthClientError("invalid_credentials", "Invalid phone/email or password.", { retryable: true });
      }
      return new AuthClientError("unknown_error", DEFAULT_SIGN_IN_ERROR, { retryable: true });
  }
}

function toAuthClientError(error: unknown, fallback: string): AuthClientError {
  if (error instanceof AuthClientError) return error;
  if (error instanceof Error) {
    return new AuthClientError("unknown_error", sanitizeErrorMessage(error.message, fallback), { cause: error });
  }
  return new AuthClientError("unknown_error", fallback);
}

async function getCsrfToken(): Promise<string> {
  const data = await apiJson<{ csrfToken: string }>("/api/auth/csrf");
  return data.csrfToken;
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const session = await apiJson<AuthSession>("/api/auth/session");
    if (session?.user) return session;
    return null;
  } catch {
    return null;
  }
}

async function signInWithCredentialsOnce(identifier: string, password: string): Promise<void> {
  const normalizedIdentifier = normalizeIdentifier(identifier)?.value ?? identifier.trim();
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams();
  body.set("csrfToken", csrfToken);
  body.set("identifier", normalizedIdentifier);
  body.set("email", normalizedIdentifier);
  body.set("password", password);
  body.set("callbackUrl", window.location.origin);
  body.set("json", "true");

  const response = await apiFetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body,
  });

  if (!response.ok) {
    const { message } = await extractResponseErrorPayload(response, DEFAULT_SIGN_IN_ERROR);
    const retryable = response.status >= 500;
    throw new AuthClientError(retryable ? "auth_unavailable" : "request_error", message, { retryable });
  }

  const payload = await safeReadJson<AuthRedirectPayload>(response);
  if (!payload || typeof payload.url !== "string") {
    throw new AuthClientError("unknown_error", DEFAULT_SIGN_IN_ERROR, { retryable: true });
  }

  let url: URL;
  try {
    url = new URL(payload.url, window.location.origin);
  } catch {
    throw new AuthClientError("unknown_error", DEFAULT_SIGN_IN_ERROR, { retryable: true });
  }

  const errorType = url.searchParams.get("error");
  const errorCode = url.searchParams.get("code");
  if (errorType || errorCode) {
    throw mapAuthJsError(errorType, errorCode);
  }
}

export async function signInWithCredentials(
  identifier: string,
  password: string,
  options: SignInWithCredentialsOptions = {}
): Promise<void> {
  const maxAttempts = normalizeAttempts(options.maxAttempts);
  const retryDelayMs = normalizeDelayMs(options.retryDelayMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await signInWithCredentialsOnce(identifier, password);
      return;
    } catch (error) {
      const authError = toAuthClientError(error, DEFAULT_SIGN_IN_ERROR);
      const shouldRetry = authError.retryable && attempt < maxAttempts;
      if (!shouldRetry) throw authError;
      await delay(retryDelayMs);
    }
  }
}

export async function signOut(): Promise<void> {
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams();
  body.set("csrfToken", csrfToken);
  body.set("callbackUrl", window.location.origin);
  body.set("json", "true");

  const response = await apiFetch("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const { message } = await extractResponseErrorPayload(response, DEFAULT_SIGN_OUT_ERROR);
    const retryable = response.status >= 500;
    throw new AuthClientError(retryable ? "auth_unavailable" : "request_error", message, { retryable });
  }
}

export async function registerWithCredentials(identifier: string, password: string, name?: string): Promise<void> {
  const normalizedIdentifier = normalizeIdentifier(identifier)?.value ?? identifier.trim();
  const response = await apiFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: normalizedIdentifier, email: normalizedIdentifier, password, name }),
  });

  if (!response.ok) {
    const { message, code } = await extractResponseErrorPayload(response, DEFAULT_SIGN_UP_ERROR);
    if (response.status === 409) {
      throw new AuthClientError("registration_conflict", message);
    }
    if (response.status === 400) {
      throw new AuthClientError("validation_error", message);
    }
    if (response.status === 503 && code === "storage_unavailable") {
      throw new AuthClientError("storage_unavailable", message, { retryable: true });
    }
    const retryable = response.status >= 500;
    throw new AuthClientError(retryable ? "auth_unavailable" : "request_error", message, { retryable });
  }
}

export async function signInWithGoogle(): Promise<void> {
  const csrfToken = await getCsrfToken();
  const form = document.createElement("form");
  form.method = "POST";
  form.action = buildUrl("/api/auth/signin/google");
  form.style.display = "none";

  const addField = (name: string, value: string) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  addField("csrfToken", csrfToken);
  addField("callbackUrl", window.location.origin);

  document.body.appendChild(form);
  form.submit();
}
