import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Category } from '../../types';
import type { DataPoint } from '../../types';
import type { CollectionAssignment, MapScope, ProjectedPoint, UserRole } from '../../shared/types';
import {
  BONAMOUSSADI_CENTER,
  CAMEROON_CENTER,
  bonamoussadiLeafletBounds,
  cameroonLeafletBounds,
  isWithinBonamoussadi
} from '../../shared/geofence';
import {
  ChevronDown,
  Map,
  MapPin,
  Plus,
  Route,
  Sparkles,
  Target,
  User
} from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
import { categoryLabel as getCategoryLabel, LEGACY_CATEGORY_MAP, VERTICALS } from '../../shared/verticals';
import { apiJson } from '../../lib/client/api';
import { detectLowEndDevice } from '../../lib/client/deviceProfile';
import BrandLogo from '../BrandLogo';
import { runViewTransition } from '../../lib/client/motion';
import BottomSheet from '../shared/BottomSheet';
import type { SnapPoint } from '../shared/BottomSheet';
import MissionCards from '../MissionCards';
import type { MissionCard } from '../MissionCards';

interface Props {
  onSelectPoint: (point: DataPoint) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  userRole?: UserRole;
  onAuth: () => void;
  onContribute?: (options?: { batch?: boolean; assignment?: CollectionAssignment | null }) => void;
  onProfile: () => void;
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
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

const categoryFromSubmission = (category: ProjectedPoint['category']): Category => {
  if (category === 'pharmacy') return Category.PHARMACY;
  if (category === 'fuel_station') return Category.FUEL;
  if (category === 'mobile_money') return Category.MOBILE_MONEY;
  if (category === 'alcohol_outlet') return Category.ALCOHOL_OUTLET;
  if (category === 'billboard') return Category.BILLBOARD;
  if (category === 'transport_road') return Category.TRANSPORT_ROAD;
  if (category === 'census_proxy') return Category.CENSUS_PROXY;
  return Category.PHARMACY;
};

const selectableCategories: Category[] = [
  Category.PHARMACY,
  Category.FUEL,
  Category.MOBILE_MONEY,
  Category.ALCOHOL_OUTLET,
  Category.BILLBOARD,
  Category.TRANSPORT_ROAD,
  Category.CENSUS_PROXY,
];


function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const Home: React.FC<Props> = ({ onSelectPoint, isAuthenticated, isAdmin, userRole = 'agent', onAuth, onContribute, onProfile, activeCategory, onCategoryChange, language }) => {
  const [deviceRuntime] = useState(() => ({ lowEnd: detectLowEndDevice() }));
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => (deviceRuntime.lowEnd ? 'list' : 'map'));
  const [isVerticalPickerOpen, setIsVerticalPickerOpen] = useState(false);
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [mapScope, setMapScope] = useState<MapScope>('bonamoussadi');
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('peek');
  const contributePressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const verticalPickerRef = useRef<HTMLDivElement>(null);
  const isLowEndDevice = deviceRuntime.lowEnd;
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const showAgentWidgets = isAuthenticated && userRole !== 'client';

  useEffect(() => {
    if (!isVerticalPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (verticalPickerRef.current && !verticalPickerRef.current.contains(e.target as Node)) {
        setIsVerticalPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVerticalPickerOpen]);

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
      ? t('Zone active', 'Zone active')
      : t('Full access', 'Acces complet');

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
    const type = categoryFromSubmission(point.category);
    const name =
      (typeof details.name === 'string' && details.name) ||
      (typeof details.siteName === 'string' && details.siteName) ||
      getCategoryLabel(point.category, language);
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
      updatedAtIso: point.updatedAt,
      availability: inferAvailability(point.category, details),
      queueLength: typeof details.queueLength === 'string' ? details.queueLength : undefined,
      trustScore: typeof details.confidenceScore === 'number' ? details.confidenceScore : 85,
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
      details,
      gaps: Array.isArray(point.gaps) ? point.gaps : [],
      verified: true
    };
  };

