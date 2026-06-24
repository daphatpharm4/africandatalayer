import bcrypt from 'bcryptjs';
import { requireUser } from '../../lib/auth.js';
import {
  inferDefaultDisplayName,
  normalizeIdentifier,
} from '../../lib/shared/identifier.js';
import { errorResponse, jsonResponse } from '../../lib/server/http.js';
import {
  type AbortableIdempotencyStore,
  hashRequestPayload,
  postgresIdempotencyStore,
  resolveIdempotency,
} from '../../lib/server/idempotencyGeneric.js';
import { readIdempotencyKey } from '../../lib/server/idempotencyCore.js';
import { getPointOperatorControls } from '../../lib/server/pointOperatorConfig.js';
import {
  createPointOperatorLifecycle,
  PointOperatorConflictError,
  type RevokePointOperatorInput,
} from '../../lib/server/pointOperatorService.js';
import {
  findProjectedPointForAssignment,
  getActivePointOperatorAssignmentByPoint,
  getActivePointOperatorAssignmentByUser,
  grantPointOperatorAssignmentTx,
  listPointOperatorAssignmentHistory,
  type GrantAssignmentInput,
} from '../../lib/server/pointOperatorStore.js';
import { projectPointsFromEvents } from '../../lib/server/pointProjection.js';
import { consumeRateLimit } from '../../lib/server/rateLimit.js';
import {
  buildReadableEvents,
  findReadableProjectedPoint,
  type ReadableProjectedPoint,
} from '../../lib/server/submissionEvents.js';
import {
  getUserProfile,
  isStorageUnavailableError,
} from '../../lib/server/storage/index.js';
import {
  pointOperatorCreateSchema,
  pointOperatorPasswordSchema,
  pointOperatorPhotoSchema,
  pointOperatorRevokeSchema,
  pointOperatorSignalSchema,
} from '../../lib/server/validation.js';
import type {
  PointOperatorAssignment,
  ProjectedPoint,
  UserProfile,
  UserRole,
} from '../../shared/types.js';

type PointOperatorView =
  | 'admin_search_points'
  | 'admin_create'
  | 'admin_assignment'
  | 'admin_revoke'
  | 'me'
  | 'status'
  | 'photo'
  | 'password';

type RequireUserFn = typeof requireUser;
type ConsumeRateLimitFn = typeof consumeRateLimit;
type GetUserProfileFn = typeof getUserProfile;
type HashPasswordFn = typeof bcrypt.hash;
interface SubmitSignalInput {
  operatorUserId: string;
  field: string;
  value: boolean;
  capturedAt?: string;
  idempotencyKey: string;
}

interface SubmitPhotoInput {
  operatorUserId: string;
  imageData: string;
  capturedAt?: string;
  idempotencyKey: string;
}

interface ChangePasswordInput {
  operatorUserId: string;
  currentPassword: string;
  newPassword: string;
  idempotencyKey: string;
}

interface PointOperatorHandlerDeps {
  requireUserFn?: RequireUserFn;
  consumeRateLimitFn?: ConsumeRateLimitFn;
  idempotencyStore?: AbortableIdempotencyStore;
  getUserProfileFn?: GetUserProfileFn;
  getActiveAssignmentByUserFn?: (
    userId: string,
  ) => Promise<PointOperatorAssignment | null>;
  getActiveAssignmentByPointFn?: (
    pointId: string,
  ) => Promise<PointOperatorAssignment | null>;
  listAssignmentHistoryFn?: (
    pointId: string,
  ) => Promise<PointOperatorAssignment[]>;
  findProjectedPointFn?: (pointId: string) => Promise<ProjectedPoint | null>;
  findReadablePointFn?: (
    pointId: string,
  ) => Promise<ReadableProjectedPoint | null>;
  searchReadablePointsFn?: (
    query: string,
  ) => Promise<Array<ProjectedPoint | null>>;
  hashPasswordFn?: HashPasswordFn;
  grantAssignmentFn?: (
    input: GrantAssignmentInput,
  ) => Promise<PointOperatorAssignment>;
  revokeAssignmentFn?: (
    input: RevokePointOperatorInput,
  ) => Promise<PointOperatorAssignment>;
  submitSignalFn?: (input: SubmitSignalInput) => Promise<unknown>;
  submitPhotoFn?: (input: SubmitPhotoInput) => Promise<unknown>;
  changePasswordFn?: (input: ChangePasswordInput) => Promise<unknown>;
}

interface AuthenticatedUser {
  id: string;
  token: unknown;
  role: UserRole;
}

interface PreparedWrite {
  idempotencyKey: string;
  replay: Response | null;
}

