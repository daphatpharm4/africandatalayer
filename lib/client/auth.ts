import { apiFetch, apiJson, buildUrl } from "./api";

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

export async function signInWithCredentials(email: string, password: string): Promise<void> {
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams();
  body.set("csrfToken", csrfToken);
  body.set("email", email);
  body.set("password", password);
  body.set("callbackUrl", window.location.origin);
  body.set("json", "true");

  const response = await apiFetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Invalid credentials");
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
    const message = await response.text();
    throw new Error(message || "Unable to sign out");
  }
}

export async function registerWithCredentials(email: string, password: string, name?: string): Promise<void> {
  const response = await apiFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to create account");
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
