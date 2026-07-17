import type { Page, Route } from '@playwright/test';
import { resolveAdminApi } from '../mocks/admin';
import { resolveAgentApi } from '../mocks/agent';
import { resolveClientApi } from '../mocks/client';
import {
  adminProfile,
  agentProfile,
  clientProfile,
  leaderboard,
  NOW_ISO,
  PLACEHOLDER_IMAGE_DATA_URL,
  pointEvents,
  projectedPoints,
} from '../mocks/shared';
import type {
  PointOperatorAssignment,
  PointOperatorControlDefinition,
  PointOperatorSignalState,
  ProjectedPoint,
  UserProfile,
  UserRole,
} from '../../shared/types';
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

const pointOperatorProfile: UserProfile = {
  id: 'operator@example.com',
  name: 'Market Operator',
  email: 'operator@example.com',
  phone: null,
  image: 'baobab',
  avatarPreset: 'baobab',
  occupation: 'Point operator',
  XP: 0,
  isAdmin: false,
  role: 'point_operator',
  mapScope: 'bonamoussadi',
  trustScore: 50,
  trustTier: 'standard',
  suspendedUntil: null,
  wipeRequested: false,
  failedLoginCount: 0,
  lockedUntil: null,
  mustChangePassword: false,
};

const marketPharmacyPoint: ProjectedPoint = {
  id: 'projected-pharmacy-market',
  pointId: 'pt-pharmacy-market',
  category: 'pharmacy',
  location: { latitude: 4.0879, longitude: 9.7402 },
  details: {
    name: 'Pharmacie du Marché',
    siteName: 'Pharmacie du Marché',
    openingHours: '08:00-22:00',
    isOpenNow: true,
    isOnDuty: false,
    hasEssentialMedicinesAvailable: true,
    confidenceScore: 94,
    lastSeenAt: NOW_ISO,
    hasPhoto: true,
    reviewerApproved: true,
  },
  photoUrl: PLACEHOLDER_IMAGE_DATA_URL,
  createdAt: '2026-04-01T08:00:00.000Z',
  updatedAt: NOW_ISO,
  gaps: ['phone'],
  eventsCount: 5,
  eventIds: ['event-market-001', 'event-market-002'],
};

const pointOperatorControls: PointOperatorControlDefinition[] = [
  { field: 'isOpenNow', labelEn: 'Open now', labelFr: 'Ouvert maintenant', expiryHours: 6 },
  { field: 'isOnDuty', labelEn: 'On guard', labelFr: 'De garde', expiryHours: 12 },
  {
    field: 'hasEssentialMedicinesAvailable',
    labelEn: 'Essential medicines available',
    labelFr: 'Médicaments essentiels disponibles',
    expiryHours: 24,
  },
];

function activePointOperatorAssignment(): PointOperatorAssignment {
  return {
    id: 'po-assignment-market',
    operatorUserId: pointOperatorProfile.id,
    pointId: marketPharmacyPoint.pointId,
    status: 'active',
    grantedBy: adminProfile.id,
    grantedAt: '2026-04-11T07:30:00.000Z',
    revokedBy: null,
    revokedAt: null,
    revokeReason: null,
  };
}

function initialPointOperatorSignals(): Record<string, PointOperatorSignalState> {
  return {
    isOpenNow: {
      field: 'isOpenNow',
      value: true,
      reportedBy: 'point_operator',
      reportedAt: '2026-04-11T08:45:00.000Z',
      expiresAt: '2026-04-11T14:45:00.000Z',
      isExpired: false,
      eventId: 'po-signal-open',
      reviewState: 'auto_approved',
    },
    isOnDuty: {
      field: 'isOnDuty',
      value: null,
      reportedBy: 'point_operator',
      reportedAt: '2026-04-10T20:00:00.000Z',
      expiresAt: '2026-04-11T08:00:00.000Z',
      isExpired: true,
      eventId: 'po-signal-duty-expired',
      reviewState: 'pending_review',
    },
    hasEssentialMedicinesAvailable: {
      field: 'hasEssentialMedicinesAvailable',
      value: true,
      reportedBy: 'point_operator',
      reportedAt: '2026-04-11T08:30:00.000Z',
      expiresAt: '2026-04-12T08:30:00.000Z',
      isExpired: false,
      eventId: 'po-signal-meds',
      reviewState: 'pending_review',
    },
  };
}

