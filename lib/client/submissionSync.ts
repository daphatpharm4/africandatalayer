import { apiFetch } from './api';
import type { SubmissionInput } from '../../shared/types';
import { getClientDeviceInfo } from './deviceProfile';
import { sanitizeErrorMessage as sanitizeBase } from './errorUtils';

const DEFAULT_SYNC_ERROR = 'Unable to sync submission right now.';

function sanitizeErrorMessage(input: unknown, fallback = DEFAULT_SYNC_ERROR): string {
  const result = sanitizeBase(input, fallback);
  return result === fallback ? fallback : result.replace(/^Error:\s*/i, '');
}

async function extractResponseMessage(response: Response): Promise<string> {
  const fallback = response.statusText || DEFAULT_SYNC_ERROR;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as { error?: unknown; message?: unknown };
      return sanitizeErrorMessage(payload?.error ?? payload?.message, fallback);
    } catch {
      return fallback;
    }
  }

  try {
    const text = await response.text();
    return sanitizeErrorMessage(text, fallback);
  } catch {
    return fallback;
  }
}

function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

export class SubmissionSyncError extends Error {
  retryable: boolean;
  status: number | null;

  constructor(
    message: string,
    options: {
      retryable?: boolean;
      status?: number | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'SubmissionSyncError';
    this.retryable = Boolean(options.retryable);
    this.status = options.status ?? null;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function toSubmissionSyncError(error: unknown): SubmissionSyncError {
  if (error instanceof SubmissionSyncError) return error;
  if (error instanceof Error) {
    return new SubmissionSyncError(sanitizeErrorMessage(error.message), { retryable: true, cause: error });
  }
  return new SubmissionSyncError(DEFAULT_SYNC_ERROR, { retryable: true, cause: error });
}

function withClientDevice(payload: SubmissionInput): SubmissionInput {
  const details =
    payload.details && typeof payload.details === 'object'
      ? { ...(payload.details as Record<string, unknown>) }
      : {};
  if (!details.clientDevice) {
    details.clientDevice = getClientDeviceInfo();
  }
  return { ...payload, details };
}

export async function sendSubmissionPayload(payload: SubmissionInput, options?: { idempotencyKey?: string }): Promise<void> {
  const enrichedPayload = withClientDevice(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }
  let response: Response;
  try {
    response = await apiFetch('/api/submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify(enrichedPayload),
    });
  } catch (error) {
    throw new SubmissionSyncError(DEFAULT_SYNC_ERROR, { retryable: true, cause: error });
  }

  if (response.ok) return;

  const message = await extractResponseMessage(response);
  throw new SubmissionSyncError(message, {
    retryable: isRetryableStatus(response.status),
    status: response.status,
  });
}
