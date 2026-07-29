import React from 'react';
import type { OperationalStatus } from '../../lib/shared/ui/semanticTokens';
import StatusBadge from './StatusBadge';

export interface DecisionAction {
  id: string;
  label: string;
  intent: 'primary' | 'success' | 'danger' | 'neutral';
  onSelect: () => void;
  disabled?: boolean;
  busy?: boolean;
}

interface Props {
  status: OperationalStatus;
  statusLabel: string;
  actions: DecisionAction[];
  className?: string;
  testId?: string;
}

const actionClassByIntent = {
  primary: 'bg-navy text-white',
  success: 'bg-forest text-white',
  danger: 'bg-danger text-white',
  neutral: 'border border-navy-border bg-white text-navy',
} as const;

const DecisionBar: React.FC<Props> = ({ status, statusLabel, actions, className = '', testId }) => (
  <div
    data-testid={testId}
    className={`flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
  >
    <StatusBadge status={status} label={statusLabel} live />
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onSelect}
          disabled={action.disabled || action.busy}
          aria-busy={action.busy || undefined}
          className={`adl-focusable min-h-12 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${actionClassByIntent[action.intent]}`}
        >
          {action.busy ? `${action.label}…` : action.label}
        </button>
      ))}
    </div>
  </div>
);

export default DecisionBar;
