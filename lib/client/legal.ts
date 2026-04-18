import { apiFetch, apiJson } from './api';
import type { IpReport } from '../../shared/types';
import type { PolicyKind } from '../../shared/legalPolicies';

export interface OutstandingPolicyResponse {
  outstanding: PolicyKind[];
  current: Record<PolicyKind, string>;
}

export async function fetchOutstandingPolicies(): Promise<OutstandingPolicyResponse | null> {
  try {
    return await apiJson<OutstandingPolicyResponse>('/api/privacy?view=acceptance');
  } catch (error) {
    console.warn('[LEGAL] fetchOutstandingPolicies failed', error);
    return null;
  }
}

export async function recordPolicyAcceptance(
  kinds: PolicyKind[],
): Promise<{ ok: boolean; recorded: PolicyKind[] } | null> {
  const response = await apiFetch('/api/privacy?view=acceptance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accept: kinds }),
  });
  if (!response.ok) return null;
  return (await response.json()) as { ok: boolean; recorded: PolicyKind[] };
}

export interface IpReportInput {
  reporterName: string;
  reporterEmail: string;
  targetKind: 'submission' | 'point' | 'other';
  targetRef?: string;
  description: string;
  sworn: true;
}

export async function submitIpReport(input: IpReportInput): Promise<IpReport> {
  const response = await apiFetch('/api/privacy?view=ip-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `IP report submission failed (${response.status})`);
  }
  return (await response.json()) as IpReport;
}

export async function fetchIpReports(): Promise<IpReport[]> {
  try {
    return await apiJson<IpReport[]>('/api/privacy?view=ip-reports');
  } catch (error) {
    console.warn('[LEGAL] fetchIpReports failed', error);
    return [];
  }
}

export async function updateIpReport(input: {
  id: string;
  status: 'open' | 'reviewing' | 'resolved' | 'rejected';
  resolutionNotes?: string;
}): Promise<IpReport | null> {
  const response = await apiFetch('/api/privacy?view=ip-report', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) return null;
  return (await response.json()) as IpReport;
}
