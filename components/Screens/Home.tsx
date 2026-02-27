import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Category, DataPoint } from '../../types';
import type { MapScope, ProjectedPoint } from '../../shared/types';
import {
  BONAMOUSSADI_CENTER,
  CAMEROON_CENTER,
  bonamoussadiLeafletBounds,
  cameroonLeafletBounds,
  isWithinBonamoussadi
} from '../../shared/geofence';
import {
  Fuel,
  Landmark,
  List,
  Map as MapIcon,
  MapPin,
  Pill,
  Plus,
  ShieldCheck,
  User
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import { detectLowEndDevice } from '../../lib/client/deviceProfile';
import BrandLogo from '../BrandLogo';

interface Props {
  onSelectPoint: (point: DataPoint) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  onAuth: () => void;
  onContribute: () => void;
  onProfile: () => void;
  language: 'en' | 'fr';
}

type MapPointGroup = {
  key: string;
  latitude: number;
  longitude: number;
  points: DataPoint[];
};

const HomeMap = React.lazy(() => import('./HomeMap'));

const BONAMOUSSADI_MAP_BOUNDS = bonamoussadiLeafletBounds();
const CAMEROON_MAP_BOUNDS = cameroonLeafletBounds();

const normalizeMapScope = (scope: unknown, isAdminMode: boolean): MapScope => {
  if (isAdminMode) return 'global';
  if (scope === 'cameroon' || scope === 'global') return scope;
  return 'bonamoussadi';
};


const Home: React.FC<Props> = ({ onSelectPoint, isAuthenticated, isAdmin, onAuth, onContribute, onProfile, language }) => {
  const [deviceRuntime] = useState(() => ({ lowEnd: detectLowEndDevice() }));
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => (deviceRuntime.lowEnd ? 'list' : 'map'));
  const [activeCategory, setActiveCategory] = useState<Category>(Category.PHARMACY);
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [mapScope, setMapScope] = useState<MapScope>(() => (isAdmin ? 'global' : 'bonamoussadi'));
  const isLowEndDevice = deviceRuntime.lowEnd;
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const selectedCityLabel =
    mapScope === 'cameroon'
      ? t('Cameroon', 'Cameroun')
      : mapScope === 'global'
        ? t('Worldwide', 'Monde entier')
        : t('Bonamoussadi, Douala, Cameroon', 'Bonamoussadi, Douala, Cameroun');

  const mapCenter: [number, number] =
    mapScope === 'cameroon'
      ? [CAMEROON_CENTER.latitude, CAMEROON_CENTER.longitude]
      : mapScope === 'global'
        ? [20, 0]
        : [BONAMOUSSADI_CENTER.latitude, BONAMOUSSADI_CENTER.longitude];
  const mapZoom = mapScope === 'cameroon' ? 6 : mapScope === 'global' ? 2 : 15;
  const mapMinZoom = mapScope === 'cameroon' ? 5 : mapScope === 'global' ? 2 : 14;
  const mapBounds =
    mapScope === 'bonamoussadi' ? BONAMOUSSADI_MAP_BOUNDS : mapScope === 'cameroon' ? CAMEROON_MAP_BOUNDS : undefined;
  const mapLockLabel =
    mapScope === 'bonamoussadi'
      ? t('GPS Locked', 'GPS verrouille')
      : t('GPS Unlocked (Admin)', 'GPS debloque (admin)');

  const formatTimeAgo = (iso: string) => {
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return t('Unknown', 'Inconnu');
    const diffMs = Date.now() - created;
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return language === 'fr' ? `il y a ${minutes} min` : `${minutes} mins ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return language === 'fr' ? `il y a ${hours}h` : `${hours}h ago`;
    const days = Math.round(hours / 24);
    return language === 'fr' ? `il y a ${days}j` : `${days}d ago`;
  };

  const inferAvailability = (category: ProjectedPoint['category'], details: Record<string, unknown>): 'High' | 'Low' | 'Out' => {
    if (category === 'pharmacy') {
      if (typeof details.isOpenNow === 'boolean') return details.isOpenNow ? 'High' : 'Out';
      return 'Low';
    }
    if (category === 'fuel_station') {
      if (typeof details.hasFuelAvailable === 'boolean') return details.hasFuelAvailable ? 'High' : 'Out';
      return 'Low';
    }
    const hasMin50000XafAvailable =
      typeof details.hasMin50000XafAvailable === 'boolean'
        ? details.hasMin50000XafAvailable
        : typeof details.hasCashAvailable === 'boolean'
          ? details.hasCashAvailable
          : undefined;
    if (typeof hasMin50000XafAvailable === 'boolean') return hasMin50000XafAvailable ? 'High' : 'Out';
    return 'Low';
  };

  const mapProjectedToPoint = (point: ProjectedPoint): DataPoint => {
    const details = (point.details ?? {}) as Record<string, unknown>;
    const type =
      point.category === 'pharmacy'
        ? Category.PHARMACY
        : point.category === 'fuel_station'
          ? Category.FUEL
          : Category.MOBILE_MONEY;
    const name =
      (typeof details.name === 'string' && details.name) ||
      (typeof details.siteName === 'string' && details.siteName) ||
      (type === Category.PHARMACY
        ? t('Pharmacy', 'Pharmacie')
        : type === Category.FUEL
          ? t('Fuel Station', 'Station-service')
          : t('Mobile Money Kiosk', 'Kiosque mobile money'));
    const pricesByFuel =
      details.pricesByFuel && typeof details.pricesByFuel === 'object'
        ? (details.pricesByFuel as Record<string, number>)
        : undefined;
    const derivedPrice =
      typeof details.fuelPrice === 'number'
        ? details.fuelPrice
        : typeof details.price === 'number'
          ? details.price
          : pricesByFuel
            ? Object.values(pricesByFuel).find((value) => Number.isFinite(value))
            : undefined;
    const providers = Array.isArray(details.providers)
      ? (details.providers as string[]).filter((value) => typeof value === 'string' && value.trim().length > 0)
      : [];
    const paymentMethods = Array.isArray(details.paymentMethods)
      ? (details.paymentMethods as string[])
      : Array.isArray(details.paymentModes)
        ? (details.paymentModes as string[])
        : undefined;
    const provider = typeof details.provider === 'string' && details.provider.trim() ? details.provider.trim() : providers[0];
    const operator =
      (typeof details.operator === 'string' && details.operator.trim()) ||
      provider ||
      (providers.length > 0 ? providers[0] : undefined);

    return {
      id: point.pointId,
      name,
      type,
      location: `GPS: ${point.location.latitude.toFixed(4)}°, ${point.location.longitude.toFixed(4)}°`,
      coordinates: { latitude: point.location.latitude, longitude: point.location.longitude },
      price: typeof derivedPrice === 'number' ? derivedPrice : undefined,
      fuelType:
        (typeof details.fuelType === 'string' && details.fuelType) ||
        (Array.isArray(details.fuelTypes) ? String(details.fuelTypes[0] ?? '') : undefined),
      fuelTypes: Array.isArray(details.fuelTypes) ? (details.fuelTypes as string[]) : undefined,
      pricesByFuel: pricesByFuel,
      quality: typeof details.quality === 'string' ? details.quality : undefined,
      currency: 'XAF',
      lastUpdated: formatTimeAgo(point.updatedAt),
      availability: inferAvailability(point.category, details),
      queueLength: typeof details.queueLength === 'string' ? details.queueLength : undefined,
      trustScore: 85,
      contributorTrust: 'Silver',
      provider,
      providers,
      operator,
      merchantId: typeof details.merchantId === 'string' ? details.merchantId : undefined,
      hasMin50000XafAvailable:
        typeof details.hasMin50000XafAvailable === 'boolean'
          ? details.hasMin50000XafAvailable
          : typeof details.hasCashAvailable === 'boolean'
            ? details.hasCashAvailable
            : undefined,
      hasCashAvailable:
        typeof details.hasCashAvailable === 'boolean'
          ? details.hasCashAvailable
          : typeof details.hasMin50000XafAvailable === 'boolean'
            ? details.hasMin50000XafAvailable
            : undefined,
      hasFuelAvailable: typeof details.hasFuelAvailable === 'boolean' ? details.hasFuelAvailable : undefined,
      openingHours: typeof details.openingHours === 'string' ? details.openingHours : undefined,
      isOpenNow: typeof details.isOpenNow === 'boolean' ? details.isOpenNow : undefined,
      isOnDuty: typeof details.isOnDuty === 'boolean' ? details.isOnDuty : undefined,
      paymentMethods: paymentMethods?.filter((value) => typeof value === 'string' && value.trim().length > 0),
      reliability: typeof details.reliability === 'string' ? details.reliability : undefined,
      photoUrl: typeof point.photoUrl === 'string' ? point.photoUrl : undefined,
      gaps: Array.isArray(point.gaps) ? point.gaps : [],
      verified: true
    };
  };

  const formatPaymentMethods = (paymentMethods: string[] | undefined) => {
    if (!paymentMethods || paymentMethods.length === 0) {
      return t('Accepted payments unavailable', 'Paiements acceptes indisponibles');
    }
    return paymentMethods.join(', ');
  };

  const formatExplorerPrimaryMeta = (point: DataPoint) => {
    if (point.type === Category.PHARMACY) {
      if (typeof point.isOnDuty === 'boolean') {
        return point.isOnDuty ? t('Pharmacie de garde', 'Pharmacie de garde') : t('Pas de garde', 'Pas de garde');
      }
      return t('Statut de garde indisponible', 'Statut de garde indisponible');
    }
    if (point.type === Category.FUEL) {
      return `${t('Paiements', 'Paiements')}: ${formatPaymentMethods(point.paymentMethods)}`;
    }
    const operator = point.operator || point.provider || point.providers?.[0];
    return operator ? `${t('Operateur', 'Operateur')}: ${operator}` : t('Operateur indisponible', 'Operateur indisponible');
  };

  const formatPharmacyOpenStatus = (point: DataPoint) => {
    if (point.type !== Category.PHARMACY) return null;
    return point.isOpenNow ? t('Ouvert maintenant', 'Ouvert maintenant') : t('Statut indisponible', 'Statut indisponible');
  };

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      setMapScope('bonamoussadi');
      return;
    }
    setMapScope('global');
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    const loadPoints = async () => {
      try {
        setIsLoadingPoints(true);
        const params = new URLSearchParams();
        if (mapScope !== 'bonamoussadi') params.set('scope', mapScope);
        const query = params.toString();
        const data = await apiJson<ProjectedPoint[]>(query ? `/api/submissions?${query}` : '/api/submissions');
        if (Array.isArray(data)) {
          const mapped = data
            .map(mapProjectedToPoint)
            .filter((point) => (mapScope === 'bonamoussadi' ? isWithinBonamoussadi(point.coordinates) : true));
          setPoints(mapped);
        }
      } catch {
        setPoints([]);
      } finally {
        setIsLoadingPoints(false);
      }
    };
    void loadPoints();
  }, [language, mapScope]);

  const filteredPoints = useMemo(() => points.filter((point) => point.type === activeCategory), [activeCategory, points]);

  const mapPointGroups = useMemo<MapPointGroup[]>(() => {
    const groups = new Map<string, MapPointGroup>();
    for (const point of filteredPoints) {
      if (!point.coordinates) continue;
      if (mapScope === 'bonamoussadi' && !isWithinBonamoussadi(point.coordinates)) continue;
      const latitude = Number(point.coordinates.latitude.toFixed(5));
      const longitude = Number(point.coordinates.longitude.toFixed(5));
      const key = `${latitude}_${longitude}`;
      const existing = groups.get(key);
      if (existing) {
        existing.points.push(point);
      } else {
        groups.set(key, { key, latitude, longitude, points: [point] });
      }
    }
    return Array.from(groups.values());
  }, [filteredPoints, mapScope]);

  const categoryLabel = (type: Category) => {
    if (type === Category.PHARMACY) return t('Pharmacy', 'Pharmacie');
    if (type === Category.FUEL) return t('Fuel Station', 'Station-service');
    return t('Mobile Money Kiosk', 'Kiosque mobile money');
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <header className="px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <BrandLogo size={18} className="shrink-0" />
              <h2 className="text-lg font-bold text-[#1f2933] leading-tight">{t('African Data Layer', 'African Data Layer')}</h2>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-[#e7eef4] text-[#0f2b46] text-[9px] font-bold uppercase tracking-widest">
                  {t('Admin', 'Admin')}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {mapLockLabel} • {selectedCityLabel}
            </span>
          </div>
          <button
            onClick={isAuthenticated ? onProfile : onAuth}
            className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100"
            aria-label={isAuthenticated ? t('Profile', 'Profil') : t('Sign in', 'Connexion')}
          >
            <User size={18} />
          </button>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[#4c7c59] mb-3">
          <ShieldCheck size={12} />
          <span>{t('Offline-first sync ready', 'Synchronisation hors ligne prete')}</span>
        </div>
        {isLowEndDevice && (
          <div className="mb-3 rounded-xl border border-[#d5e1eb] bg-[#f2f6fa] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
            {t('Lite Mode Active (Low-end device)', 'Mode Lite actif (appareil entree de gamme)')}
          </div>
        )}

        <div className="flex p-1 bg-gray-100 rounded-xl mb-2">
          <button
            onClick={() => setActiveCategory(Category.PHARMACY)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === Category.PHARMACY ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            {t('Pharmacies', 'Pharmacies')}
          </button>
          <button
            onClick={() => setActiveCategory(Category.FUEL)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === Category.FUEL ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            {t('Fuel', 'Carburant')}
          </button>
          <button
            onClick={() => setActiveCategory(Category.MOBILE_MONEY)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === Category.MOBILE_MONEY ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            {t('Kiosk', 'Kiosque')}
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
        {viewMode === 'map' && (
          <Suspense
            fallback={
              <div className="flex-1 bg-[#e7eef4] relative overflow-hidden z-0 min-h-0 p-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                  {t('Loading map...', 'Chargement de la carte...')}
                </div>
              </div>
            }
          >
            <HomeMap
              mapScope={mapScope}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              mapMinZoom={mapMinZoom}
              mapBounds={mapBounds}
              mapPointGroups={mapPointGroups}
              selectedCityLabel={selectedCityLabel}
              onSelectPoint={onSelectPoint}
              categoryLabel={categoryLabel}
              formatExplorerPrimaryMeta={formatExplorerPrimaryMeta}
              formatPharmacyOpenStatus={formatPharmacyOpenStatus}
              language={language}
              t={t}
              isLowEndDevice={isLowEndDevice}
            />
          </Suspense>
        )}
        {viewMode === 'list' && (
          <div className="flex-1 relative z-30 bg-[#f9fafb] overflow-y-auto no-scrollbar min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="p-4 space-y-3 pb-24">
              {isLoadingPoints && (
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                  {t('Loading data points...', 'Chargement des points de donnees...')}
                </div>
              )}
              {filteredPoints.map((point) => (
                <button
                  key={point.id}
                  onClick={() => onSelectPoint(point)}
                  className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4 active:scale-[0.98] transition-transform"
                >
                  <div className={`p-3 rounded-xl ${point.type === Category.FUEL ? 'bg-[#e7eef4] text-[#0f2b46]' : point.type === Category.PHARMACY ? 'bg-[#eaf3ee] text-[#2f855a]' : 'bg-gray-100 text-gray-700'}`}>
                    {point.type === Category.FUEL ? <Fuel size={20} /> : point.type === Category.PHARMACY ? <Pill size={20} /> : <Landmark size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-gray-900 text-sm">{point.name}</h4>
                      {typeof point.price === 'number' && <span className="font-bold text-gray-900 text-sm">{point.price} {point.currency}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">{formatExplorerPrimaryMeta(point)}</p>
                    {point.type === Category.PHARMACY && (
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{formatPharmacyOpenStatus(point)}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">{t('Updated', 'Mis a jour')} {point.lastUpdated}</span>
                      {point.verified && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-[#eaf3ee] text-[#4c7c59] rounded-full font-bold uppercase tracking-wider">{t('Verified', 'Verifie')}</span>
                      )}
                    </div>
                  </div>
                  <MapPin size={16} className="text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setViewMode((v) => (v === 'map' ? 'list' : 'map'))}
          className="fixed bottom-[calc(6rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 px-5 py-2.5 bg-[#1f2933] text-white rounded-full shadow-2xl flex items-center space-x-2 z-40 hover:bg-black active:scale-95 transition-all"
        >
          {viewMode === 'map' ? <List size={16} /> : <MapIcon size={16} />}
          <span className="text-xs font-bold uppercase tracking-wider">{viewMode === 'map' ? t('List View', 'Vue liste') : t('Map View', 'Vue carte')}</span>
        </button>

        <button
          onClick={isAuthenticated ? onContribute : onAuth}
          className="fixed bottom-[calc(6rem+var(--safe-bottom))] right-4 w-14 h-14 bg-[#c86b4a] text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:bg-[#b85f3f] active:scale-95 transition-all"
          aria-label={
            isAuthenticated
              ? t('Contribute', 'Contribuer')
              : t('Sign in to contribute', 'Connectez-vous pour contribuer')
          }
        >
          <Plus size={22} />
        </button>

        {!isAuthenticated && (
          <div className="absolute top-20 left-4 right-4 bg-white/95 backdrop-blur p-3 rounded-xl shadow-xl border border-[#f2f4f7] z-20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#c86b4a] uppercase tracking-widest">{t('Contributor Access', 'Acces contributeur')}</span>
              <p className="text-xs text-gray-700 font-medium">{t('Log in to add data and earn XP.', 'Connectez-vous pour ajouter des donnees et gagner des XP.')}</p>
            </div>
            <button
              onClick={onAuth}
              className="px-4 py-2 bg-[#0f2b46] text-white text-[10px] font-bold uppercase rounded-xl tracking-wide hover:bg-[#0b2236]"
            >
              {t('Sign In', 'Connexion')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
