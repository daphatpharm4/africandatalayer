export interface FieldLaunchIntent {
  organizationId: string;
  projectId: string;
  recordTypeKey: string;
}

const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const SAFE_RECORD_TYPE_KEY = /^[a-z][a-z0-9_]{1,39}$/;

function validIntent(intent: FieldLaunchIntent): boolean {
  return SAFE_ID.test(intent.organizationId)
    && SAFE_ID.test(intent.projectId)
    && SAFE_RECORD_TYPE_KEY.test(intent.recordTypeKey);
}

export function buildFieldLaunchHref(intent: FieldLaunchIntent): string {
  if (!validIntent(intent)) return '/';
  const params = new URLSearchParams({
    fieldLaunch: '1',
    organizationId: intent.organizationId,
    projectId: intent.projectId,
    recordTypeKey: intent.recordTypeKey,
  });
  return `/?${params.toString()}`;
}

export function parseFieldLaunchIntent(input: string): FieldLaunchIntent | null {
  try {
    const url = new URL(input, 'https://adl.invalid');
    if (url.searchParams.get('fieldLaunch') !== '1') return null;
    const intent: FieldLaunchIntent = {
      organizationId: url.searchParams.get('organizationId') ?? '',
      projectId: url.searchParams.get('projectId') ?? '',
      recordTypeKey: url.searchParams.get('recordTypeKey') ?? '',
    };
    return validIntent(intent) ? intent : null;
  } catch {
    return null;
  }
}

export function fieldLaunchChoiceKey(intent: Pick<FieldLaunchIntent, 'projectId' | 'recordTypeKey'>): string {
  return `${intent.projectId}:${intent.recordTypeKey}`;
}
