import React from 'react';
import { RefreshCw, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  pending: number;
  failed: number;
  synced: number;
  isOffline: boolean;
  isSyncing: boolean;
  onTap?: () => void;
  onRefresh?: () => void;
  language: 'en' | 'fr';
}

const SyncStatusBar: React.FC<Props> = ({
  pending,
  failed,
  synced,
  isOffline,
  isSyncing,
  onTap,
  onRefresh,
  language,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  // Determine state priority: failed > offline+pending > syncing > all synced
  const hasFailed = failed > 0;
  const isOfflinePending = isOffline && pending > 0;

  let bgClass = 'bg-[#4c7c59]/10';
  let textClass = 'text-[#4c7c59]';
  let label = '';
  let icon: React.ReactNode = null;

  if (hasFailed) {
    bgClass = 'bg-[#c53030]';
    textClass = 'text-white';
    label = t(`${failed} failed — Tap to view`, `${failed} echecs — Appuyez pour voir`);
    icon = <AlertCircle size={12} className="text-white flex-shrink-0" />;
  } else if (isOfflinePending) {
    bgClass = 'bg-amber-500';
    textClass = 'text-white';
    label = t(`OFFLINE — ${pending} pending`, `HORS LIGNE — ${pending} en attente`);
    icon = <WifiOff size={12} className="text-white flex-shrink-0" />;
  } else if (isSyncing) {
    bgClass = 'bg-[#0f2b46]';
    textClass = 'text-white';
    label = t('Syncing...', 'Synchronisation...');
    icon = <RefreshCw size={12} className="text-white animate-spin flex-shrink-0" />;
  } else {
    // All synced
    label = t(`${synced} synced`, `${synced} synchronises`);
    icon = <CheckCircle size={12} className="text-[#4c7c59] flex-shrink-0" />;
  }

  return (
    <div
      className={`sticky top-0 z-30 h-7 flex items-center justify-between px-3 ${bgClass} transition-colors duration-300`}
    >
      <button
        type="button"
        onClick={onTap}
        className="flex items-center gap-1.5 min-w-0 flex-1"
      >
        {icon}
        <span className={`text-[10px] font-bold uppercase tracking-widest truncate ${textClass}`}>
          {label}
        </span>
      </button>

      {onRefresh && !isSyncing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className={`flex-shrink-0 ml-2 p-0.5 rounded hover:opacity-70 transition-opacity ${textClass}`}
          aria-label={t('Refresh', 'Actualiser')}
        >
          <RefreshCw size={12} />
        </button>
      )}
    </div>
  );
};

export default SyncStatusBar;
