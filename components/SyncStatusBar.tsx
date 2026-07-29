import React from 'react';
import { RefreshCw } from 'lucide-react';
import StatusBadge from './shared/StatusBadge';
import type { OperationalStatus } from '../lib/shared/ui/semanticTokens';

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

  const operationalStatus: OperationalStatus =
    failed > 0 ? 'error' : isOffline ? 'offline' : isSyncing ? 'syncing' : 'success';
  const status = failed > 0
    ? {
        label: t(`${failed} failed uploads. Tap to review.`, `${failed} envois ont échoué. Touchez pour vérifier.`),
      }
    : isOffline
      ? {
          label: pending > 0
            ? t(`Offline. ${pending} uploads waiting to sync.`, `Hors ligne. ${pending} envois attendent la synchronisation.`)
            : t('Offline. New captures will be saved on this device.', 'Hors ligne. Les nouvelles captures seront enregistrées sur cet appareil.'),
        }
      : isSyncing
        ? {
          label: t('Syncing your latest field updates...', 'Synchronisation des dernières mises à jour...'),
        }
        : {
          label: synced > 0
            ? t(`${synced} uploads synced. All done.`, `${synced} envois synchronisés. Tout est fait.`)
            : t('All synced. Ready to capture.', 'Tout synchronisé. Prêt à capturer.'),
        };

  return (
    <div
      className="sticky top-0 z-30 flex min-h-12 items-center justify-between border-b border-navy-border bg-white px-3 pt-[var(--safe-top)] transition-colors duration-300"
      data-testid="capture-sync-state"
    >
      <button
        type="button"
        onClick={onTap}
        className="adl-focusable flex min-h-12 min-w-0 flex-1 items-center gap-1.5"
      >
        <StatusBadge status={operationalStatus} label={status.label} live />
      </button>

      {onRefresh && !isSyncing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className="adl-focusable ml-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-navy transition-opacity hover:opacity-70"
          aria-label={t('Refresh', 'Actualiser')}
        >
          <RefreshCw size={14} />
        </button>
      )}
    </div>
  );
};

export default React.memo(SyncStatusBar);
