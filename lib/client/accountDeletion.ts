import { apiJson } from './api';

export interface AccountDeletionRequirements {
  requiresPassword: boolean;
  blockers: Array<{ code: 'last_organization_owner' | 'last_adl_admin'; label: string }>;
}

export function getAccountDeletionRequirementsRequest(): Promise<AccountDeletionRequirements> {
  return apiJson<AccountDeletionRequirements>('/api/user?view=account_delete');
}

export function deleteMyAccountRequest(input: {
  password?: string;
  confirmation: 'DELETE';
  acknowledgeDataLoss: true;
}): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>('/api/user?view=account_delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-ADL-Delete-Confirmation': 'DELETE',
    },
    body: JSON.stringify(input),
  });
}
