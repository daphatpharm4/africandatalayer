import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Category, DataPoint } from '../../types';
import type { Submission } from '../../shared/types';
import {
  Fuel,
  Landmark,
  List,
  Map as MapIcon,
  MapPin,
  Plus,
  ShieldCheck,
  User
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
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

const MOCK_POINTS: DataPoint[] = [
  {
    id: '1',
    name: 'Total Akwa',
    type: Category.FUEL,
    location: 'Gare des Grands Bus, Akwa, Douala',
    coordinates: { latitude: 4.0516, longitude: 9.7072 },
    price: 840,
    fuelType: 'Super',
    quality: 'Premium',
    currency: 'XAF',
    lastUpdated: '12 mins ago',
    availability: 'High',
    queueLength: 'Short',
    trustScore: 98,
    contributorTrust: 'Gold',
    verified: true,
    hours: 'Open 24 Hours • Daily',
    paymentMethods: ['Cash', 'MTN MoMo', 'Orange Money', 'Cards']
  },
  {
    id: '2',
    name: 'MTN Mobile Money - Bonapriso',
    type: Category.MOBILE_MONEY,
    location: 'Rue des Ecoles, Bonapriso, Douala',
    coordinates: { latitude: 4.0345, longitude: 9.7003 },
    lastUpdated: '42 mins ago',
    availability: 'High',
    queueLength: 'Moderate',
    trustScore: 94,
    contributorTrust: 'Silver',
    provider: 'MTN',
    merchantId: 'M-129384',
    reliability: 'Excellent',
    verified: false
  },
  {
    id: '3',
    name: 'Tradex Gare des Grands Bus',
    type: Category.FUEL,
    location: 'Akwa, Douala',
    coordinates: { latitude: 4.0582, longitude: 9.7136 },
    price: 828,
    fuelType: 'Diesel',
    quality: 'Standard',
    currency: 'XAF',
    lastUpdated: '42 mins ago',
    availability: 'High',
    queueLength: 'Moderate',
    trustScore: 92,
    contributorTrust: 'Gold',
    verified: true,
    hours: 'Open 24 Hours • Daily'
  },
  {
    id: '4',
    name: 'Orange Money Kiosk',
    type: Category.MOBILE_MONEY,
    location: 'Marché Deido, Douala',
    coordinates: { latitude: 4.0735, longitude: 9.7321 },
    lastUpdated: '3h ago',
    availability: 'Low',
    queueLength: 'Long',
    trustScore: 78,
    contributorTrust: 'Bronze',
    provider: 'Orange',
    merchantId: 'O-99231',
    reliability: 'Congested'
  }
];

const CITY_CENTERS = {
  douala: { latitude: 4.0511, longitude: 9.7679 },
  yaounde: { latitude: 3.8480, longitude: 11.5021 }
} as const;
type CityKey = keyof typeof CITY_CENTERS;

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 8px 16px rgba(15,43,70,0.35);display:flex;align-items:center;justify-content:center;"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

const fuelIcon = createMarkerIcon('#0f2b46');
const kioskIcon = createMarkerIcon('#1f2933');

const Home: React.FC<Props> = ({ onSelectPoint, isAuthenticated, isAdmin, onAuth, onContribute, onProfile, language }) => {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');
  const [points, setPoints] = useState<DataPoint[]>(MOCK_POINTS);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [selectedCity, setSelectedCity] = useState<CityKey>(() => {
    const saved = localStorage.getItem('adl_city');
    return saved === 'yaounde' ? 'yaounde' : 'douala';
  });
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const selectedCenter = CITY_CENTERS[selectedCity];
  const selectedCityLabel = selectedCity === 'douala' ? t('Douala, Cameroon', 'Douala, Cameroun') : t('Yaounde, Cameroon', 'Yaounde, Cameroun');

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

  const mapAvailability = (raw?: string): 'High' | 'Low' | 'Out' => {
    if (!raw) return 'High';
    const normalized = raw.toLowerCase();
    if (normalized.includes('out')) return 'Out';
    if (normalized.includes('limited') || normalized.includes('low')) return 'Low';
    return 'High';
  };

  const parsePrice = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  };

  const mapSubmissionToPoint = (submission: Submission): DataPoint => {
    const isFuel = submission.category === 'fuel_station';
    const details = (submission.details ?? {}) as Record<string, unknown>;
    const coords = submission.location;
    const name =
      (details.siteName as string | undefined) ??
      (isFuel ? t('Fuel Station', 'Station-service') : t('Money Kiosk', 'Kiosque mobile money'));
    const availability = isFuel ? 'High' : mapAvailability(details.availability as string | undefined);
    const paymentModes = Array.isArray(details.paymentModes) ? (details.paymentModes as string[]) : undefined;
    const fuelPrice = parsePrice(details.fuelPrice ?? details.price);
    const fuelType = typeof details.fuelType === 'string' ? details.fuelType : undefined;

    return {
      id: submission.id,
      name,
      type: isFuel ? Category.FUEL : Category.MOBILE_MONEY,
      location: coords
        ? `GPS: ${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`
        : t('Location unavailable', 'Localisation indisponible'),
      coordinates: coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined,
      price: fuelPrice,
      fuelType,
      currency: 'XAF',
      quality: typeof details.quality === 'string' ? details.quality : undefined,
      lastUpdated: formatTimeAgo(submission.createdAt),
      availability,
      queueLength: typeof details.queueLength === 'string' ? details.queueLength : undefined,
      trustScore: 85,
      contributorTrust: 'Silver',
      provider: typeof details.provider === 'string' ? details.provider : undefined,
      merchantId: typeof details.merchantId === 'string' ? details.merchantId : undefined,
      hours: typeof details.hours === 'string' ? details.hours : undefined,
      paymentMethods: paymentModes,
      reliability: typeof details.reliability === 'string' ? details.reliability : undefined,
      photoUrl: typeof submission.photoUrl === 'string' ? submission.photoUrl : undefined,
      verified: true
    };
  };

  useEffect(() => {
    const loadPoints = async () => {
      try {
        setIsLoadingPoints(true);
        const data = await apiJson<Submission[]>('/api/submissions');
        if (Array.isArray(data)) {
          setPoints(data.map(mapSubmissionToPoint));
        }
      } catch {
        setPoints(MOCK_POINTS);
      } finally {
        setIsLoadingPoints(false);
      }
    };
    loadPoints();
  }, [language]);

  useEffect(() => {
    localStorage.setItem('adl_city', selectedCity);
  }, [selectedCity]);

  const filteredPoints = useMemo(() => {
    const source = points;
    if (activeCategory === 'ALL') return source;
    return source.filter(p => p.type === activeCategory);
  }, [activeCategory, points]);

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <header className="px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <BrandLogo size={18} className="shrink-0" />
              <h2 className="text-lg font-bold text-[#1f2933] leading-tight">African Data Layer</h2>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-[#e7eef4] text-[#0f2b46] text-[9px] font-bold uppercase tracking-widest">
                  {t('Admin', 'Admin')}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('GPS Centered', 'GPS centre')} • {selectedCityLabel}</span>
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

        <div className="flex p-1 bg-gray-100 rounded-xl mb-2">
          <button
            onClick={() => setSelectedCity('douala')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${selectedCity === 'douala' ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            {t('Douala', 'Douala')}
          </button>
          <button
            onClick={() => setSelectedCity('yaounde')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${selectedCity === 'yaounde' ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            {t('Yaounde', 'Yaounde')}
          </button>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl mb-2">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === 'ALL' ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            {t('Both', 'Les deux')}
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

      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className={`${viewMode === 'map' ? 'flex-1' : 'hidden'} bg-[#e7eef4] relative overflow-hidden z-0`}>
            <MapContainer
              key={selectedCity}
              center={[selectedCenter.latitude, selectedCenter.longitude]}
              zoom={13}
              scrollWheelZoom
              className="absolute inset-0 h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredPoints
                .filter((point) => point.coordinates)
                .map((point) => {
                  const position = point.coordinates!;
                  return (
                    <Marker
                      key={point.id}
                      position={[position.latitude, position.longitude]}
                      icon={point.type === Category.FUEL ? fuelIcon : kioskIcon}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#0f2b46]">
                            {point.type === Category.FUEL ? t('Fuel Station', 'Station-service') : t('Money Kiosk', 'Kiosque mobile money')}
                          </span>
                          <p className="text-sm font-semibold text-gray-900">{point.name}</p>
                          <p className="text-[10px] text-gray-500">{point.location}</p>
                          {point.type === Category.FUEL && (
                            <p className="text-[10px] text-gray-600">
                              {(point.fuelType ?? t('Fuel', 'Carburant'))} • {typeof point.price === 'number' ? `${point.price} XAF/L` : t('Price unavailable', 'Prix indisponible')}
                            </p>
                          )}
                          <button
                            className="mt-2 w-full rounded-lg bg-[#0f2b46] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                            onClick={() => onSelectPoint(point)}
                          >
                            {t('View Details', 'Voir details')}
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
            </MapContainer>
            <div className="absolute inset-x-4 top-4 z-20 bg-white/95 backdrop-blur rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">{t('GPS Locked', 'GPS verrouille')}</p>
                  <p className="text-xs text-gray-500">{t('Centered on', 'Centre sur')} {selectedCityLabel}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#4c7c59] animate-pulse"></div>
              </div>
            </div>
          </div>
        <div className={`${viewMode === 'list' ? 'flex-1 relative z-30 bg-[#f9fafb]' : 'hidden'}`}>
          <div className="h-full overflow-y-auto no-scrollbar p-4 space-y-3 pb-24">
            {isLoadingPoints && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                {t('Loading data points...', 'Chargement des points de donnees...')}
              </div>
            )}
            {filteredPoints.map(point => (
              <button
                key={point.id}
                onClick={() => onSelectPoint(point)}
                className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4 active:scale-[0.98] transition-transform"
              >
                <div className={`p-3 rounded-xl ${point.type === Category.FUEL ? 'bg-[#e7eef4] text-[#0f2b46]' : 'bg-gray-100 text-gray-700'}`}>
                  {point.type === Category.FUEL ? <Fuel size={20} /> : <Landmark size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-gray-900 text-sm">{point.name}</h4>
                    {typeof point.price === 'number' && <span className="font-bold text-gray-900 text-sm">{point.price} {point.currency}</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">{point.location}</p>
                  {point.type === Category.FUEL && point.fuelType && (
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{t('Fuel', 'Carburant')}: {point.fuelType}</p>
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

        <button
          onClick={() => setViewMode(v => (v === 'map' ? 'list' : 'map'))}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-[#1f2933] text-white rounded-full shadow-2xl flex items-center space-x-2 z-40 hover:bg-black active:scale-95 transition-all"
        >
          {viewMode === 'map' ? <List size={16} /> : <MapIcon size={16} />}
          <span className="text-xs font-bold uppercase tracking-wider">{viewMode === 'map' ? t('List View', 'Vue liste') : t('Map View', 'Vue carte')}</span>
        </button>

        <button
          onClick={isAuthenticated ? onContribute : onAuth}
          className="fixed bottom-24 right-4 w-14 h-14 bg-[#c86b4a] text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:bg-[#b85f3f] active:scale-95 transition-all"
          aria-label={isAuthenticated ? t('Contribute', 'Contribuer') : t('Sign in to contribute', 'Connectez-vous pour contribuer')}
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