  const formatPaymentMethods = (paymentMethods: string[] | undefined) => {
    if (!paymentMethods || paymentMethods.length === 0) {
      return t('Accepted payments unavailable', 'Paiements acceptés indisponibles');
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
    return operator ? `${t('Opérateur', 'Opérateur')}: ${operator}` : t('Operateur indisponible', 'Operateur indisponible');
  };

  const formatPharmacyOpenStatus = (point: DataPoint) => {
    if (point.type !== Category.PHARMACY) return null;
    return point.isOpenNow ? t('Ouvert maintenant', 'Ouvert maintenant') : t('Statut indisponible', 'Statut indisponible');
  };

  useEffect(() => {
    // Always start at Bonamoussadi street level — admins can zoom out manually
    setMapScope('bonamoussadi');
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
  }, [mapScope]); // language removed: API response is language-independent

  useEffect(() => {
    let cancelled = false;
    const loadAssignments = async () => {
      if (!isAuthenticated || userRole === 'client') {
        setAssignments([]);
        return;
      }

      try {
        const assignmentData = await apiJson<CollectionAssignment[]>('/api/user?view=assignments');
        if (cancelled) return;
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      } catch {
        if (cancelled) return;
        setAssignments([]);
      }
    };

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userRole]);

  useEffect(() => {
    return () => {
      if (contributePressTimer.current) {
        window.clearTimeout(contributePressTimer.current);
      }
    };
  }, []);

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
    const verticalId = LEGACY_CATEGORY_MAP[type] ?? type;
    return getCategoryLabel(verticalId, language);
  };

