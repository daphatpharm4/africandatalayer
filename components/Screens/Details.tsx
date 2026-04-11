import React from 'react';
import type { DataPoint } from '../../types';
import {
  AlertTriangle,
  Clock,
  MapPin,
  Navigation2,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
import { categoryLabel as getCategoryLabel, LEGACY_CATEGORY_MAP, VERTICALS } from '../../shared/verticals';
import { ENRICH_FIELD_CATALOG, getEnrichFieldLabel } from '../../shared/enrichFieldCatalog';
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

const Details: React.FC<Props> = ({ point, onBack, onEnrich, onAddNew, isAuthenticated, onAuth, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  if (!point) return null;

  const verticalId = LEGACY_CATEGORY_MAP[point.type] ?? point.type;
  const vertical = VERTICALS[verticalId];
  const categoryLabelText = vertical ? getCategoryLabel(verticalId, language) : point.type;

  const translatedGap = (gap: string) => getEnrichFieldLabel(gap, language);

  // Resolve a field value from typed DataPoint properties or the generic details bag
  const resolveFieldValue = (fieldKey: string): unknown => {
    const typed = point[fieldKey as keyof DataPoint];
    if (typed !== undefined && typed !== null) return typed;
    return (point.details as Record<string, unknown> | undefined)?.[fieldKey];
  };

  // Format a raw value for display based on field kind
  const formatFieldValue = (raw: unknown, fieldKey: string): string | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const spec = ENRICH_FIELD_CATALOG[fieldKey];

    if (typeof raw === 'boolean') return raw ? t('Yes', 'Oui') : t('No', 'Non');
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).join(', ');
      return joined || undefined;
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      // map_value fields like pricesByFuel, merchantIdByProvider
      const entries = Object.entries(raw as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${v}`);
      return entries.length ? entries.join(', ') : undefined;
    }
    if (typeof raw === 'number' && spec) {
      // Add unit hints for specific fields
      if (fieldKey === 'price' || fieldKey === 'fuelPrice') return `${raw} XAF/L`;
      return String(raw);
    }

    // single_select: try to find the option label
    if (spec?.kind === 'single_select' && spec.options && typeof raw === 'string') {
      const opt = spec.options.find((o) => o.value === raw);
      if (opt) return language === 'fr' ? opt.labelFr : opt.labelEn;
    }

    return String(raw);
  };

  // Build dynamic known fields from the vertical's enrichable fields
  const knownFields: Array<{ label: string; value?: string }> = [
    { label: t('Category', 'Catégorie'), value: categoryLabelText },
    { label: t('Address', 'Adresse'), value: point.location },
  ];

  if (vertical) {
    for (const fieldKey of vertical.enrichableFields) {
      const raw = resolveFieldValue(fieldKey);
      const formatted = formatFieldValue(raw, fieldKey);
      if (formatted) {
        knownFields.push({
          label: getEnrichFieldLabel(fieldKey, language),
          value: formatted,
        });
      }
    }
  }

  const visibleKnownFields = knownFields.filter((field) => field.value !== undefined && field.value !== '');
  const gaps = point.gaps ?? [];

  // Staleness detection: per-vertical threshold
  const stalenessThreshold = vertical?.stalenessThresholdDays ?? 7;
  const staleDays = (() => {
    const raw = point.updatedAtIso ?? point.lastUpdated;
    if (!raw) return 0;
    const updated = new Date(raw);
    if (isNaN(updated.getTime())) return 0;
    const diff = Date.now() - updated.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  })();
  const isStale = staleDays >= stalenessThreshold;
  const staleTier: 'fresh' | 'stale' | 'warning' | 'critical' = !isStale
    ? 'fresh'
    : staleDays >= stalenessThreshold * 4 ? 'critical'
    : staleDays >= stalenessThreshold * 2 ? 'warning'
    : 'stale';
  const staleXP = staleTier === 'critical' ? 25 : staleTier === 'warning' ? 15 : 10;

  return (
    <div className="flex flex-col h-full bg-page overflow-y-auto overflow-x-hidden no-scrollbar">
      <ScreenHeader
        title={point.name}
        onBack={onBack}
        language={language}
        trailing={<span className="micro-label rounded-full bg-navy-wash px-2 py-1 text-navy">{categoryLabelText}</span>}
      />

      <div className="p-4 pb-36 space-y-4">
        <div className="h-44 rounded-2xl bg-gray-200 overflow-hidden relative shadow-sm border border-gray-100">
          {point.photoUrl ? (
            <img
              src={point.photoUrl}
              loading="lazy"
              className="w-full h-full object-cover"
              alt={t('User submitted photo', 'Photo soumise par utilisateur')}
            />
          ) : (
            <div
              className="w-full h-full bg-gradient-to-br from-navy-light via-navy-border to-navy-border"
              role="img"
              aria-label={t('No photo available', 'Aucune photo disponible')}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-2 bg-navy rounded-full border-2 border-white shadow-xl">
              <VerticalIcon name={vertical?.icon ?? 'pill'} size={20} className="text-white" />
            </div>
          </div>
          <button className="absolute bottom-3 right-3 p-2 bg-white rounded-xl shadow-md border border-gray-100 text-navy">
            <Navigation2 size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <span className="micro-label mb-2 flex items-center text-gray-500">
              <ShieldCheck size={10} className="mr-1" />
              {t('Trust Score', 'Score de confiance')}
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 tracking-tight">{point.trustScore}%</span>
              <span className="text-xs font-medium text-gray-500">{t('Community confidence', 'Confiance de la communauté')}</span>
            </div>
          </div>

          {isStale ? (
            <button
              onClick={isAuthenticated ? onEnrich : onAuth}
              className={`card p-4 text-left border-2 active:scale-[0.97] transition-transform stale-enter ${
                staleTier === 'critical'
                  ? 'border-danger/50 bg-red-50'
                  : staleTier === 'warning'
                    ? 'border-amber/50 bg-amber-wash'
                    : 'border-gold/60 bg-gold-wash'
              }`}
            >
              <span className="micro-label mb-2 flex items-center text-gray-500">
                <RefreshCw size={10} className="mr-1" />
                {t('Stale', 'Ancien')}
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-navy tracking-tight">
                  {t(`${staleDays}d old`, `${staleDays}j`)}
                </span>
                <span className="text-xs font-semibold text-terra">
                  {t('Refresh this point to re-verify it', 'Actualisez ce point pour le revalider')} +{staleXP} XP
                </span>
              </div>
            </button>
          ) : (
            <div className="card p-4">
              <span className="micro-label mb-2 flex items-center text-gray-500">
                <Clock size={10} className="mr-1" />
                {t('Updated', 'Mis à jour')}
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{point.lastUpdated}</span>
                <span className="text-xs font-medium text-gray-500">{t('Live sync status', 'État de synchro en direct')}</span>
              </div>
            </div>
          )}
        </div>

        {staleTier === 'critical' && (
          <button
            onClick={isAuthenticated ? onEnrich : onAuth}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-red-50 border-2 border-danger/50 flex items-center space-x-3 text-left active:scale-[0.98] transition-transform stale-enter"
          >
            <AlertTriangle size={18} className="text-danger shrink-0" />
            <span className="flex-1 text-sm font-bold text-danger">
              {t(
                'Critical: this data may be inaccurate',
                'Critique : ces données sont peut-être inexactes',
              )}
            </span>
            <span className="text-xs font-bold text-danger/70">+{staleXP} XP</span>
          </button>
        )}

        <div className="card p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{t('Known Fields', 'Champs connus')}</h4>
          {visibleKnownFields.length === 0 && (
            <p className="text-xs text-gray-500">{t('No known fields captured yet.', 'Aucun champ connu capturé pour le moment.')}</p>
          )}
          {visibleKnownFields.map((field) => (
            <div key={field.label} className="grid gap-1 border-b border-gray-50 pb-2 text-xs sm:grid-cols-[minmax(0,0.75fr),minmax(0,1fr)] sm:items-start">
              <span className="text-gray-500">{field.label}</span>
              <span className="font-semibold text-gray-900 sm:text-right">{String(field.value)}</span>
            </div>
          ))}
        </div>

        <div className="bg-terra-wash p-4 rounded-2xl border border-terra-wash shadow-sm space-y-2">
          <h4 className="text-sm font-bold text-terra-dark">{t('Gaps To Enrich', 'Lacunes à enrichir')}</h4>
          {gaps.length === 0 ? (
            <p className="text-xs text-terra-dark">
              {t(
                'No missing fields. You can still update this point if something changed.',
                'Aucun champ manquant. Vous pouvez quand même mettre ce point à jour si quelque chose a changé.',
              )}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {gaps.map((gap) => (
                <span key={gap} className="micro-label px-2 py-1 rounded-full bg-white text-terra-dark border border-terra-wash">
                  {translatedGap(gap)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 flex items-start space-x-4">
          <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
            <MapPin size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{t('Geo-anchored location', 'Localisation géo-ancrée')}</span>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{point.location}</p>
          </div>
        </div>

      </div>

      <div className="fixed bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom)+0.75rem)] left-0 right-0 z-40 mx-auto flex w-full max-w-md flex-col gap-3 px-4">
        <button
          onClick={isAuthenticated ? onEnrich : onAuth}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-navy px-4 py-4 text-base font-semibold text-white shadow-lg active:scale-95 transition-all"
        >
          <ShieldCheck size={20} />
          <span>
            {isAuthenticated
              ? gaps.length === 0
                ? t('Update this point', 'Mettre ce point à jour')
                : t('Enrich this point', 'Enrichir ce point')
              : t('Sign in to enrich', 'Connectez-vous pour enrichir')}
          </span>
        </button>
        <button
          onClick={isAuthenticated ? onAddNew : onAuth}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terra px-4 py-4 text-base font-semibold text-white shadow-lg active:scale-95 transition-all"
        >
          <PlusCircle size={20} />
          <span>{t('Add a new point', 'Ajouter un nouveau point')}</span>
        </button>
      </div>
    </div>
  );
};

export default Details;
