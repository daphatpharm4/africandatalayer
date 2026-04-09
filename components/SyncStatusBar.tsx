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

  const status = hasFailed
    ? {
        bgClass: 'bg-danger',
        textClass: 'text-white',
        label: t(`${failed} failed uploads. Tap to review.`, `${failed} envois ont échoué. Touchez pour vérifier.`),
        icon: <AlertCircle size={12} className="text-white flex-shrink-0" />,
      }
    : isOfflinePending
      ? {
          bgClass: 'bg-amber-500',
          textClass: 'text-white',
          label: t(`Offline. ${pending} uploads waiting to sync.`, `Hors ligne. ${pending} envois attendent la synchronisation.`),
          icon: <WifiOff size={12} className="text-white flex-shrink-0" />,
        }
      : isSyncing
        ? {
          bgClass: 'bg-navy',
          textClass: 'text-white',
          label: t('Syncing your latest field updates...', 'Synchronisation des dernières mises à jour...'),
          icon: <RefreshCw size={12} className="text-white animate-spin flex-shrink-0" />,
        }
        : {
          bgClass: 'bg-forest/10',
          textClass: 'text-forest',
          label: synced > 0
            ? t(`${synced} uploads synced. Queue is clear.`, `${synced} envois synchronisés. La file est vide.`)
            : t('Ready to capture. No uploads waiting.', 'Prêt à capturer. Aucun envoi en attente.'),
          icon: <CheckCircle size={12} className="text-forest flex-shrink-0" />,
        };

  return (
    <div
      className={`sticky top-0 z-30 flex min-h-9 items-center justify-between px-3 ${status.bgClass} transition-colors duration-300`}
    >
      <button
        type="button"
        onClick={onTap}
        className="flex items-center gap-1.5 min-w-0 flex-1"
      >
        {status.icon}
        <span className={`truncate text-[11px] font-semibold leading-4 ${status.textClass}`}>
          {status.label}
        </span>
      </button>

      {onRefresh && !isSyncing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className={`flex-shrink-0 ml-2 p-0.5 rounded hover:opacity-70 transition-opacity ${status.textClass}`}
          aria-label={t('Refresh', 'Actualiser')}
        >
          <RefreshCw size={12} />
        </button>
      )}
    </div>
  );
};

export default SyncStatusBar;