const WRITE_VIEWS: ReadonlySet<PointOperatorView> = new Set([
  'admin_create',
  'admin_revoke',
  'status',
  'photo',
  'password',
]);

const VIEW_METHODS: Readonly<Record<PointOperatorView, string>> = {
  admin_search_points: 'GET',
  admin_create: 'POST',
  admin_assignment: 'GET',
  admin_revoke: 'POST',
  me: 'GET',
  status: 'POST',
  photo: 'POST',
  password: 'POST',
};

function isAdmin(token: unknown, role: UserRole): boolean {
  const claims = token as { isAdmin?: unknown; role?: unknown } | undefined;
  return (
    role === 'admin' || claims?.isAdmin === true || claims?.role === 'admin'
  );
}

function isAdminView(view: PointOperatorView): boolean {
  return view.startsWith('admin_');
}

function parseView(value: string | null): PointOperatorView | null {
  switch (value) {
    case 'admin_search_points':
    case 'admin_create':
    case 'admin_assignment':
    case 'admin_revoke':
    case 'me':
    case 'status':
    case 'photo':
    case 'password':
      return value;
    default:
      return null;
  }
}

function sanitizeProfile(
  profile: UserProfile | null,
): Omit<UserProfile, 'passwordHash'> | null {
  if (!profile) return null;
  const safe = { ...profile };
  delete safe.passwordHash;
  return safe;
}

function pointName(point: ProjectedPoint): string {
  for (const value of [
    point.details.name,
    point.details.siteName,
    point.details.roadName,
  ]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return point.pointId;
}

function matchesPointQuery(point: ProjectedPoint, query: string): boolean {
  if (!query) return true;
  const haystack = [point.pointId, point.category, pointName(point)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

async function searchCanonicalReadablePoints(
  query: string,
): Promise<ProjectedPoint[]> {
  const points = projectPointsFromEvents(await buildReadableEvents());
  return points.filter((point) => matchesPointQuery(point, query)).slice(0, 50);
}

async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: errorResponse('Invalid JSON body', 422, {
        code: 'invalid_request',
      }),
    };
  }
}

function validationError(message?: string): Response {
  return errorResponse(message || 'Invalid request body', 422, {
    code: 'invalid_request',
  });
}

function inactiveAssignmentResponse(): Response {
  return errorResponse('Point operator access is not active', 403, {
    code: 'assignment_inactive',
  });
}

function requireIdempotencyKey(request: Request): Response | null {
  if (readIdempotencyKey(request.headers)) return null;
  return errorResponse('Idempotency-Key is required', 422, {
    code: 'idempotency_key_required',
  });
}

function unavailableResponse(message: string, code: string): Response {
  return errorResponse(message, 503, { code });
}

function classifyFailure(error: unknown): Response {
  if (isStorageUnavailableError(error)) {
    return errorResponse('Storage service temporarily unavailable', 503, {
      code: 'storage_unavailable',
    });
  }
  if (error instanceof PointOperatorConflictError) {
    return errorResponse(error.message, 409, {
      code: error.code,
    });
  }
  const databaseError = error as { code?: unknown };
  if (databaseError?.code === '23505') {
    return errorResponse('Point operator account already exists', 409, {
      code: 'point_operator_conflict',
    });
  }
  const message =
    error instanceof Error ? error.message : 'Point operator request failed';
  if (/not found/i.test(message) || /does not exist/i.test(message)) {
    return errorResponse(message, 404, { code: 'not_found' });
  }
  return unavailableResponse(
    'Point operator service temporarily unavailable',
    'point_operator_unavailable',
  );
}

async function beginWrite(
  request: Request,
  view: PointOperatorView,
  auth: AuthenticatedUser,
  body: unknown,
  store: AbortableIdempotencyStore,
): Promise<PreparedWrite | Response> {
  const idempotencyKey = readIdempotencyKey(request.headers);
  if (!idempotencyKey) {
    return errorResponse('Idempotency-Key is required', 422, {
      code: 'idempotency_key_required',
    });
  }
  const decision = await resolveIdempotency(store, {
    scope: `point-operator:${view}`,
    userId: auth.id,
    idempotencyKey,
    requestHash: hashRequestPayload(body),
  });
  if (decision.status === 'conflict') {
    return errorResponse('Idempotency-Key reused with a different body', 409, {
      code: 'idempotency_conflict',
    });
  }
  if (decision.status === 'in_flight') {
    return errorResponse(
      'A request with this idempotency key is already in progress',
      409,
      { code: 'idempotency_in_flight', retryAfterSeconds: 2 },
    );
  }
  if (decision.status === 'replay') {
    return {
      idempotencyKey,
      replay: jsonResponse(decision.responseJson, {
        status: decision.responseStatus,
      }),
    };
  }
  return { idempotencyKey, replay: null };
}

