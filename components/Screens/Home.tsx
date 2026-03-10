import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Category, DataPoint } from '../../types';
import type { CollectionAssignment, MapScope, PointEvent, ProjectedPoint, UserRole } from '../../shared/types';
import {
  BONAMOUSSADI_CENTER,
  CAMEROON_CENTER,
  bonamoussadiLeafletBounds,
  cameroonLeafletBounds,
  isWithinBonamoussadi
} from '../../shared/geofence';
import {
  ChevronDown,
  List,
  Map as MapIcon,
  MapPin,
  Plus,
  ShieldCheck,
  User
} from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
import { categoryLabel as getCategoryLabel, LEGACY_CATEGORY_MAP, VERTICALS } from '../../shared/verticals';
import { apiJson } from '../../lib/client/api';
import { detectLowEndDevice } from '../../lib/client/deviceProfile';
import { getSession } from '../../lib/client/auth';
import { listQueueItems, subscribeQueueSnapshot, type QueueItem } from '../../lib/client/offlineQueue';
import {
  computeAverageQualityForToday,
  computeContributionSummary,
  mapQueuedItemsToContributionActivities,
} from '../../lib/shared/contributionMetrics';
import BrandLogo from '../BrandLogo';
import DailyProgressWidget from '../DailyProgressWidget';
import StreakTracker from '../StreakTracker';

interface Props {
  onSelectPoint: (point: DataPoint) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  userRole?: UserRole;
  onAuth: () => void;
  onContribute?: (options?: { batch?: boolean; assignment?: CollectionAssignment | null }) => void;
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

const Home: React.FC<Props> = ({ onSelectPoint, isAuthenticated, isAdmin, userRole = 'agent', onAuth, onContribute, onProfile, language }) => {
  const [deviceRuntime] = useState(() => ({ lowEnd: detectLowEndDevice() }));
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => (deviceRuntime.lowEnd ? 'list' : 'map'));
  const [activeCategory, setActiveCategory] = useState<Category>(Category.PHARMACY);
  const [isVerticalPickerOpen, setIsVerticalPickerOpen] = useState(false);
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [agentEvents, setAgentEvents] = useState<PointEvent[]>([]);
  const [queuedItems, setQueuedItems] = useState<QueueItem[]>([]);
  const [mapScope, setMapScope] = useState<MapScope>(() => (isAdmin ? 'global' : 'bonamoussadi'));
  const contributePressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const isLowEndDevice = deviceRuntime.lowEnd;
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const showAgentWidgets = isAuthenticated && userRole !== 'client';

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
      details,
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

  useEffect(() => {
    let cancelled = false;
    const loadAgentData = async () => {
      if (!isAuthenticated || userRole === 'client') {
        setAssignments([]);
        setAgentEvents([]);
        return;
      }

      try {
        const eventsParams = new URLSearchParams({ view: 'events' });
        if (isAdmin) eventsParams.set('scope', 'global');
        const [session, assignmentData, eventData] = await Promise.all([
          getSession(),
          apiJson<CollectionAssignment[]>('/api/user?view=assignments'),
          apiJson<PointEvent[]>(`/api/submissions?${eventsParams.toString()}`),
        ]);
        const userId = session?.user?.id?.toLowerCase().trim() ?? '';
        if (cancelled) return;
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        const ownEvents = Array.isArray(eventData)
          ? eventData.filter((event) => (typeof event.userId === 'string' ? event.userId.toLowerCase().trim() : '') === userId)
          : [];
        setAgentEvents(ownEvents);
      } catch {
        if (cancelled) return;
        setAssignments([]);
        setAgentEvents([]);
      }
    };

    void loadAgentData();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAdmin, language, userRole]);

