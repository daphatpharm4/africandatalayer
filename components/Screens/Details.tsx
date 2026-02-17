import React from 'react';
import { Category, DataPoint } from '../../types';
import {
  ArrowLeft,
  Clock,
  CreditCard,
  MapPin,
  Navigation2,
  Pill,
  PlusCircle,
  ShieldCheck,
  Zap
} from 'lucide-react';

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

  const categoryLabel =
    point.type === Category.PHARMACY
      ? t('Pharmacy', 'Pharmacie')
      : point.type === Category.FUEL
        ? t('Fuel Station', 'Station-service')
        : t('Mobile Money Kiosk', 'Kiosque mobile money');

  const translatedGap = (gap: string) => {
    const map: Record<string, { en: string; fr: string }> = {
      openingHours: { en: 'Opening Hours', fr: 'Heures d\'ouverture' },
      isOpenNow: { en: 'Open Now Status', fr: 'Statut ouvert maintenant' },
      isOnDuty: { en: 'On-call Pharmacy', fr: 'Pharmacie de garde' },
      merchantIdByProvider: { en: 'Merchant IDs by Provider', fr: 'ID marchands par operateur' },
      paymentMethods: { en: 'Payment Methods', fr: 'Moyens de paiement' },
      hasCashAvailable: { en: 'Cash Availability', fr: 'Disponibilite cash' },
      providers: { en: 'Providers', fr: 'Operateurs' },
      fuelTypes: { en: 'Fuel Types', fr: 'Types de carburant' },
      pricesByFuel: { en: 'Prices by Fuel', fr: 'Prix par carburant' },
      quality: { en: 'Quality', fr: 'Qualite' },
      hasFuelAvailable: { en: 'Fuel Availability', fr: 'Disponibilite carburant' }
    };
    const value = map[gap];
    if (!value) return gap;
    return language === 'fr' ? value.fr : value.en;
  };

  const knownFields: Array<{ label: string; value?: string | number | boolean }> = [
    { label: t('Category', 'Categorie'), value: categoryLabel },
    { label: t('Address', 'Adresse'), value: point.location },
    { label: t('Opening Hours', 'Heures d\'ouverture'), value: point.openingHours || point.hours },
    { label: t('Fuel Price', 'Prix carburant'), value: typeof point.price === 'number' ? `${point.price} XAF/L` : undefined },
    { label: t('Fuel Type', 'Type de carburant'), value: point.fuelType },
    { label: t('Providers', 'Operateurs'), value: point.providers?.join(', ') },
    { label: t('Payments', 'Paiements'), value: point.paymentMethods?.join(', ') },
    { label: t('Cash Available', 'Cash disponible'), value: typeof point.hasCashAvailable === 'boolean' ? (point.hasCashAvailable ? t('Yes', 'Oui') : t('No', 'Non')) : undefined },
    { label: t('Fuel Available', 'Carburant disponible'), value: typeof point.hasFuelAvailable === 'boolean' ? (point.hasFuelAvailable ? t('Yes', 'Oui') : t('No', 'Non')) : undefined },
    { label: t('Open Now', 'Ouvert maintenant'), value: typeof point.isOpenNow === 'boolean' ? (point.isOpenNow ? t('Yes', 'Oui') : t('No', 'Non')) : undefined },
    { label: t('On-call Pharmacy', 'Pharmacie de garde'), value: typeof point.isOnDuty === 'boolean' ? (point.isOnDuty ? t('Yes', 'Oui') : t('No', 'Non')) : undefined }
  ];

  const visibleKnownFields = knownFields.filter((field) => field.value !== undefined && field.value !== '');
  const gaps = point.gaps ?? [];

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold truncate max-w-[200px]">{point.name}</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">{categoryLabel}</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="h-44 rounded-2xl bg-gray-200 overflow-hidden relative shadow-sm border border-gray-100">
          <img
            src={point.photoUrl || `https://picsum.photos/seed/${point.id}/800/400?grayscale&blur=2`}
            className={`w-full h-full object-cover ${point.photoUrl ? '' : 'opacity-50'}`}
            alt={point.photoUrl ? t('User submitted photo', 'Photo soumise par utilisateur') : t('Fallback image', 'Image de secours')}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-2 bg-[#0f2b46] rounded-full border-2 border-white shadow-xl">
              {point.type === Category.PHARMACY ? <Pill size={20} className="text-white" /> : point.type === Category.FUEL ? <Zap size={20} className="text-white" /> : <CreditCard size={20} className="text-white" />}
            </div>
          </div>
          <button className="absolute bottom-3 right-3 p-2 bg-white rounded-xl shadow-md border border-gray-100 text-[#0f2b46]">
            <Navigation2 size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center">
              <ShieldCheck size={10} className="mr-1" />
              {t('Trust Score', 'Score de confiance')}
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 tracking-tight">{point.trustScore}%</span>
              <span className="text-[10px] text-gray-500 font-medium">{t('Community confidence', 'Confiance de la communaute')}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center">
              <Clock size={10} className="mr-1" />
              {t('Updated', 'Mis a jour')}
            </span>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900 tracking-tight">{point.lastUpdated}</span>
              <span className="text-[10px] text-gray-500 font-medium">{t('Live sync state', 'Etat sync live')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
          <h4 className="text-sm font-bold text-gray-900">{t('Known Fields', 'Champs connus')}</h4>
          {visibleKnownFields.length === 0 && (
            <p className="text-xs text-gray-500">{t('No known fields captured yet.', 'Aucun champ connu capture pour le moment.')}</p>
          )}
          {visibleKnownFields.map((field) => (
            <div key={field.label} className="flex items-start justify-between text-xs border-b border-gray-50 pb-2">
              <span className="text-gray-500">{field.label}</span>
              <span className="font-semibold text-gray-900 text-right max-w-[60%]">{String(field.value)}</span>
            </div>
          ))}
        </div>

        <div className="bg-[#fff8f4] p-4 rounded-2xl border border-[#f7e8e1] shadow-sm space-y-2">
          <h4 className="text-sm font-bold text-[#b85f3f]">{t('Gaps To Enrich', 'Lacunes a enrichir')}</h4>
          {gaps.length === 0 ? (
            <p className="text-xs text-[#b85f3f]">{t('No gaps detected. Point looks complete.', 'Aucune lacune detectee. Le point semble complet.')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {gaps.map((gap) => (
                <span key={gap} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white text-[#b85f3f] border border-[#f5d5c6]">
                  {translatedGap(gap)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
          <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
            <MapPin size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-900">{t('Geo-anchored location', 'Localisation geo-ancree')}</span>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{point.location}</p>
          </div>
        </div>

        <div className="h-24"></div>
      </div>

      <div className="fixed bottom-[calc(5rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 w-full max-w-[calc(28rem-2rem)] px-4 flex items-center space-x-2 z-40">
        <button
          onClick={isAuthenticated ? onEnrich : onAuth}
          className="flex-1 h-14 bg-[#0f2b46] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 hover:bg-[#0b2236] active:scale-95 transition-all"
        >
          <ShieldCheck size={18} />
          <span>{isAuthenticated ? t('Enrich Point', 'Enrichir le point') : t('Sign In to Enrich', 'Connectez-vous pour enrichir')}</span>
        </button>
        <button
          onClick={isAuthenticated ? onAddNew : onAuth}
          className="flex-1 h-14 bg-[#c86b4a] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 hover:bg-[#b85f3f] active:scale-95 transition-all"
        >
          <PlusCircle size={18} />
          <span>{t('Add New', 'Ajouter nouveau')}</span>
        </button>
      </div>
    </div>
  );
};

export default Details;
