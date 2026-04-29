import type { Page, Route } from '@playwright/test';
import { resolveAdminApi } from '../mocks/admin';
import { resolveAgentApi } from '../mocks/agent';
import { resolveClientApi } from '../mocks/client';
import {
  adminProfile,
  agentProfile,
  clientProfile,
  leaderboard,
  pointEvents,
  projectedPoints,
} from '../mocks/shared';
import type { UserRole } from '../../shared/types';
import type { MockApiResponse, MockApiResolver } from '../mocks/types';
import { getMockSession, type AdlRole, type MockAuthSession } from './roles';

const BLANK_TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pN96mQAAAAASUVORK5CYII=',
  'base64',
);

const TILE_URL_PATTERN =
  /https:\/\/[a-z]\.basemaps\.cartocdn\.com\/light_all\/.+/i;
const GOOGLE_FONT_CSS_PATTERN = /https:\/\/fonts\.googleapis\.com\/.+/i;
const GOOGLE_FONT_FILE_PATTERN = /https:\/\/fonts\.gstatic\.com\/.+/i;

const COMMON_RESOLVERS: MockApiResolver[] = [
  (url, method) => {
    if (method !== 'GET') return null;

    if (url.pathname === '/api/submissions' && !url.searchParams.get('view')) {
      return { body: projectedPoints };
    }

    if (
      url.pathname === '/api/submissions' &&
      url.searchParams.get('view') === 'events'
    ) {
      return { body: pointEvents };
    }

    if (url.pathname === '/api/leaderboard') {
      return { body: leaderboard };
    }

    if (
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'status'
    ) {
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

type InstallAdlMockOptions = {
  initialSession?: MockAuthSession | null;
  enableCredentialAuth?: boolean;
};

function toRoutePayload(response: MockApiResponse) {
  const status = response.status ?? 200;
  const headers = { ...(response.headers ?? {}) };
  const contentType = response.contentType ?? 'application/json';

  if (!headers['content-type']) {
    headers['content-type'] = contentType;
  }

  if (contentType === 'application/json') {
    return {
      status,
      headers,
      body: JSON.stringify(response.body ?? {}),
    };
  }

  return {
    status,
    headers,
    body:
      typeof response.body === 'string' || Buffer.isBuffer(response.body)
        ? response.body
        : '',
  };
}

function resolveApiRequest(
  role: AdlRole,
  url: URL,
  method: string,
): MockApiResponse | null {
  if (
    method === 'GET' &&
    url.pathname === '/api/user' &&
    !url.searchParams.get('view')
  ) {
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

async function fulfillRoute(
  route: Route,
  response: MockApiResponse,
): Promise<void> {
  await route.fulfill(toRoutePayload(response));
}

export async function installAdlMocks(
  page: Page,
  role: AdlRole,
  options: InstallAdlMockOptions = {},
): Promise<void> {
  await page.unroute('**/api/**');
  await page.unroute(TILE_URL_PATTERN);
  await page.unroute(GOOGLE_FONT_CSS_PATTERN);
  await page.unroute(GOOGLE_FONT_FILE_PATTERN);

  let currentSession: MockAuthSession | null =
    options.initialSession !== undefined
      ? options.initialSession
      : getMockSession(role);
  const knownCredentials = new Map<string, string>([
    [agentProfile.email ?? agentProfile.id, 'Password123!'],
    [adminProfile.email ?? adminProfile.id, 'Password123!'],
    [clientProfile.email ?? clientProfile.id, 'Password123!'],
  ]);
  const knownNames = new Map<string, string>([
    [agentProfile.email ?? agentProfile.id, agentProfile.name],
    [adminProfile.email ?? adminProfile.id, adminProfile.name],
    [clientProfile.email ?? clientProfile.id, clientProfile.name],
  ]);

  await page.route(TILE_URL_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: BLANK_TILE_PNG,
    });
  });
  await page.route(GOOGLE_FONT_CSS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: '',
    });
  });
  await page.route(GOOGLE_FONT_FILE_PATTERN, async (route) => {
    await route.fulfill({
      status: 204,
      body: '',
    });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.pathname === '/api/auth/session') {
      await fulfillRoute(route, { body: currentSession ?? {} });
      return;
    }

    if (url.pathname === '/api/auth/csrf') {
      await fulfillRoute(route, {
        body: { csrfToken: 'playwright-csrf-token' },
      });
      return;
    }

    if (
      options.enableCredentialAuth &&
      url.pathname === '/api/auth/register' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as {
        identifier?: string;
        email?: string;
        password?: string;
        name?: string;
      };
      const identifier = String(
        payload.identifier ?? payload.email ?? '',
      ).trim();

      if (knownCredentials.has(identifier)) {
        await fulfillRoute(route, {
          status: 409,
          body: { error: 'An account already exists for this phone/email' },
        });
        return;
      }

      knownCredentials.set(identifier, String(payload.password ?? ''));
      knownNames.set(
        identifier,
        String(payload.name ?? 'New field account').trim() ||
          'New field account',
      );
      await fulfillRoute(route, { status: 201, body: { ok: true } });
      return;
    }

    if (
      role === 'admin' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'account_create' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as {
        identifier?: string;
        name?: string;
        role?: UserRole;
        password?: string;
      };
      const identifier = String(payload.identifier ?? '').trim().toLowerCase();
      const accountRole: UserRole =
        payload.role === 'admin' || payload.role === 'agent' || payload.role === 'client'
          ? payload.role
          : 'client';
      const name = String(payload.name ?? '').trim() || 'New client account';

      if (!identifier || knownCredentials.has(identifier)) {
        await fulfillRoute(route, {
          status: identifier ? 409 : 400,
          body: {
            error: identifier
              ? 'An account already exists for this phone/email'
              : 'Enter a valid email or phone number',
          },
        });
        return;
      }

      knownCredentials.set(identifier, String(payload.password ?? ''));
      knownNames.set(identifier, name);
      await fulfillRoute(route, {
        status: 201,
        body: {
          id: identifier,
          name,
          email: identifier.includes('@') ? identifier : null,
          phone: identifier.startsWith('+') ? identifier : null,
          image: 'baobab',
          avatarPreset: 'baobab',
          occupation: accountRole === 'client' ? 'Client stakeholder' : '',
          XP: 0,
          isAdmin: accountRole === 'admin',
          role: accountRole,
          mapScope: accountRole === 'admin' ? 'global' : 'bonamoussadi',
          trustScore: 50,
          trustTier: 'standard',
          suspendedUntil: null,
          wipeRequested: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      return;
    }

    if (
      options.enableCredentialAuth &&
      url.pathname === '/api/auth/callback/credentials' &&
      method === 'POST'
    ) {
      const body = new URLSearchParams(request.postData() ?? '');
      const identifier = String(
        body.get('identifier') ?? body.get('email') ?? '',
      ).trim();
      const password = String(body.get('password') ?? '');
      const isValid =
        Boolean(identifier) && knownCredentials.get(identifier) === password;

      if (!isValid) {
        await fulfillRoute(route, {
          body: {
            url: 'http://127.0.0.1:4173/auth?error=CredentialsSignin&code=credentials',
          },
        });
        return;
      }

      const baseSession = getMockSession(role);
      currentSession = {
        ...baseSession,
        user: {
          ...baseSession.user,
          id: identifier,
          email: identifier,
          name: knownNames.get(identifier) ?? baseSession.user.name,
        },
      };

      await fulfillRoute(route, { body: { url: 'http://127.0.0.1:4173/' } });
      return;
    }

    if (
      options.enableCredentialAuth &&
      url.pathname === '/api/auth/signout' &&
      method === 'POST'
    ) {
      currentSession = null;
      await fulfillRoute(route, { body: { url: 'http://127.0.0.1:4173/' } });
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
