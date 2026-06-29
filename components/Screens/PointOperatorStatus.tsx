import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  fetchPointOperatorMe,
  submitPointOperatorSignal,
} from '../../lib/client/pointOperatorApi';
import {
  enqueuePointOperatorMutation,
  listPointOperatorQueueItems,
  removePointOperatorQueueItem,
  type PointOperatorQueueItem,
} from '../../lib/client/pointOperatorQueue';
import { resolveOperatorSignalLabel } from '../../lib/client/pointOperatorUi';
import type {
  PointOperatorControlDefinition,
  PointOperatorMeResponse,
  PointOperatorSignalState,
} from '../../shared/types';
import { categoryLabel } from '../../shared/verticals';

interface Props {
  language: 'en' | 'fr';
}

type ControlStatus = 'idle' | 'saving' | 'saved' | 'pending' | 'error';

const freshnessFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function relativeFreshness(iso: string | undefined, language: 'en' | 'fr'): string {
  if (!iso) return language === 'fr' ? 'fraicheur inconnue' : 'freshness unknown';
  const formatter = language === 'fr'
    ? new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
    : freshnessFormatter;
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  if (abs < 60_000) return language === 'fr' ? 'a l instant' : 'just now';
  if (abs < 3_600_000) return formatter.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return formatter.format(Math.round(diffMs / 3_600_000), 'hour');
  return formatter.format(Math.round(diffMs / 86_400_000), 'day');
}

