import type { Page, Route } from "@playwright/test";
import { resolveAdminApi } from "../mocks/admin";
import { resolveAgentApi } from "../mocks/agent";
import { resolveClientApi } from "../mocks/client";
import { adminProfile, agentProfile, clientProfile, leaderboard, pointEvents, projectedPoints } from "../mocks/shared";
import type { MockApiResponse, MockApiResolver } from "../mocks/types";
import { getMockSession, type AdlRole } from "./roles";

const BLANK_TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pN96mQAAAAASUVORK5CYII=",
  "base64",
);

const TILE_URL_PATTERN = /https:\/\/[a-z]\.basemaps\.cartocdn\.com\/light_all\/.+/i;

const COMMON_RESOLVERS: MockApiResolver[] = [
  (url, method) => {
    if (method !== "GET") return null;

    if (url.pathname === "/api/submissions" && !url.searchParams.get("view")) {
      return { body: projectedPoints };
    }

    if (url.pathname === "/api/submissions" && url.searchParams.get("view") === "events") {
      return { body: pointEvents };
    }

    if (url.pathname === "/api/leaderboard") {
      return { body: leaderboard };
    }

    if (url.pathname === "/api/user" && url.searchParams.get("view") === "status") {
      return {
        body: {
          wipeRequested: false,
          suspendedUntil: null,
        },
      };
    }

    return null;
  },
];

const ROLE_PROFILES = {
  agent: agentProfile,
  admin: adminProfile,
  client: clientProfile,
} as const;

function toRoutePayload(response: MockApiResponse) {
  const status = response.status ?? 200;
  const headers = { ...(response.headers ?? {}) };
  const contentType = response.contentType ?? "application/json";

  if (!headers["content-type"]) {
    headers["content-type"] = contentType;
  }

  if (contentType === "application/json") {
    return {
      status,
      headers,
      body: JSON.stringify(response.body ?? {}),
    };
  }

  return {
    status,
    headers,
    body: typeof response.body === "string" || Buffer.isBuffer(response.body) ? response.body : "",
  };
}

function resolveApiRequest(role: AdlRole, url: URL, method: string): MockApiResponse | null {
  if (method === "GET" && url.pathname === "/api/user" && !url.searchParams.get("view")) {
    return { body: ROLE_PROFILES[role] };
  }

  const resolvers: MockApiResolver[] = [
    ...COMMON_RESOLVERS,
    resolveAgentApi,
    resolveAdminApi,
    resolveClientApi,
  ];

  for (const resolver of resolvers) {
    const result = resolver(url, method);
    if (result) return result;
  }

  return null;
}

async function fulfillRoute(route: Route, response: MockApiResponse): Promise<void> {
  await route.fulfill(toRoutePayload(response));
}

export async function installAdlMocks(page: Page, role: AdlRole): Promise<void> {
  await page.route(TILE_URL_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: BLANK_TILE_PNG,
    });
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.pathname === "/api/auth/session") {
      await fulfillRoute(route, { body: getMockSession(role) });
      return;
    }

    if (url.pathname === "/api/auth/csrf") {
      await fulfillRoute(route, { body: { csrfToken: "playwright-csrf-token" } });
      return;
    }

    const resolved = resolveApiRequest(role, url, method);
    if (resolved) {
      await fulfillRoute(route, resolved);
      return;
    }

    await fulfillRoute(route, {
      status: 404,
      body: {
        error: `No Playwright mock defined for ${method} ${url.pathname}${url.search}`,
      },
    });
  });
}