function pointName(point: ProjectedPoint): string {
  const details = (point.details ?? {}) as Record<string, unknown>;
  return (
    (typeof details.name === 'string' && details.name.trim()) ||
    (typeof details.siteName === 'string' && details.siteName.trim()) ||
    point.pointId
  );
}

const publicProjectedPoints: ProjectedPoint[] = [
  {
    ...marketPharmacyPoint,
    operatorSignals: initialPointOperatorSignals(),
  },
  ...projectedPoints,
];

const COMMON_RESOLVERS: MockApiResolver[] = [
  (url, method) => {
    if (method !== 'GET') return null;

    if (url.pathname === '/api/submissions' && !url.searchParams.get('view')) {
      return { body: publicProjectedPoints };
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
  point_operator: pointOperatorProfile,
} as const;

type InstallAdlMockOptions = {
  initialSession?: MockAuthSession | null;
  enableCredentialAuth?: boolean;
  pointOperatorRevoked?: boolean;
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
    url.searchParams.get('view') === 'platform_org_list'
  ) {
    return { body: { organizations: [] } };
  }

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
    [pointOperatorProfile.email ?? pointOperatorProfile.id, 'OperatorPass123!'],
  ]);
  const knownNames = new Map<string, string>([
    [agentProfile.email ?? agentProfile.id, agentProfile.name],
    [adminProfile.email ?? adminProfile.id, adminProfile.name],
    [clientProfile.email ?? clientProfile.id, clientProfile.name],
    [pointOperatorProfile.email ?? pointOperatorProfile.id, pointOperatorProfile.name],
  ]);
  let pointOperatorAssignment = activePointOperatorAssignment();
  if (options.pointOperatorRevoked) {
    pointOperatorAssignment = {
      ...pointOperatorAssignment,
      status: 'revoked',
      revokedBy: adminProfile.id,
      revokedAt: '2026-04-11T10:00:00.000Z',
      revokeReason: 'Operator left the market stall',
    };
  }
  let pointOperatorSignals = initialPointOperatorSignals();
  let pointOperatorPoint: ProjectedPoint = {
    ...marketPharmacyPoint,
    operatorSignals: pointOperatorSignals,
  };

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
      role === 'admin' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_admin_search_points' &&
      method === 'GET'
    ) {
      const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const points = [marketPharmacyPoint, ...projectedPoints].filter((point) => {
        if (!query) return true;
        return pointName(point).toLowerCase().includes(query) || point.pointId.toLowerCase().includes(query);
      });
      await fulfillRoute(route, { body: { points } });
      return;
    }

    if (
      role === 'admin' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_admin_create' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as {
        identifier?: string;
        name?: string;
        password?: string;
        pointId?: string;
      };
      const identifier = String(payload.identifier ?? '').trim().toLowerCase();
      const name = String(payload.name ?? '').trim() || 'Point Operator';
      const pointId = String(payload.pointId ?? '').trim();

      if (!identifier || !pointId) {
        await fulfillRoute(route, {
          status: 422,
          body: { error: 'Enter operator details and select a verified point' },
        });
        return;
      }
      if (knownCredentials.has(identifier)) {
        await fulfillRoute(route, {
          status: 409,
          body: { error: 'An account already exists for this phone/email' },
        });
        return;
      }
      if (
        pointOperatorAssignment.status === 'active' &&
        pointOperatorAssignment.pointId === pointId
      ) {
        await fulfillRoute(route, {
          status: 409,
          body: { error: 'Point already has an active operator' },
        });
        return;
      }

      knownCredentials.set(identifier, String(payload.password ?? ''));
      knownNames.set(identifier, name);
      pointOperatorAssignment = {
        id: `po-assignment-${identifier.replace(/[^a-z0-9]/gi, '-')}`,
        operatorUserId: identifier,
        pointId,
        status: 'active',
        grantedBy: adminProfile.id,
        grantedAt: NOW_ISO,
        revokedBy: null,
        revokedAt: null,
        revokeReason: null,
      };
      await fulfillRoute(route, {
        status: 201,
        body: {
          assignment: pointOperatorAssignment,
          events: [
            {
              id: 'mock-po-grant',
              label: 'Operator linked',
              at: NOW_ISO,
              detail: pointName(marketPharmacyPoint),
            },
          ],
        },
      });
      return;
    }

    if (
      role === 'admin' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_admin_assignment' &&
      method === 'GET'
    ) {
      const operatorUserId = (url.searchParams.get('operatorUserId') ?? '').trim().toLowerCase();
      const assignment =
        pointOperatorAssignment.status === 'active' &&
        pointOperatorAssignment.operatorUserId.toLowerCase() === operatorUserId
          ? pointOperatorAssignment
          : null;
      await fulfillRoute(route, {
        body: {
          assignment,
          events: assignment
            ? [
                {
                  id: 'mock-po-load',
                  label: 'Active assignment loaded',
                  at: assignment.grantedAt,
                  detail: assignment.pointId,
                },
              ]
            : [],
        },
      });
      return;
    }

    if (
      role === 'admin' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_admin_revoke' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as { operatorUserId?: string; reason?: string };
      const reason = String(payload.reason ?? '').trim();
      if (reason.length < 3) {
        await fulfillRoute(route, {
          status: 422,
          body: { error: 'Revocation reason is required' },
        });
        return;
      }
      pointOperatorAssignment = {
        ...pointOperatorAssignment,
        status: 'revoked',
        revokedBy: adminProfile.id,
        revokedAt: NOW_ISO,
        revokeReason: reason,
      };
      await fulfillRoute(route, {
        body: {
          assignment: pointOperatorAssignment,
          events: [
            {
              id: 'mock-po-revoke',
              label: 'Operator revoked',
              at: NOW_ISO,
              detail: reason,
            },
          ],
        },
      });
      return;
    }

    if (
      role === 'point_operator' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_me' &&
      method === 'GET'
    ) {
      if (pointOperatorAssignment.status !== 'active') {
        await fulfillRoute(route, {
          status: 403,
          body: { error: 'No active point operator assignment found' },
        });
        return;
      }
      await fulfillRoute(route, {
        body: {
          assignment: pointOperatorAssignment,
          point: pointOperatorPoint,
          controls: pointOperatorControls,
          signals: pointOperatorSignals,
        },
      });
      return;
    }

    if (
      role === 'point_operator' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_status' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as { field?: string; value?: boolean; capturedAt?: string };
      const field = String(payload.field ?? '');
      const capturedAt = String(payload.capturedAt ?? NOW_ISO);
      const control = pointOperatorControls.find((entry) => entry.field === field);
      if (!control || typeof payload.value !== 'boolean') {
        await fulfillRoute(route, {
          status: 422,
          body: { error: 'Invalid point operator signal' },
        });
        return;
      }
      const signal: PointOperatorSignalState = {
        field,
        value: payload.value,
        reportedBy: 'point_operator',
        reportedAt: capturedAt,
        expiresAt: new Date(new Date(capturedAt).getTime() + control.expiryHours * 3_600_000).toISOString(),
        isExpired: false,
        eventId: `po-signal-${field}-${Date.now()}`,
        reviewState: 'pending_review',
      };
      pointOperatorSignals = {
        ...pointOperatorSignals,
        [field]: signal,
      };
      pointOperatorPoint = {
        ...pointOperatorPoint,
        details: {
          ...pointOperatorPoint.details,
          [field]: payload.value,
          operatorSignal: {
            field,
            reportedAt: signal.reportedAt,
            expiresAt: signal.expiresAt,
            reviewState: signal.reviewState,
          },
        },
        operatorSignals: pointOperatorSignals,
        updatedAt: capturedAt,
      };
      await fulfillRoute(route, { status: 201, body: { eventId: signal.eventId } });
      return;
    }

    if (
      role === 'point_operator' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_photo' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as { imageData?: string; capturedAt?: string };
      const capturedAt = String(payload.capturedAt ?? NOW_ISO);
      pointOperatorPoint = {
        ...pointOperatorPoint,
        photoUrl: payload.imageData || pointOperatorPoint.photoUrl,
        details: {
          ...pointOperatorPoint.details,
          operatorPhotoUpdate: true,
          operatorSignal: {
            field: 'photoUrl',
            reportedAt: capturedAt,
            expiresAt: capturedAt,
            reviewState: 'pending_review',
          },
        },
        updatedAt: capturedAt,
      };
      await fulfillRoute(route, { status: 201, body: { eventId: `po-photo-${Date.now()}` } });
      return;
    }

    if (
      role === 'point_operator' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'po_password' &&
      method === 'POST'
    ) {
      currentSession = null;
      await fulfillRoute(route, {
        body: { changed: true, reauthenticate: true },
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
