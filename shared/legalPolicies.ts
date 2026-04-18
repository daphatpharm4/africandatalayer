export type PolicyKind = 'privacy' | 'terms';

export const POLICY_KINDS: readonly PolicyKind[] = ['privacy', 'terms'] as const;

export const POLICY_VERSIONS: Record<PolicyKind, string> = {
  privacy: '1.0.0',
  terms: '1.0.0',
};

export const POLICY_EFFECTIVE_DATES: Record<PolicyKind, string> = {
  privacy: '2026-04-18',
  terms: '2026-04-18',
};

export function currentPolicyVersion(kind: PolicyKind): string {
  return POLICY_VERSIONS[kind];
}

export function currentPolicyEffectiveDate(kind: PolicyKind): string {
  return POLICY_EFFECTIVE_DATES[kind];
}