function signalTime(signal: PointOperatorSignalState | undefined): string | undefined {
  return signal?.reportedAt ?? signal?.expiresAt;
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error) {
    return Boolean((error as { retryable?: unknown }).retryable);
  }
  return true;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const PointOperatorStatus: React.FC<Props> = ({ language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [data, setData] = useState<PointOperatorMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [controlStatus, setControlStatus] = useState<Record<string, ControlStatus>>({});
  const [controlErrors, setControlErrors] = useState<Record<string, string>>({});
  const [queuedItems, setQueuedItems] = useState<PointOperatorQueueItem[]>([]);

  const load = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [me, queue] = await Promise.all([
        fetchPointOperatorMe(),
        listPointOperatorQueueItems().catch(() => []),
      ]);
      setData(me);
      setQueuedItems(queue);
    } catch (error) {
      setLoadError(errorMessage(error, t('Unable to load status.', 'Impossible de charger le statut.')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingFields = useMemo(() => {
    const fields = new Set<string>();
    queuedItems.forEach((item) => {
      if (item.mutation.kind === 'signal') fields.add(item.mutation.field);
    });
    return fields;
  }, [queuedItems]);

  const refreshQueue = async () => {
    setQueuedItems(await listPointOperatorQueueItems().catch(() => []));
  };

  const setSignalValue = async (control: PointOperatorControlDefinition, value: boolean) => {
    if (!data) return;
    const capturedAt = new Date().toISOString();
    const previousSignal = data.signals[control.field];
    const optimisticSignal: PointOperatorSignalState = {
      field: control.field,
      value,
      reportedBy: 'point_operator',
      reportedAt: capturedAt,
      expiresAt: new Date(Date.now() + control.expiryHours * 3_600_000).toISOString(),
      isExpired: false,
      eventId: previousSignal?.eventId ?? `local-${control.field}`,
      reviewState: previousSignal?.reviewState ?? 'pending_review',
    };

    setData((current) => current
      ? { ...current, signals: { ...current.signals, [control.field]: optimisticSignal } }
      : current);
    setControlStatus((current) => ({ ...current, [control.field]: 'saving' }));
    setControlErrors((current) => ({ ...current, [control.field]: '' }));

    let item: PointOperatorQueueItem | null = null;
    try {
      item = await enqueuePointOperatorMutation({
        kind: 'signal',
        field: control.field,
        value,
        capturedAt,
      });
      await refreshQueue();
      const response = await submitPointOperatorSignal(
        { field: control.field, value, capturedAt },
        { idempotencyKey: item.idempotencyKey },
      );
      await removePointOperatorQueueItem(item.id);
      setData((current) => current
        ? {
            ...current,
            point: response.point,
            signals: response.signal
              ? { ...current.signals, [control.field]: response.signal }
              : current.signals,
          }
        : current);
      setControlStatus((current) => ({ ...current, [control.field]: 'saved' }));
      await refreshQueue();
    } catch (error) {
      if (!item) {
        setControlStatus((current) => ({ ...current, [control.field]: 'error' }));
        setControlErrors((current) => ({
          ...current,
          [control.field]: errorMessage(error, t('Unable to save offline. Try again when connected.', 'Impossible d enregistrer hors ligne. Reessayez avec une connexion.')),
        }));
        setData((current) => current
          ? (() => {
              const signals = { ...current.signals };
              if (previousSignal) {
                signals[control.field] = previousSignal;
              } else {
                delete signals[control.field];
              }
              return { ...current, signals };
            })()
          : current);
        return;
      }

      if (item && !isRetryable(error)) {
        await removePointOperatorQueueItem(item.id).catch(() => undefined);
        setControlStatus((current) => ({ ...current, [control.field]: 'error' }));
        setControlErrors((current) => ({
          ...current,
          [control.field]: errorMessage(error, t('This update was rejected. Status reloaded.', 'Cette mise a jour a ete refusee. Statut recharge.')),
        }));
        await load();
        return;
      }

      setControlStatus((current) => ({ ...current, [control.field]: 'pending' }));
      setControlErrors((current) => ({
        ...current,
        [control.field]: t('Pending sync. Keep the app online to finish.', 'Synchronisation en attente. Gardez l app en ligne.'),
      }));
      await refreshQueue();
    }
  };

  const point = data?.point;
  const pointDetails = (point?.details ?? {}) as Record<string, unknown>;
  const pointName =
    typeof pointDetails.name === 'string' ? pointDetails.name
    : typeof pointDetails.siteName === 'string' ? pointDetails.siteName
    : point?.pointId ?? t('Verified point', 'Point verifie');
  const locality = typeof pointDetails.locality === 'string'
    ? pointDetails.locality
    : `${point?.location.latitude.toFixed(4) ?? '0.0000'}, ${point?.location.longitude.toFixed(4) ?? '0.0000'}`;

  return (
    <div data-testid="screen-point-operator-status" className="screen-shell bg-page">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-[calc(var(--safe-top)+12px)] backdrop-blur">
        <p className="micro-label text-terra">{t('Point Operator', 'Operateur de point')}</p>
        <h1 className="mt-1 text-xl font-black text-navy">{t('Status', 'Statut')}</h1>
      </div>

      <div className="space-y-4 p-4 pb-24 sm:p-6 sm:pb-24">
        {isLoading && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
            {t('Loading verified point...', 'Chargement du point verifie...')}
          </div>
        )}

        {loadError && (
          <div className="rounded-2xl border border-terra/30 bg-terra-wash p-4">
            <div className="flex gap-3 text-sm font-semibold text-terra-dark">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{loadError}</span>
            </div>
            <button type="button" onClick={() => void load()} className="btn-primary mt-3 min-h-[48px] w-full">
              {t('Retry', 'Reessayer')}
            </button>
          </div>
        )}

        {data && point && (
          <>
            <section className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-navy-wash">
                  {point.photoUrl ? (
                    <img src={point.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-black text-navy">
                      {pointName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-forest">
                    {categoryLabel(point.category, language)}
                  </div>
                  <h2 className="truncate text-base font-black text-ink">{pointName}</h2>
                  <p className="mt-1 text-xs font-medium text-gray-600">{locality}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {t('Freshness', 'Fraicheur')}: {relativeFreshness(point.updatedAt, language)}
                  </p>
                </div>
                <span className="rounded-full bg-forest-wash px-2.5 py-1 text-[10px] font-black uppercase text-forest">
                  {t('Verified', 'Verifie')}
                </span>
              </div>
            </section>

            <section className="space-y-3">
              {data.controls.length === 0 && (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
                  {t('No status controls are assigned to this point.', 'Aucun controle de statut n est assigne a ce point.')}
                </div>
              )}

              {data.controls.map((control) => {
                const signal = data.signals[control.field];
                const label = language === 'fr' ? control.labelFr : control.labelEn;
                const resolved = resolveOperatorSignalLabel(signal);
                const isOn = resolved === 'on';
                const pending = pendingFields.has(control.field) || controlStatus[control.field] === 'pending';
                const status = controlStatus[control.field] ?? (pending ? 'pending' : 'idle');
                const Icon = isOn ? ToggleRight : ToggleLeft;

                return (
                  <article key={control.field} className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-ink">{label}</h3>
                        <p className="mt-1 text-xs font-semibold text-gray-600">
                          {resolved === 'unknown'
                            ? t('Unknown', 'Inconnu')
                            : isOn
                              ? t('On', 'Oui')
                              : t('Off', 'Non')}
                          {' - '}
                          {signal?.isExpired
                            ? t('Expired', 'Expire')
                            : t('Expires', 'Expire') + ` ${relativeFreshness(signal?.expiresAt, language)}`}
                        </p>
                      </div>
                      <Icon size={28} className={isOn ? 'text-forest' : 'text-gray-400'} aria-hidden="true" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => void setSignalValue(control, true)}
                        disabled={status === 'saving'}
                        className={`min-h-[52px] rounded-2xl border px-3 text-sm font-black transition-colors ${
                          isOn
                            ? 'border-forest bg-forest text-white'
                            : 'border-gray-200 bg-white text-gray-800 active:bg-gray-50'
                        } disabled:opacity-60`}
                      >
                        {t('On', 'Oui')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void setSignalValue(control, false)}
                        disabled={status === 'saving'}
                        className={`min-h-[52px] rounded-2xl border px-3 text-sm font-black transition-colors ${
                          resolved === 'off'
                            ? 'border-terra bg-terra text-white'
                            : 'border-gray-200 bg-white text-gray-800 active:bg-gray-50'
                        } disabled:opacity-60`}
                      >
                        {t('Off', 'Non')}
                      </button>
                    </div>

                    <div className="mt-3 flex min-h-[24px] items-center gap-2 text-xs font-semibold">
                      {status === 'saving' && <RefreshCw size={14} className="animate-spin text-navy" />}
                      {status === 'saved' && <CheckCircle2 size={14} className="text-forest" />}
                      {status === 'pending' && <Clock size={14} className="text-gold-dark" />}
                      {status === 'error' && <AlertTriangle size={14} className="text-terra" />}
                      <span className={status === 'error' ? 'text-terra-dark' : 'text-gray-600'}>
                        {status === 'saving'
                          ? t('Syncing', 'Synchronisation')
                          : status === 'saved'
                            ? t('Saved', 'Enregistre')
                            : pending
                              ? t('Pending sync', 'Synchronisation en attente')
                              : controlErrors[control.field] || `${t('Updated', 'Mis a jour')} ${relativeFreshness(signalTime(signal), language)}`}
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PointOperatorStatus;
