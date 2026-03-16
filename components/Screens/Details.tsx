import React from 'react';
import type { DataPoint } from '../../types';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Navigation2,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
import { categoryLabel as getCategoryLabel, LEGACY_CATEGORY_MAP, VERTICALS } from '../../shared/verticals';
import { getEnrichFieldLabel } from '../../shared/enrichFieldCatalog';

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

  const knownFields: Array<{ label: string; value?: string | number | boolean }> = [
    { label: t('Category', 'Catégorie'), value: categoryLabelText },
    { label: t('Address', 'Adresse'), value: point.location },
    { label: t('Opening Hours', 'Heures d\'ouverture'), value: point.openingHours || point.hours },
    { label: t('Fuel Price', 'Prix carburant'), value: typeof point.price === 'number' ? `${point.price} XAF/L` : undefined },
    { label: t('Fuel Type', 'Type de carburant'), value: point.fuelType },
    { label: t('Providers', 'Opérateurs'), value: point.providers?.join(', ') },
    { label: t('Payments', 'Paiements'), value: point.paymentMethods?.join(', ') },
    { label: t('Fuel Available', 'Carburant disponible'), value: typeof point.hasFuelAvailable === 'boolean' ? (point.hasFuelAvailable ? t('Yes', 'Oui') : t('No', 'Non')) : undefined },
    { label: t('Open Now', 'Ouvert maintenant'), value: typeof point.isOpenNow === 'boolean' ? (point.isOpenNow ? t('Yes', 'Oui') : t('No', 'Non')) : undefined },
    { label: t('On-call Pharmacy', 'Pharmacie de garde'), value: typeof point.isOnDuty === 'boolean' ? (point.isOnDuty ? t('Yes', 'Oui') : t('No', 'Non')) : undefined }
  ];

  const visibleKnownFields = knownFields.filter((field) => field.value !== undefined && field.value !== '');
  const gaps = point.gaps ?? [];

  return (
    <div className="flex flex-col h-full bg-page overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-navy transition-colors" aria-label={t('Go back', 'Retour')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold truncate max-w-[200px]">{point.name}</h1>
        <span className="micro-label text-navy">{categoryLabelText}</span>
      </div>

      <div className="p-4 pb-24 space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase mb-2 flex items-center">
              <ShieldCheck size={10} className="mr-1" />
              {t('Trust Score', 'Score de confiance')}
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 tracking-tight">{point.trustScore}%</span>
              <span className="text-[11px] text-gray-500 font-medium">{t('Community confidence', 'Confiance de la communauté')}</span>
            </div>
          </div>
          <div className="card p-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase mb-2 flex items-center">
              <Clock size={10} className="mr-1" />
              {t('Updated', 'Mis à jour')}
            </span>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900 tracking-tight">{point.lastUpdated}</span>
              <span className="text-[11px] text-gray-500 font-medium">{t('Live sync state', 'État sync live')}</span>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{t('Known Fields', 'Champs connus')}</h4>
          {visibleKnownFields.length === 0 && (
            <p className="text-xs text-gray-500">{t('No known fields captured yet.', 'Aucun champ connu capturé pour le moment.')}</p>
          )}
          {visibleKnownFields.map((field) => (
            <div key={field.label} className="flex items-start justify-between text-xs border-b border-gray-50 pb-2">
              <span className="text-gray-500">{field.label}</span>
              <span className="font-semibold text-gray-900 text-right max-w-[60%]">{String(field.value)}</span>
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
            <span className="text-xs font-bold text-gray-900">{t('Geo-anchored location', 'Localisation géo-ancrée')}</span>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{point.location}</p>
          </div>
        </div>

      </div>

      <div className="fixed bottom-[calc(5rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 w-full max-w-[calc(28rem-2rem)] px-4 flex items-center space-x-2 z-40">
        <button
          onClick={isAuthenticated ? onEnrich : onAuth}
          className="flex-1 h-14 bg-navy text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 hover:bg-navy-dark active:scale-95 transition-all"
        >
          <ShieldCheck size={18} />
          <span>
            {isAuthenticated
              ? gaps.length === 0
                ? t('Update Point', 'Mettre à jour le point')
                : t('Enrich Point', 'Enrichir le point')
              : t('Sign In to Enrich', 'Connectez-vous pour enrichir')}
          </span>
        </button>
        <button
          onClick={isAuthenticated ? onAddNew : onAuth}
          className="flex-1 h-14 bg-terra text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 hover:bg-terra-dark active:scale-95 transition-all"
        >
          <PlusCircle size={18} />
          <span>{t('Add New', 'Ajouter nouveau')}</span>
        </button>
      </div>
    </div>
  );
};

export default Details;