  useEffect(() => {
    if (!showAgentWidgets) {
      setQueuedItems([]);
      return;
    }

    let cancelled = false;
    const loadQueuedItems = async () => {
      try {
        const items = await listQueueItems();
        if (!cancelled) setQueuedItems(items);
      } catch {
        if (!cancelled) setQueuedItems([]);
      }
    };

    void loadQueuedItems();
    const unsubscribe = subscribeQueueSnapshot(() => {
      void loadQueuedItems();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [showAgentWidgets]);

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
  const syncedActivities = useMemo(
    () => agentEvents.map((event) => ({
      createdAt: event.createdAt,
      eventType: event.eventType,
      details: event.details,
    })),
    [agentEvents],
  );
  const queuedActivities = useMemo(() => mapQueuedItemsToContributionActivities(queuedItems), [queuedItems]);
  const contributionSummary = useMemo(
    () => computeContributionSummary([...syncedActivities, ...queuedActivities]),
    [queuedActivities, syncedActivities],
  );
  const averageQuality = useMemo(() => computeAverageQualityForToday(syncedActivities), [syncedActivities]);
  const submissionsToday = contributionSummary.submissionsToday;
  const enrichmentsToday = contributionSummary.enrichmentsToday;
  const streakDays = contributionSummary.streakDays;
  const streakActiveDays = contributionSummary.activeWeekdays;
  const dailyTarget = activeAssignment?.pointsExpected && activeAssignment.pointsExpected > 0 ? activeAssignment.pointsExpected : 10;

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
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f9fafb] no-scrollbar"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
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
              {userRole === 'client' && (
                <span className="px-2 py-0.5 rounded-full bg-[#fff8f4] text-[#c86b4a] text-[9px] font-bold uppercase tracking-widest">
                  {t('Client', 'Client')}
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

        <div className="relative mb-2">
          <button
            onClick={() => setIsVerticalPickerOpen((prev) => !prev)}
            className="w-full h-11 px-3 bg-gray-100 rounded-xl text-xs font-semibold text-[#0f2b46] flex items-center justify-between"
          >
            <span>
              {t('Vertical', 'Verticale')}: {categoryLabel(activeCategory)}
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
                        setActiveCategory(category);
                        setIsVerticalPickerOpen(false);
                      }}
                      className={`h-10 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 ${
                        isActive ? 'bg-[#0f2b46] text-white border-[#0f2b46]' : 'bg-gray-50 text-gray-600 border-gray-100'
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

        {showAgentWidgets && activeAssignment && (
          <div className="mb-3 rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                  {t('Active Assignment', 'Affectation active')}
                </div>
                <h4 className="mt-1 text-base font-bold text-gray-900">{activeAssignment.zoneLabel}</h4>
                <p className="mt-1 text-xs text-gray-500">
                  {activeAssignment.assignedVerticals.map((vertical) => getCategoryLabel(vertical, language)).join(', ')}
                </p>
              </div>
              <div className="rounded-full bg-[#f2f6fa] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                {activeAssignment.status}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>{t('Progress', 'Progression')}</span>
                <span>{activeAssignment.pointsSubmitted}/{activeAssignment.pointsExpected}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0f2b46] to-[#4c7c59]" style={{ width: `${Math.min(100, activeAssignment.completionRate)}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {t('Due', 'Echeance')}: {activeAssignment.dueDate}
              </div>
              {onContribute && (
                <button
                  type="button"
                  onClick={() => onContribute({ assignment: activeAssignment })}
                  className="h-10 rounded-2xl bg-[#0f2b46] px-4 text-[10px] font-bold uppercase tracking-widest text-white"
                >
                  {t('Start Capture', 'Commencer la capture')}
                </button>
              )}
            </div>
          </div>
        )}

        {showAgentWidgets && (
          <div className="mb-3 grid grid-cols-1 gap-3">
            <DailyProgressWidget
              language={language}
              submissionsToday={submissionsToday}
              enrichmentsToday={enrichmentsToday}
              averageQuality={averageQuality}
              streakDays={streakDays}
              dailyTarget={dailyTarget}
            />
            <StreakTracker language={language} streakDays={streakDays} activeDays={streakActiveDays} />
          </div>
        )}
      </header>

      <div className="relative flex flex-1 flex-col overflow-hidden min-h-[26rem]">
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
              nearbyEnrichCount={nearbyEnrichCount}
              assignmentZones={assignmentZones}
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
                  {(() => { const vid = LEGACY_CATEGORY_MAP[point.type] ?? point.type; const v = VERTICALS[vid]; return (
                    <div className="p-3 rounded-xl" style={{ backgroundColor: v?.bgColor ?? '#f3f4f6', color: v?.color ?? '#374151' }}>
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
            className="fixed bottom-[calc(6rem+var(--safe-bottom))] right-4 w-14 h-14 bg-[#c86b4a] text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:bg-[#b85f3f] active:scale-95 transition-all"
            aria-label={
              isAuthenticated
                ? t('Contribute', 'Contribuer')
                : t('Sign in to contribute', 'Connectez-vous pour contribuer')
            }
          >
            <Plus size={22} />
          </button>
        )}

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
