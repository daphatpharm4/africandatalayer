import React from 'react';
import type { DataPoint } from '../../types';
import {
  AlertTriangle,
  Camera,
  Clock,
  CheckCircle,
  MapPin,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import TrustBadge from '../shared/TrustBadge';
import {
  categoryLabel as getCategoryLabel,
  LEGACY_CATEGORY_MAP,
  VERTICALS,
} from '../../shared/verticals';
import {
  ENRICH_FIELD_CATALOG,
  getEnrichFieldLabel,
} from '../../shared/enrichFieldCatalog';
import ScreenHeader from '../shared/ScreenHeader';

interface Props {
  point: DataPoint | null;
  onBack: () => void;
  onEnrich: () => void;
  onAddNew: () => void;
  isAuthenticated: boolean;
  onAuth: () => void;
  language: 'en' | 'fr';
}

const DETAIL_TONE_BY_VERTICAL: Record<string, { chip: string; photo: string }> = {
  pharmacy: {
    chip: 'bg-forest-wash text-forest-dark',
    photo: 'border-forest/20 bg-gradient-to-br from-forest-wash to-forest/10',
  },
  mobile_money: {
    chip: 'bg-navy-wash text-navy',
    photo: 'border-navy/20 bg-gradient-to-br from-navy-wash to-navy/10',
  },
  fuel_station: {
    chip: 'bg-terra-wash text-terra-dark',
    photo: 'border-terra/20 bg-gradient-to-br from-terra-wash to-terra/10',
  },
  alcohol_outlet: {
    chip: 'bg-red-50 text-danger',
    photo: 'border-danger/20 bg-gradient-to-br from-red-50 to-danger/10',
  },
  billboard: {
    chip: 'bg-gold-wash text-amber-900',
    photo: 'border-gold/30 bg-gradient-to-br from-gold-wash to-gold/10',
  },
  transport_road: {
    chip: 'bg-gray-100 text-gray-700',
    photo: 'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100',
  },
  census_proxy: {
    chip: 'bg-gray-100 text-gray-700',
    photo: 'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100',
  },
};

function formatRelativeTime(iso: string | undefined, language: 'en' | 'fr'): string {
  const fallback = language === 'fr' ? 'Inconnu' : 'Unknown';
  if (!iso) return fallback;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return fallback;

  const formatter = new Intl.RelativeTimeFormat(language === 'fr' ? 'fr' : 'en', { numeric: 'auto' });
  const diffMs = timestamp - Date.now();
  const abs = Math.abs(diffMs);
  if (abs < 60_000) return language === 'fr' ? 'à l’instant' : 'just now';
  if (abs < 3_600_000) return formatter.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return formatter.format(Math.round(diffMs / 3_600_000), 'hour');
  return formatter.format(Math.round(diffMs / 86_400_000), 'day');
}

const CompanyRecordDetails: React.FC<{
  point: DataPoint;
  onBack: () => void;
  onUpdate: () => void;
  language: 'en' | 'fr';
}> = ({ point, onBack, onUpdate, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const record = point.platformRecord;
  if (!record) return null;
  const capturedAt = record.evidence.capturedAt ?? record.createdAt;
  // One section per survey/update, newest first. Falls back to the single
  // representative record when no chain history is present.
  const chain = point.platformRecordChain && point.platformRecordChain.length > 0
    ? point.platformRecordChain
    : [record];

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? t('Yes', 'Oui') : t('No', 'Non');
    if (Array.isArray(value)) return value.map(formatValue).join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div data-testid="screen-company-record-details" className="screen-shell">
      <ScreenHeader title={record.recordTypeLabel} onBack={onBack} language={language}
        trailing={<span className="micro-label rounded-full bg-forest-wash px-2.5 py-1 text-forest-dark">{t('Approved', 'Approuvée')}</span>} />
      <div className="space-y-5 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <section className="card p-5">
          <p className="micro-label text-forest">{t('Company record', 'Donnée entreprise')}</p>
          <h1 className="mt-1 text-xl font-bold text-ink">{point.name || record.recordTypeLabel}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {t('Captured', 'Capturée')} {new Date(capturedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm leading-6 text-ink-muted">
            <Clock size={14} />
            {t('Updated', 'Mis à jour')} {formatRelativeTime(record.reviewedAt ?? record.createdAt, language)}
          </p>
        </section>

        {chain.length > 1 && (
          <p className="px-1 text-sm font-semibold text-ink-muted">
            {chain.length} {t('updates on this point', 'mises à jour sur ce point')}
          </p>
        )}

        {chain.map((entry, idx) => {
          const entryAt = entry.evidence.capturedAt ?? entry.createdAt;
          const isMulti = chain.length > 1;
          return (
            <section key={entry.id} className="card p-5">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <h2 className="text-sm font-semibold text-ink">
                  {isMulti
                    ? (idx === 0 ? t('Latest update', 'Dernière mise à jour') : `${t('Update', 'Mise à jour')} ${chain.length - idx}`)
                    : t('Submitted fields', 'Champs soumis')}
                </h2>
                <span className="micro-label text-ink-muted">
                  {new Date(entryAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Object.entries(entry.data).map(([key, value]) => (
                  <div key={key} className="min-w-0 border-b border-gray-100 pb-3">
                    <dt className="micro-label text-ink-muted">{key.replaceAll('_', ' ')}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 rounded-2xl bg-navy-wash/50 p-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-ink-muted"><MapPin size={14} />{t('Field evidence', 'Justificatifs terrain')}</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="micro-label text-ink-muted">GPS</dt><dd className="mt-1 text-ink">{entry.evidence.gps ? `${entry.evidence.gps.latitude.toFixed(6)}, ${entry.evidence.gps.longitude.toFixed(6)}${entry.evidence.gps.accuracyMeters !== undefined ? ` · ±${Math.round(entry.evidence.gps.accuracyMeters)} m` : ''}` : t('Not captured', 'Non capturé')}</dd></div>
                  {entry.evidence.notes && <div><dt className="micro-label text-ink-muted">{t('Collector notes', 'Notes du collecteur')}</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-ink">{entry.evidence.notes}</dd></div>}
                </dl>
                {entry.evidence.photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {entry.evidence.photos.map((photo, index) => (
                      <img key={`${entry.id}-photo-${index}`} src={photo} loading="lazy" decoding="async"
                        alt={t(`Field evidence photo ${index + 1}`, `Photo terrain ${index + 1}`)} className="aspect-square w-full rounded-2xl border border-navy-border object-cover" />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {record.status === 'approved' && (
          <section className="rounded-2xl border border-forest/20 bg-forest-wash p-4">
            <p className="micro-label text-forest-dark">{t('Field point', 'Point terrain')}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {t(
                'Capture fresh evidence for this point using your company form.',
                'Capturez de nouvelles preuves pour ce point avec le formulaire de votre entreprise.',
              )}
            </p>
            <button
              type="button"
              data-testid="company-point-update"
              onClick={onUpdate}
              className="btn-cta mt-4 min-h-12 w-full"
            >
              <RefreshCw size={19} />
              <span>{t('Update this point', 'Mettre à jour ce point')}</span>
            </button>
          </section>
        )}
      </div>
    </div>
  );
};

const Details: React.FC<Props> = ({
  point,
  onBack,
  onEnrich,
  onAddNew,
  isAuthenticated,
  onAuth,
  language,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  if (!point) return null;
  if (point.platformRecord) {
    return (
      <CompanyRecordDetails
        point={point}
        onBack={onBack}
        onUpdate={isAuthenticated ? onEnrich : onAuth}
        language={language}
      />
    );
  }

  const verticalId = LEGACY_CATEGORY_MAP[point.type] ?? point.type;
  const vertical = VERTICALS[verticalId];
  const categoryLabelText = vertical
    ? getCategoryLabel(verticalId, language)
    : point.type;
  const translatedGap = (gap: string) => getEnrichFieldLabel(gap, language);
  const gaps = point.gaps ?? [];
  const hasPhoto = typeof point.photoUrl === 'string' && point.photoUrl.trim() !== '';
  const contributorTier = typeof point.contributorTrust === 'string'
    ? point.contributorTrust.toLowerCase()
    : undefined;
  const contributorTierBadge =
    contributorTier === 'gold' ||
    contributorTier === 'silver' ||
    contributorTier === 'bronze'
      ? contributorTier
      : null;
  const detailTone = DETAIL_TONE_BY_VERTICAL[verticalId] ?? DETAIL_TONE_BY_VERTICAL.mobile_money;
  const availabilityLabel =
    point.availability === 'High'
      ? t('High', 'Élevée')
      : point.availability === 'Low'
        ? t('Low', 'Faible')
        : t('Out', 'Rupture');
  const availabilityClassName =
    point.availability === 'High'
      ? 'bg-forest-wash text-forest-dark'
      : point.availability === 'Low'
        ? 'bg-gold-wash text-amber-900'
        : 'bg-red-50 text-danger';
  const operatorSignals = Object.values(point.operatorSignals ?? {}).sort((a, b) => a.field.localeCompare(b.field));

  const resolveFieldValue = (fieldKey: string): unknown => {
    const operatorSignal = point.operatorSignals?.[fieldKey];
    if (operatorSignal && !operatorSignal.isExpired && operatorSignal.value !== null) {
      return operatorSignal.value;
    }
    const typed = point[fieldKey as keyof DataPoint];
    if (typed !== undefined && typed !== null) return typed;
    return (point.details as Record<string, unknown> | undefined)?.[fieldKey];
  };

  const gpsCoordinates = point.coordinates;
  const gpsAccuracy = (() => {
    const raw =
      resolveFieldValue('gpsAccuracyMeters') ??
      resolveFieldValue('gpsAccuracyM') ??
      resolveFieldValue('accuracy');
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  })();
  const gpsReadout = gpsCoordinates
    ? `${Math.abs(gpsCoordinates.latitude).toFixed(4)}°${gpsCoordinates.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(gpsCoordinates.longitude).toFixed(4)}°${gpsCoordinates.longitude >= 0 ? 'E' : 'W'} · ±${Math.round(gpsAccuracy ?? 5)}m`
    : point.location;
  const gpsTitle = gpsCoordinates
    ? t('GPS Validated', 'GPS validé')
    : t('GPS location', 'Localisation GPS');
  const primaryCtaLabel = !isAuthenticated
    ? t('Sign in to contribute', 'Connectez-vous pour contribuer')
    : point.platformEnrichmentTarget
      ? gaps.length === 0
        ? t('Update this point', 'Mettre à jour ce point')
        : t('Enrich this point', 'Enrichir ce point')
    : gaps.length === 0
      ? t('Update this point · +15 XP', 'Mettre à jour · +15 XP')
      : t('Complete this point · +15 XP', 'Compléter · +15 XP');

  const formatFieldValue = (
    raw: unknown,
    fieldKey: string,
  ): string | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const spec = ENRICH_FIELD_CATALOG[fieldKey];

    if (typeof raw === 'boolean') return raw ? t('Yes', 'Oui') : t('No', 'Non');
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).join(', ');
      return joined || undefined;
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const entries = Object.entries(raw as Record<string, unknown>)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}: ${value}`);
      return entries.length > 0 ? entries.join(', ') : undefined;
    }
    if (typeof raw === 'number' && spec) {
      if (fieldKey === 'price' || fieldKey === 'fuelPrice') {
        return `${raw} XAF/L`;
      }
      return String(raw);
    }
    if (
      spec?.kind === 'single_select' &&
      spec.options &&
      typeof raw === 'string'
    ) {
      const option = spec.options.find((entry) => entry.value === raw);
      if (option) return language === 'fr' ? option.labelFr : option.labelEn;
    }
    return String(raw);
  };

  const infoRows: Array<{
    key: string;
    label: string;
    value: React.ReactNode;
  }> = [];

  const addInfoRow = (key: string, label: string, value: React.ReactNode) => {
    if (value === undefined || value === null || value === '') return;
    infoRows.push({ key, label, value });
  };

  addInfoRow('location', t('Location', 'Localisation'), point.location);
  addInfoRow('last-updated', t('Last updated', 'Dernière mise à jour'), point.lastUpdated);
  addInfoRow('trust-score', t('Trust score', 'Score de confiance'), `${point.trustScore} / 100`);

  if (contributorTierBadge) {
    addInfoRow(
      'contributor-tier',
      t('Contributor tier', 'Niveau de contributeur'),
      <TrustBadge tier={contributorTierBadge} language={language} />,
    );
  } else if (point.contributorTrust) {
    addInfoRow(
      'contributor-tier',
      t('Contributor tier', 'Niveau de contributeur'),
      point.contributorTrust,
    );
  }

  if (typeof point.price === 'number') {
    addInfoRow(
      'price',
      t('Price', 'Prix'),
      `${point.price.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} ${point.currency ?? 'XAF'}`,
    );
  }

  if (vertical) {
    for (const fieldKey of vertical.enrichableFields) {
      if (infoRows.some((row) => row.key === fieldKey)) continue;
      const formatted = formatFieldValue(resolveFieldValue(fieldKey), fieldKey);
      if (formatted) {
        addInfoRow(fieldKey, getEnrichFieldLabel(fieldKey, language), formatted);
      }
    }
  }

  const stalenessThreshold = vertical?.stalenessThresholdDays ?? 7;
  const staleDays = (() => {
    const raw = point.updatedAtIso ?? point.lastUpdated;
    if (!raw) return 0;
    const updated = new Date(raw);
    if (Number.isNaN(updated.getTime())) return 0;
    return Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
  })();
  const isStale = staleDays >= stalenessThreshold;
  const staleTier: 'fresh' | 'stale' | 'warning' | 'critical' = !isStale
    ? 'fresh'
    : staleDays >= stalenessThreshold * 4
      ? 'critical'
      : staleDays >= stalenessThreshold * 2
        ? 'warning'
        : 'stale';
  const staleXP =
    staleTier === 'critical' ? 25 : staleTier === 'warning' ? 15 : 10;
  const freshnessValue = isStale
    ? t(`${staleDays}d old`, `${staleDays}j`)
    : point.lastUpdated;
  const freshnessCaption = isStale
    ? t(
        'Needs a fresh field check',
        'Demande une nouvelle vérification terrain',
      )
    : t('Recently verified on the ground', 'Récemment vérifié sur le terrain');
  const freshnessTone =
    staleTier === 'critical'
      ? 'border-danger/20 bg-red-50 text-danger'
      : staleTier === 'warning'
        ? 'border-amber/20 bg-amber-wash text-amber-700'
        : staleTier === 'stale'
          ? 'border-gold/30 bg-gold-wash text-terra-dark'
          : 'border-forest/15 bg-forest-wash text-forest';

  return (
    <div data-testid="screen-details" className="screen-shell">
      <ScreenHeader
        title={categoryLabelText}
        onBack={onBack}
        language={language}
        trailing={
          <span className="micro-label rounded-full bg-navy-wash px-2.5 py-1 text-navy">
            {categoryLabelText}
          </span>
        }
      />
      <div className="mx-4 -mt-px h-1 rounded-b-full bg-gradient-to-r from-gold via-gold to-terra/70" />

      <div
        className="space-y-4 px-4 pb-10 pt-4"
        style={{ paddingBottom: 'calc(var(--floating-cta-offset) + 8rem)' }}
      >
        {hasPhoto ? (
          <img
            src={point.photoUrl}
            loading="lazy"
            className="h-[200px] w-full rounded-[20px] object-cover"
            alt={t('User submitted photo', 'Photo soumise par utilisateur')}
          />
        ) : (
          <div className={`flex h-[200px] flex-col items-center justify-center gap-2 rounded-[20px] border ${detailTone.photo}`}>
            <Camera size={36} className="text-gray-400" aria-hidden="true" />
            <span className="text-xs font-medium text-gray-400">
              {t('Field photo', 'Photo terrain')}
            </span>
          </div>
        )}

        <section className="card-soft p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 text-lg font-bold leading-tight text-ink-dark">
                {point.name || categoryLabelText}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`micro-label rounded-full px-2 py-0.5 ${detailTone.chip}`}>
                  {categoryLabelText}
                </span>
                {point.verified && (
                  <span className="micro-label rounded-full bg-forest-wash px-2 py-0.5 text-forest-dark">
                    {t('Verified', 'Vérifié')}
                  </span>
                )}
              </div>
            </div>
            <span className={`micro-label shrink-0 rounded-full px-2 py-0.5 ${availabilityClassName}`}>
              {availabilityLabel}
            </span>
          </div>
          {infoRows.length > 0 ? (
            <dl className="flex flex-col gap-2.5">
              {infoRows.map((row, index) => (
                <div
                  key={row.key}
                  className={`flex flex-col gap-1 pb-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${index < infoRows.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <dt className="min-w-0 text-xs font-medium text-gray-400">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 text-left text-[13px] font-semibold text-ink-dark break-words sm:flex-1 sm:text-right">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm leading-6 text-gray-500">
              {t(
                'No known fields captured yet.',
                'Aucun champ connu capturé pour le moment.',
              )}
            </p>
          )}
        </section>

        {operatorSignals.length > 0 && (
          <section className="card-soft p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-forest" aria-hidden="true" />
              <h3 className="text-sm font-bold text-ink-dark">
                {t('Point operator provenance', 'Provenance opérateur du point')}
              </h3>
            </div>
            <div className="space-y-3">
              {operatorSignals.map((signal) => {
                const isUnknown = signal.isExpired || signal.value === null;
                const valueLabel = isUnknown
                  ? t('Unknown', 'Inconnu')
                  : signal.value
                    ? t('Yes', 'Oui')
                    : t('No', 'Non');
                const freshness = isUnknown
                  ? t('Unknown', 'Inconnu')
                  : formatRelativeTime(signal.reportedAt, language);
                return (
                  <div key={signal.field} className="rounded-2xl border border-forest/10 bg-forest-wash/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-dark">
                          {getEnrichFieldLabel(signal.field, language)}
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-gray-600">
                          {t('Reported by point operator', 'Signalé par l’opérateur du point')}
                          {' · '}
                          {freshness}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        isUnknown ? 'bg-white text-gray-500' : signal.value ? 'bg-forest text-white' : 'bg-terra text-white'
                      }`}>
                        {valueLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-terra/10 bg-terra-wash px-5 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="micro-label-wide text-terra/70">
                {t('Missing info', 'Infos manquantes')}
              </p>
            </div>
            {isStale && (
              <div className="rounded-full bg-white px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-terra">
                +{staleXP} XP
              </div>
            )}
          </div>

          {gaps.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-terra-dark">
              {t(
                'No missing fields. You can still update this point if something changed.',
                'Aucun champ manquant. Vous pouvez quand même mettre ce point à jour si quelque chose a changé.',
              )}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {gaps.map((gap) => (
                <span
                  key={gap}
                  className="rounded-full border border-terra/15 bg-white px-3 py-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-terra-dark"
                >
                  {translatedGap(gap)}
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="card-soft mb-3 flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-wash">
            <MapPin size={18} className="text-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink-dark">
              {gpsTitle}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-400">
              {gpsReadout}
            </div>
          </div>
          {gpsCoordinates && <CheckCircle size={18} className="shrink-0 text-forest" />}
        </div>

        <section className="grid grid-cols-2 gap-3">
          <div className="card px-4 py-4">
            <div className="flex items-center gap-2 text-gray-500">
              <ShieldCheck size={14} />
              <span className="micro-label text-gray-400">
                {t('Trust score', 'Score de confiance')}
              </span>
            </div>
            <p className="mt-3 text-[1.45rem] font-bold tracking-tight text-gray-900">
              {point.trustScore}%
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {t('Community confidence', 'Confiance de la communauté')}
            </p>
          </div>

          <div className={`card border px-4 py-4 ${freshnessTone}`}>
            <div className="flex items-center gap-2">
              {isStale ? <RefreshCw size={14} /> : <Clock size={14} />}
              <span className="micro-label text-current">
                {t('Freshness', 'Fraîcheur')}
              </span>
            </div>
            <p className="mt-3 text-[1.3rem] font-bold tracking-tight text-gray-900">
              {freshnessValue}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {freshnessCaption}
            </p>
          </div>
        </section>

        {staleTier === 'critical' && (
          <button
            onClick={isAuthenticated ? onEnrich : onAuth}
            className="flex w-full items-center gap-3 rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-left transition-transform active:scale-95"
          >
            <AlertTriangle size={18} className="shrink-0 text-danger" />
            <span className="flex-1 text-sm font-semibold leading-5 text-danger">
              {t(
                'Critical: this data may be inaccurate. Re-verify it before relying on it.',
                'Critique : ces données peuvent être inexactes. Revalidez-les avant de vous y fier.',
              )}
            </span>
          </button>
        )}

      </div>

      <div
        className="fixed left-0 right-0 z-40 mx-auto flex w-full max-w-md md:max-w-lg flex-col gap-3 px-4"
        style={{ bottom: 'var(--floating-cta-offset)' }}
      >
        <button
          type="button"
          onClick={isAuthenticated ? onEnrich : onAuth}
          className="btn-cta w-full"
        >
          <ShieldCheck size={20} />
          <span>{primaryCtaLabel}</span>
        </button>
        <button
          type="button"
          onClick={isAuthenticated ? onAddNew : onAuth}
          className="btn-ghost w-full"
        >
          <PlusCircle size={20} />
          <span>{t('Add a new point', 'Ajouter un nouveau point')}</span>
        </button>
      </div>
    </div>
  );
};

export default Details;
