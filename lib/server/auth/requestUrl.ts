function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

function normalizeProtocol(value: string | null, fallback: "http" | "https"): "http" | "https" {
  const normalized = value?.trim().replace(/:$/, "").toLowerCase();
  if (normalized === "http" || normalized === "https") return normalized;
  return fallback;
}

export function resolveAuthRequestBaseUrl(
  headers: Headers,
  options: {
    fallbackUrl?: string;
    defaultProtocol?: "http" | "https";
  } = {}
): string {
  if (options.fallbackUrl?.trim()) {
    return options.fallbackUrl.trim();
  }

  const host = firstHeaderValue(headers.get("x-forwarded-host")) ?? firstHeaderValue(headers.get("host"));
  if (host) {
    const protocol = normalizeProtocol(
      firstHeaderValue(headers.get("x-forwarded-proto")),
      options.defaultProtocol ?? "https"
    );
    return `${protocol}://${host}`;
  }

  return options.fallbackUrl?.trim() || "http://localhost:3000";
}

export async function withAbsoluteUrl(request: Request, fallbackUrl: string): Promise<Request> {
  try {
    new URL(request.url);
    return request;
  } catch {
    const base = resolveAuthRequestBaseUrl(request.headers, {
      fallbackUrl,
      defaultProtocol: process.env.NODE_ENV === "production" ? "https" : "http",
    });
    const url = new URL(request.url || "/", base);
    const method = request.method ?? "GET";
    const init: RequestInit = {
      method,
      headers: request.headers,
      redirect: request.redirect,
    };
    if (method !== "GET" && method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }
    return new Request(url, init);
  }
}
