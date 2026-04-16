import React from 'react';
import type { DataPoint } from '../../types';
import {
  AlertTriangle,
  Camera,
  Clock,
  MapPin,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
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

  const verticalId = LEGACY_CATEGORY_MAP[point.type] ?? point.type;
  const vertical = VERTICALS[verticalId];
  const categoryLabelText = vertical
    ? getCategoryLabel(verticalId, language)
    : point.type;
  const translatedGap = (gap: string) => getEnrichFieldLabel(gap, language);

  const resolveFieldValue = (fieldKey: string): unknown => {
    const typed = point[fieldKey as keyof DataPoint];
    if (typed !== undefined && typed !== null) return typed;
    return (point.details as Record<string, unknown> | undefined)?.[fieldKey];
  };

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
      if (fieldKey === 'price' || fieldKey === 'fuelPrice')
        return `${raw} XAF/L`;
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

  const knownFields: Array<{ label: string; value?: string }> = [
    { label: t('Category', 'Catégorie'), value: categoryLabelText },
    { label: t('Address', 'Adresse'), value: point.location },
  ];

  if (vertical) {
    for (const fieldKey of vertical.enrichableFields) {
      const formatted = formatFieldValue(resolveFieldValue(fieldKey), fieldKey);
      if (formatted) {
        knownFields.push({
          label: getEnrichFieldLabel(fieldKey, language),
          value: formatted,
        });
      }
    }
  }

  const visibleKnownFields = knownFields.filter(
    (field) => field.value !== undefined && field.value !== '',
  );
  const gaps = point.gaps ?? [];

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
        <section className="card-pill border-gray-100 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="micro-label-wide text-gray-400">
                {t('What we know', 'Ce qu\'on sait')}
              </p>
              {point.name && point.name !== categoryLabelText && (
                <h2 className="mt-2 text-base font-bold leading-tight text-gray-900">
                  {point.name}
                </h2>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-wash text-navy">
              <VerticalIcon name={vertical?.icon ?? 'pill'} size={16} />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {visibleKnownFields.length === 0 && (
              <p className="text-sm leading-6 text-gray-500">
                {t(
                  'No known fields captured yet.',
                  'Aucun champ connu capturé pour le moment.',
                )}
              </p>
            )}

            {visibleKnownFields.map((field, index) => (
              <div
                key={field.label}
                className={`space-y-1.5 ${index < visibleKnownFields.length - 1 ? 'border-b border-gray-100 pb-3' : ''}`}
              >
                <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  {field.label}
                </p>
                <p className="text-[0.97rem] font-semibold leading-6 text-gray-900">
                  {String(field.value)}
                </p>
              </div>
            ))}
          </div>
        </section>

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

        <section className="card flex items-start gap-3 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-navy-wash text-navy">
            <MapPin size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {t('GPS location', 'Localisation GPS')}
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {point.location}
            </p>
          </div>
        </section>

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

        {point.photoUrl && (
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Camera size={14} />
                <span className="micro-label text-gray-400">
                  {t('Field photo', 'Photo terrain')}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {t('Field photo', 'Photo terrain')}
              </span>
            </div>
            <img
              src={point.photoUrl}
              loading="lazy"
              className="h-40 w-full object-cover sm:h-52"
              alt={t('User submitted photo', 'Photo soumise par utilisateur')}
            />
          </section>
        )}
      </div>

      <div
        className="fixed left-0 right-0 z-40 mx-auto flex w-full max-w-md md:max-w-lg flex-col gap-3 px-4"
        style={{ bottom: 'var(--floating-cta-offset)' }}
      >
        <button
          onClick={isAuthenticated ? onEnrich : onAuth}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[1.35rem] bg-navy px-4 py-4 text-base font-semibold text-white shadow-[0_18px_32px_rgba(15,43,70,0.18)] transition-all active:scale-95"
        >
          <ShieldCheck size={20} />
          <span>
            {isAuthenticated
              ? gaps.length === 0
                ? t('Update this point', 'Mettre ce point à jour')
                : t('Complete this point', 'Compléter ce point')
              : t('Sign in to contribute', 'Connectez-vous pour contribuer')}
          </span>
        </button>
        <button
          onClick={isAuthenticated ? onAddNew : onAuth}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[1.35rem] bg-terra px-4 py-4 text-base font-semibold text-white shadow-[0_18px_32px_rgba(200,107,74,0.2)] transition-all active:scale-95"
        >
          <PlusCircle size={20} />
          <span>{t('Add a new point', 'Ajouter un nouveau point')}</span>
        </button>
      </div>
    </div>
  );
};

export default Details;
