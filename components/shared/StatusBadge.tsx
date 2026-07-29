import React from 'react';
import {
  AlertTriangle, Check, Circle, Flag, LoaderCircle, RefreshCw,
  ShieldCheck, WifiOff, X,
} from 'lucide-react';
import {
  getStatusPresentation,
  getToneClasses,
  type OperationalStatus,
} from '../../lib/shared/ui/semanticTokens';

interface Props {
  status: OperationalStatus;
  label: string;
  live?: boolean;
  className?: string;
}

const icons = {
  circle: Circle,
  loader: LoaderCircle,
  check: Check,
  triangle: AlertTriangle,
  x: X,
  'wifi-off': WifiOff,
  refresh: RefreshCw,
  'shield-check': ShieldCheck,
  flag: Flag,
} as const;

const StatusBadge: React.FC<Props> = ({ status, label, live = false, className = '' }) => {
  const presentation = getStatusPresentation(status);
  const Icon = icons[presentation.icon];
  const animated = status === 'loading' || status === 'syncing' ? 'motion-safe:animate-spin' : '';
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getToneClasses(presentation.tone).badge} ${className}`}
      {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
    >
      <Icon aria-hidden="true" size={14} className={animated} />
      {label}
    </span>
  );
};

export default React.memo(StatusBadge);