async function completeWrite(
  store: AbortableIdempotencyStore,
  view: PointOperatorView,
  auth: AuthenticatedUser,
  prepared: PreparedWrite,
  body: unknown,
  status: number,
): Promise<Response> {
  await store.complete(
    `point-operator:${view}`,
    auth.id,
    prepared.idempotencyKey,
    body,
    status,
  );
  return jsonResponse(body, { status });
}

async function finalizeFailedWrite(
  store: AbortableIdempotencyStore,
  view: PointOperatorView,
  auth: AuthenticatedUser,
  prepared: PreparedWrite,
  response: Response,
): Promise<void> {
  if (response.status >= 500) {
    await store.abort(
      `point-operator:${view}`,
      auth.id,
      prepared.idempotencyKey,
    );
    return;
  }
  const responseBody = await response.clone().json();
  await store.complete(
    `point-operator:${view}`,
    auth.id,
    prepared.idempotencyKey,
    responseBody,
    response.status,
  );
}

export function createPointOperatorHandler(
  deps: PointOperatorHandlerDeps = {},
) {
  const requireUserFn = deps.requireUserFn ?? requireUser;
  const consumeRateLimitFn = deps.consumeRateLimitFn ?? consumeRateLimit;
  const idempotencyStore = deps.idempotencyStore ?? postgresIdempotencyStore;
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const getActiveAssignmentByUserFn =
    deps.getActiveAssignmentByUserFn ?? getActivePointOperatorAssignmentByUser;
  const getActiveAssignmentByPointFn =
    deps.getActiveAssignmentByPointFn ??
    getActivePointOperatorAssignmentByPoint;
  const listAssignmentHistoryFn =
    deps.listAssignmentHistoryFn ?? listPointOperatorAssignmentHistory;
  const findProjectedPointFn =
    deps.findProjectedPointFn ?? findProjectedPointForAssignment;
  const findReadablePointFn =
    deps.findReadablePointFn ?? findReadableProjectedPoint;
  const searchReadablePointsFn =
    deps.searchReadablePointsFn ?? searchCanonicalReadablePoints;
  const hashPasswordFn = deps.hashPasswordFn ?? bcrypt.hash;
  const grantAssignmentFn =
    deps.grantAssignmentFn ?? grantPointOperatorAssignmentTx;
  const revokeAssignmentFn =
    deps.revokeAssignmentFn ?? createPointOperatorLifecycle().revoke;
  return async function handlePointOperator(
    request: Request,
  ): Promise<Response> {
    const auth = await requireUserFn(request);
    if (!auth) {
      return errorResponse('Unauthorized', 401, {
        code: 'unauthorized',
      });
    }

    const view = parseView(new URL(request.url).searchParams.get('view'));
    if (!view) {
      return errorResponse('Unknown point operator view', 404, {
        code: 'unknown_view',
      });
    }

    if (isAdminView(view)) {
      if (!isAdmin(auth.token, auth.role)) {
        return errorResponse('Forbidden', 403, { code: 'forbidden' });
      }
    } else if (auth.role !== 'point_operator') {
      return errorResponse('Forbidden', 403, { code: 'forbidden' });
    }

    if (request.method !== VIEW_METHODS[view]) {
      return errorResponse('Method not allowed', 405, {
        code: 'method_not_allowed',
      });
    }

    const rateLimit = await consumeRateLimitFn({
      route: `point-operator:${view}`,
      key: auth.id,
      windowSeconds: 60,
      max: WRITE_VIEWS.has(view) ? 20 : 60,
      request,
      userId: auth.id,
    });
    if (!rateLimit.allowed) {
      return errorResponse('Too many requests', 429, {
        code: 'rate_limited',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    let activeWrite:
      | { view: PointOperatorView; prepared: PreparedWrite }
      | null = null;
    try {
      if (view === 'admin_search_points') {
        const query = (new URL(request.url).searchParams.get('q') ?? '')
          .trim()
          .toLowerCase();
        const candidates = await searchReadablePointsFn(query);
        const readablePoints = candidates.filter(
          (candidate): candidate is ProjectedPoint =>
            candidate !== null && matchesPointQuery(candidate, query),
        );
        const points = await Promise.all(
          readablePoints.slice(0, 50).map(async (point) => {
            const active = await getActiveAssignmentByPointFn(point.pointId);
            return {
              pointId: point.pointId,
              name: pointName(point),
              category: point.category,
              location: point.location,
              ...(point.photoUrl ? { photoUrl: point.photoUrl } : {}),
              activeOperator: active
                ? {
                    operatorUserId: active.operatorUserId,
                    grantedAt: active.grantedAt,
                  }
                : null,
            };
          }),
        );
        return jsonResponse({ points }, { status: 200 });
      }

      if (view === 'admin_assignment') {
        const pointId = (
          new URL(request.url).searchParams.get('pointId') ?? ''
        ).trim();
        if (!pointId) {
          return validationError('pointId is required');
        }
        const [point, active, history] = await Promise.all([
          findProjectedPointFn(pointId),
          getActiveAssignmentByPointFn(pointId),
          listAssignmentHistoryFn(pointId),
        ]);
        if (!point) {
          return errorResponse('Verified point not found', 404, {
            code: 'not_found',
          });
        }
        const operator = active
          ? sanitizeProfile(await getUserProfileFn(active.operatorUserId))
          : null;
        return jsonResponse(
          { assignment: active, history, operator, point },
          { status: 200 },
        );
      }

      if (view === 'me') {
        const assignment = await getActiveAssignmentByUserFn(auth.id);
        if (!assignment) return inactiveAssignmentResponse();
        const point = await findProjectedPointFn(assignment.pointId);
        if (!point) {
          return errorResponse('Assigned point not found', 404, {
            code: 'not_found',
          });
        }
        return jsonResponse(
          {
            assignment,
            point,
            controls: getPointOperatorControls(point.category),
            signals: point.operatorSignals ?? {},
          },
          { status: 200 },
        );
      }

      const parsedBody = await readJson(request);
      if (parsedBody.ok === false) return parsedBody.response;

      if (view === 'admin_create') {
        const validation = pointOperatorCreateSchema.safeParse(
          parsedBody.value,
        );
        if (!validation.success) {
          return validationError(validation.error.issues[0]?.message);
        }
        const body = validation.data;
        const normalizedIdentifier = normalizeIdentifier(body.identifier);
        if (!normalizedIdentifier) {
          return validationError('Enter a valid email or phone number');
        }
        const operatorUserId = normalizedIdentifier.value;
        const prepared = await beginWrite(
          request,
          view,
          auth,
          body,
          idempotencyStore,
        );
        if (prepared instanceof Response) return prepared;
        if (prepared.replay) return prepared.replay;
        activeWrite = { view, prepared };
        if (await getUserProfileFn(operatorUserId)) {
          const response = errorResponse(
            'An account already exists for this phone/email',
            409,
            { code: 'point_operator_conflict' },
          );
          await finalizeFailedWrite(
            idempotencyStore,
            view,
            auth,
            prepared,
            response,
          );
          return response;
        }
        const readablePoint = await findReadablePointFn(body.pointId);
        if (!readablePoint) {
          const response = errorResponse('Verified point not found', 404, {
            code: 'not_found',
          });
          await finalizeFailedWrite(
            idempotencyStore,
            view,
            auth,
            prepared,
            response,
          );
          return response;
        }
        if (await getActiveAssignmentByPointFn(body.pointId)) {
          const response = errorResponse(
            'Point already has an active operator',
            409,
            { code: 'point_operator_conflict' },
          );
          await finalizeFailedWrite(
            idempotencyStore,
            view,
            auth,
            prepared,
            response,
          );
          return response;
        }
        const passwordHash = await hashPasswordFn(body.password, 12);
        const assignment = await grantAssignmentFn({
          actorUserId: auth.id,
          operatorUserId,
          pointId: body.pointId,
          pointSource: readablePoint.source,
          profile: {
            kind: 'new',
            userId: operatorUserId,
            email:
              normalizedIdentifier.type === 'email' ? operatorUserId : null,
            phone:
              normalizedIdentifier.type === 'phone' ? operatorUserId : null,
            name: body.name.trim() || inferDefaultDisplayName(operatorUserId),
            passwordHash,
            mustChangePassword: true,
          },
          audit: {
            request,
            identifierType: normalizedIdentifier.type,
            ...(body.note ? { note: body.note } : {}),
          },
        });
        const response = await completeWrite(
          idempotencyStore,
          view,
          auth,
          prepared,
          { assignment },
          201,
        );
        activeWrite = null;
        return response;
      }

      if (view === 'admin_revoke') {
        const validation = pointOperatorRevokeSchema.safeParse(
          parsedBody.value,
        );
        if (!validation.success) {
          return validationError(validation.error.issues[0]?.message);
        }
        const body = validation.data;
        const operatorUserId = body.operatorUserId.toLowerCase();
        const prepared = await beginWrite(
          request,
          view,
          auth,
          body,
          idempotencyStore,
        );
        if (prepared instanceof Response) return prepared;
        if (prepared.replay) return prepared.replay;
        activeWrite = { view, prepared };
        const assignment = await revokeAssignmentFn({
          actorUserId: auth.id,
          operatorUserId,
          reason: body.reason,
          auditRequest: request,
        });
        const response = await completeWrite(
          idempotencyStore,
          view,
          auth,
          prepared,
          { assignment },
          200,
        );
        activeWrite = null;
        return response;
      }

      const assignment = await getActiveAssignmentByUserFn(auth.id);
      if (!assignment) return inactiveAssignmentResponse();

      if (view === 'status') {
        const validation = pointOperatorSignalSchema.safeParse(
          parsedBody.value,
        );
        if (!validation.success) {
          return validationError(validation.error.issues[0]?.message);
        }
        const missingIdempotencyKey = requireIdempotencyKey(request);
        if (missingIdempotencyKey) return missingIdempotencyKey;
        if (!deps.submitSignalFn) {
          return unavailableResponse(
            'Point operator status updates are temporarily unavailable',
            'point_operator_status_unavailable',
          );
        }
        const body = validation.data;
        const prepared = await beginWrite(
          request,
          view,
          auth,
          body,
          idempotencyStore,
        );
        if (prepared instanceof Response) return prepared;
        if (prepared.replay) return prepared.replay;
        activeWrite = { view, prepared };
        const result = await deps.submitSignalFn({
          operatorUserId: auth.id,
          field: body.field,
          value: body.value,
          ...(body.capturedAt ? { capturedAt: body.capturedAt } : {}),
          idempotencyKey: prepared.idempotencyKey,
        });
        const response = await completeWrite(
          idempotencyStore,
          view,
          auth,
          prepared,
          result,
          201,
        );
        activeWrite = null;
        return response;
      }

      if (view === 'photo') {
        const validation = pointOperatorPhotoSchema.safeParse(parsedBody.value);
        if (!validation.success) {
          return validationError(validation.error.issues[0]?.message);
        }
        const missingIdempotencyKey = requireIdempotencyKey(request);
        if (missingIdempotencyKey) return missingIdempotencyKey;
        if (!deps.submitPhotoFn) {
          return unavailableResponse(
            'Point operator photo updates are temporarily unavailable',
            'point_operator_photo_unavailable',
          );
        }
        const body = validation.data;
        const prepared = await beginWrite(
          request,
          view,
          auth,
          body,
          idempotencyStore,
        );
        if (prepared instanceof Response) return prepared;
        if (prepared.replay) return prepared.replay;
        activeWrite = { view, prepared };
        const result = await deps.submitPhotoFn({
          operatorUserId: auth.id,
          imageData: body.imageData,
          ...(body.capturedAt ? { capturedAt: body.capturedAt } : {}),
          idempotencyKey: prepared.idempotencyKey,
        });
        const response = await completeWrite(
          idempotencyStore,
          view,
          auth,
          prepared,
          result,
          201,
        );
        activeWrite = null;
        return response;
      }

      const validation = pointOperatorPasswordSchema.safeParse(
        parsedBody.value,
      );
      if (!validation.success) {
        return validationError(validation.error.issues[0]?.message);
      }
      const missingIdempotencyKey = requireIdempotencyKey(request);
      if (missingIdempotencyKey) return missingIdempotencyKey;
      if (!deps.changePasswordFn) {
        return unavailableResponse(
          'Point operator password changes are temporarily unavailable',
          'point_operator_password_unavailable',
        );
      }
      const body = validation.data;
      const prepared = await beginWrite(
        request,
        view,
        auth,
        body,
        idempotencyStore,
      );
      if (prepared instanceof Response) return prepared;
      if (prepared.replay) return prepared.replay;
      activeWrite = { view, prepared };
      const result = await deps.changePasswordFn({
        operatorUserId: auth.id,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        idempotencyKey: prepared.idempotencyKey,
      });
      const response = await completeWrite(
        idempotencyStore,
        view,
        auth,
        prepared,
        result,
        200,
      );
      activeWrite = null;
      return response;
    } catch (error) {
      const response = classifyFailure(error);
      if (activeWrite) {
        await finalizeFailedWrite(
          idempotencyStore,
          activeWrite.view,
          auth,
          activeWrite.prepared,
          response,
        );
      }
      return response;
    }
  };
}

const handler = createPointOperatorHandler();

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