  const activeAssignment = useMemo(() => {
    const active = assignments
      .filter((assignment) => assignment.status === 'in_progress' || assignment.status === 'pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return active[0] ?? null;
  }, [assignments]);
  const [agentLocation, setAgentLocation] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setAgentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const nearbyEnrichCount = useMemo(() => {
    if (!agentLocation) return 0;
    return filteredPoints.filter((p) => {
      if (!p.coordinates || !p.gaps || p.gaps.length === 0) return false;
      return haversineMeters(agentLocation.lat, agentLocation.lng, p.coordinates.latitude, p.coordinates.longitude) <= 200;
    }).length;
  }, [agentLocation, filteredPoints]);

  const assignmentZones = useMemo(() => {
    return assignments
      .filter((a) => a.status === 'in_progress' || a.status === 'pending')
      .filter((a) => a.zoneBounds)
      .map((a) => ({ id: a.id, zoneLabel: a.zoneLabel, zoneBounds: a.zoneBounds }));
  }, [assignments]);

  const missionCards = useMemo(() => {
    const cards = [];

    if (!isAuthenticated) {
      return [
        {
          id: 'join',
          icon: Target,
          label: t('Join the mission', 'Rejoindre la mission'),
          title: t('Sign in to start earning', 'Connectez-vous pour commencer'),
          meta: t('Map your neighborhood, earn XP, build your reputation', 'Cartographiez votre quartier, gagnez de l\'XP, construisez votre reputation'),
          tone: 'bg-navy text-white',
          action: onAuth,
        },
        {
          id: 'explore',
          icon: Route,
          label: t('See what\'s mapped', 'Voir ce qui est cartographie'),
          title: t(`${filteredPoints.length} points collected so far`, `${filteredPoints.length} points collectes`),
          meta: t('Browse the map to see community contributions', 'Parcourez la carte pour voir les contributions'),
          tone: 'bg-navy-wash text-navy border border-navy/15',
          action: () => {
            if (viewMode !== 'map') {
              void runViewTransition(() => setViewMode('map'));
            }
          },
        },
      ];
    }

    cards.push({
      id: 'primary',
      icon: Target,
      label: activeAssignment ? t('Next assignment move', 'Prochaine action de mission') : t('Next high-value capture', 'Prochaine capture a forte valeur'),
      title: activeAssignment ? activeAssignment.zoneLabel : t(`Add a ${categoryLabel(activeCategory).toLowerCase()} point`, `Ajoutez un point ${categoryLabel(activeCategory).toLowerCase()}`),
      meta: activeAssignment
        ? t(`${activeAssignment.pointsSubmitted}/${activeAssignment.pointsExpected} captured`, `${activeAssignment.pointsSubmitted}/${activeAssignment.pointsExpected} captures`)
        : t('No one has mapped this area yet — be first', 'Personne n\'a encore cartographie cette zone — soyez le premier'),
      xpReward: activeAssignment ? undefined : '+25 XP',
      tone: 'bg-navy text-white',
      action: () => {
        if (isAuthenticated && onContribute) {
          onContribute({ assignment: activeAssignment });
          return;
        }
        onAuth();
      },
    });

    cards.push({
      id: 'nearby',
      icon: Sparkles,
      label: t('Nearby opportunities', 'Opportunites proches'),
      title: nearbyEnrichCount > 0
        ? t(`${nearbyEnrichCount} points need updates nearby`, `${nearbyEnrichCount} points a mettre a jour`)
        : t('Nothing to update nearby', 'Rien a mettre a jour a proximite'),
      meta: nearbyEnrichCount > 0
        ? t('Tap to see which ones', 'Appuyez pour voir lesquels')
        : t('Walk around — we\'ll find outdated points for you', 'Deplacez-vous — on trouvera les points obsoletes'),
      tone: nearbyEnrichCount > 0 ? 'bg-terra text-white' : 'bg-terra-wash text-terra-dark border border-terra/20',
      action: () => {
        if (nearbyEnrichCount > 0 && viewMode !== 'list') {
          void runViewTransition(() => setViewMode('list'));
        }
      },
    });

    cards.push({
      id: 'coverage',
      icon: Route,
      label: viewMode === 'map' ? t('Browse as list', 'Voir en liste') : t('Back to map', 'Retour a la carte'),
      title: t(`${filteredPoints.length} points in view`, `${filteredPoints.length} points visibles`),
      meta: viewMode === 'map'
        ? t('Scroll through all captures nearby', 'Parcourir toutes les captures a proximite')
        : t('See where points are on the map', 'Voir ou sont les points sur la carte'),
      tone: viewMode === 'map' ? 'bg-forest-wash text-forest-dark border border-forest/20' : 'bg-forest text-white',
      action: () => {
        void runViewTransition(() => setViewMode((current) => (current === 'map' ? 'list' : 'map')));
      },
    });

    return cards;
  }, [activeAssignment, activeCategory, filteredPoints.length, isAuthenticated, nearbyEnrichCount, onAuth, onContribute, t, viewMode]);

  const launchSingleCapture = () => {
    if (isAuthenticated && onContribute) {
      onContribute({ assignment: activeAssignment });
      return;
    }
    onAuth();
  };

  const handleContributePressStart = () => {
    if (!isAuthenticated || !onContribute) return;
    longPressTriggered.current = false;
    if (contributePressTimer.current) {
      window.clearTimeout(contributePressTimer.current);
    }
    contributePressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onContribute({ batch: true, assignment: activeAssignment });
    }, 550);
  };

  const handleContributePressEnd = () => {
    if (contributePressTimer.current) {
      window.clearTimeout(contributePressTimer.current);
      contributePressTimer.current = null;
    }
    if (longPressTriggered.current) {
      window.setTimeout(() => {
        longPressTriggered.current = false;
      }, 0);
      return;
    }
    launchSingleCapture();
  };

  return (
    <div
      className="relative h-full min-h-0 bg-page"
    >
      <header className="route-grid absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-3 bg-white/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(15,43,70,0.08)]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="ambient-orb right-[-2rem] top-[-1.5rem] h-20 w-20 bg-gold/20" />
          <div className="ambient-orb left-[-1rem] bottom-[-2rem] h-24 w-24 bg-terra/10" style={{ animationDelay: '-2s' }} />
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <BrandLogo size={18} className="shrink-0" />
              <h2 className="text-lg font-bold text-ink leading-tight">{t('African Data Layer', 'African Data Layer')}</h2>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-navy-light text-navy micro-label">
                  {t('Admin', 'Admin')}
                </span>
              )}
              {userRole === 'client' && (
                <span className="px-2 py-0.5 rounded-full bg-terra-wash text-terra micro-label">
                  {t('Client', 'Client')}
                </span>
              )}
            </div>
            <span className="micro-label text-gray-400">
              {mapLockLabel} • {selectedCityLabel}
            </span>
          </div>
          <button
            onClick={isAuthenticated ? onProfile : onAuth}
            className="motion-pressable w-10 h-10 rounded-full bg-navy-wash flex items-center justify-center text-navy border border-navy/10"
            aria-label={isAuthenticated ? t('Profile', 'Profil') : t('Sign in', 'Connexion')}
          >
            <User size={18} />
          </button>
        </div>

        {isLowEndDevice && (
          <div className="mb-3 rounded-xl border border-navy-border bg-navy-wash px-3 py-2 micro-label text-navy">
            {t('Lite Mode — Faster on your device', 'Mode Lite — Plus rapide sur votre appareil')}
          </div>
        )}

        <div ref={verticalPickerRef} className="relative mb-2">
          <button
            onClick={() => setIsVerticalPickerOpen((prev) => !prev)}
            className="motion-pressable w-full h-11 px-3 bg-gray-100 rounded-xl text-xs font-semibold text-navy flex items-center justify-between"
          >
            <span>
              {t('Category', 'Catégorie')} : {categoryLabel(activeCategory)}
            </span>
            <ChevronDown size={14} className={`transition-transform ${isVerticalPickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {isVerticalPickerOpen && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg p-2 z-30">
              <div className="grid grid-cols-2 gap-2">
                {selectableCategories.map((category) => {
                  const verticalId = LEGACY_CATEGORY_MAP[category] ?? category;
                  const vertical = VERTICALS[verticalId];
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        onCategoryChange(category);
                        setIsVerticalPickerOpen(false);
                      }}
                      className={`motion-pressable h-10 rounded-xl border micro-label flex items-center justify-center gap-1 ${
                        isActive ? 'bg-navy text-white border-navy' : 'bg-gray-50 text-gray-600 border-gray-100'
                      }`}
                    >
                      <VerticalIcon name={vertical?.icon ?? 'pill'} size={12} />
                      {categoryLabel(category)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </header>

      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {viewMode === 'map' && (
          <Suspense
            fallback={
              <div className="flex-1 bg-navy-light relative overflow-hidden z-0 min-h-0 p-4">
                <div className="card p-4 text-xs text-gray-500">
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
              nearbyEnrichCount={nearbyEnrichCount}
              assignmentZones={assignmentZones}
              sheetSnap={sheetSnap}
            />
          </Suspense>
        )}
        {viewMode === 'list' && (
          <div className="surface-reveal flex-1 relative z-10 bg-page overflow-y-auto no-scrollbar min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="sticky top-0 z-20 bg-page border-b border-gray-100 px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {filteredPoints.length} {t('points', 'points')}
              </span>
              <button
                type="button"
                onClick={() => void runViewTransition(() => setViewMode('map'))}
                className="motion-pressable flex items-center gap-1.5 text-xs font-semibold text-forest bg-forest-wash px-3 py-2 rounded-xl border border-forest/20"
              >
                <Map size={14} />
                {t('Back to Map', 'Retour à la carte')}
              </button>
            </div>
            <div className="p-4 space-y-3 pb-24 pt-4">
              {isLoadingPoints && (
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                  {t('Loading data points...', 'Chargement des points de données...')}
                </div>
              )}
              {filteredPoints.map((point) => (
                <button
                  key={point.id}
                  onClick={() => onSelectPoint(point)}
                  className="motion-pressable w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4"
                >
                  {(() => { const vid = LEGACY_CATEGORY_MAP[point.type] ?? point.type; const v = VERTICALS[vid]; return (
                    <div className="p-3 rounded-xl" style={{ backgroundColor: v?.bgColor ?? '#f9fafb', color: v?.color ?? '#1f2933' }}>
                      <VerticalIcon name={v?.icon ?? 'pill'} size={20} />
                    </div>
                  ); })()}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-gray-900 text-sm">{point.name}</h4>
                      {typeof point.price === 'number' && <span className="font-bold text-gray-900 text-sm">{point.price} {point.currency}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">{formatExplorerPrimaryMeta(point)}</p>
                    {point.type === Category.PHARMACY && (
                      <p className="micro-label text-gray-500 mt-1">{formatPharmacyOpenStatus(point)}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-[11px] font-medium text-gray-400 uppercase">{t('Updated', 'Mis à jour')} {point.lastUpdated}</span>
                      {point.verified && (
                        <span className="micro-label px-1.5 py-0.5 bg-forest-wash text-forest rounded-full">{t('Verified', 'Vérifié')}</span>
                      )}
                    </div>
                  </div>
                  <MapPin size={16} className="text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'map' && (
          <BottomSheet
            peekHeight={80}
            onSnapChange={setSheetSnap}
            hidden={false}
            isLowEndDevice={isLowEndDevice}
          >
            <MissionCards
              cards={missionCards as MissionCard[]}
              sheetSnap={sheetSnap}
              activeAssignment={activeAssignment}
              showAgentWidgets={showAgentWidgets}
              language={language}
            />
          </BottomSheet>
        )}

        {onContribute && (
          <button
            type="button"
            onClick={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                launchSingleCapture();
              }
            }}
            onPointerDown={handleContributePressStart}
            onPointerUp={handleContributePressEnd}
            onPointerLeave={() => {
              if (contributePressTimer.current) {
                window.clearTimeout(contributePressTimer.current);
                contributePressTimer.current = null;
              }
            }}
            onPointerCancel={() => {
              if (contributePressTimer.current) {
                window.clearTimeout(contributePressTimer.current);
                contributePressTimer.current = null;
              }
            }}
            onContextMenu={(event) => event.preventDefault()}
            className={`motion-pressable button-breathe fixed right-4 w-16 h-16 bg-terra text-white rounded-full flex items-center justify-center z-40 transition-all duration-200 ${
              sheetSnap !== 'peek' ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{
              bottom: 'calc(6rem + var(--safe-bottom) + 80px)',
              boxShadow: '0 6px 28px rgba(200,107,74,0.4), 0 2px 8px rgba(200,107,74,0.2)',
            }}
            aria-label={
              isAuthenticated
                ? t('Contribute', 'Contribuer')
                : t('Sign in to contribute', 'Connectez-vous pour contribuer')
            }
          >
            <span className="ring-pulse absolute inset-0 rounded-full border border-terra/30" aria-hidden="true" />
            <Plus size={22} />
          </button>
        )}

        {onContribute && sheetSnap === 'peek' && (
          <div
            className="surface-reveal fixed right-4 z-40"
            style={{ bottom: 'calc(10.25rem + var(--safe-bottom) + 80px)' }}
          >
            <div className="rounded-full bg-white/96 px-3 py-2 micro-label text-gray-500 shadow-lg">
              {t('Tap to add one • Hold for multiple', 'Appuyez pour ajouter • Maintenez pour plusieurs')}
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <button
            onClick={onAuth}
            className="motion-pressable absolute top-20 left-4 right-4 bg-white p-3 rounded-xl shadow-xl border border-gray-100 z-20 flex items-center justify-between"
          >
            <span className="text-sm font-bold text-gray-900">{t('Sign in to contribute', 'Connectez-vous pour contribuer')}</span>
            <span className="px-3 py-1.5 bg-navy text-white micro-label rounded-lg">{t('Sign In', 'Connexion')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
