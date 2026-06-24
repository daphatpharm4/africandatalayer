import type { SubmissionCategory } from '../../shared/types.js';
import { getVertical } from '../../shared/verticals.js';

export function getPointOperatorControls(category: SubmissionCategory) {
  return [...getVertical(category).operatorControls];
}

export function getPointOperatorControl(
  category: SubmissionCategory,
  field: string,
) {
  return (
    getPointOperatorControls(category).find(
      (control) => control.field === field,
    ) ?? null
  );
}

export function resolvePointOperatorExpiry(
  category: SubmissionCategory,
  field: string,
  reportedAt: Date,
): Date {
  const control = getPointOperatorControl(category, field);
  if (!control)
    throw new Error(
      `Operator field '${field}' is not allowed for '${category}'`,
    );
  return new Date(reportedAt.getTime() + control.expiryHours * 60 * 60 * 1000);
}
