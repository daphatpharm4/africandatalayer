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
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  Plus,
  Route,
  Sparkles,
  Target,
  User,
  X
} from 'lucide-react';
import FilterChipRow from '../shared/FilterChipRow';
import VerticalIcon from '../shared/VerticalIcon';
import VerticalPickerBar from '../shared/VerticalPickerBar';
import { categoryLabel as getCategoryLabel, LEGACY_CATEGORY_MAP, VERTICALS } from '../../shared/verticals';
import { apiJson } from '../../lib/client/api';
import {
  ADMIN_MAP_SCOPE_EVENT,
  ADMIN_MAP_SCOPE_STORAGE_KEY,
  readStoredAdminMapScope,
} from '../../lib/client/adminMapScope';
import { readCachedMapPoints, writeCachedMapPoints } from '../../lib/client/mapPointsCache';
import { detectLowEndDevice } from '../../lib/client/deviceProfile';
import { isNative } from '../../lib/client/native';
import BrandLogo from '../BrandLogo';
import { runViewTransition } from '../../lib/client/motion';
import BottomSheet from '../shared/BottomSheet';
import type { SnapPoint } from '../shared/BottomSheet';
import MissionCards from '../MissionCards';
import type { MissionCard } from '../MissionCards';
import {
  collectablePlatformProjects,
  type PlatformFieldContext,
} from '../../lib/client/platformFieldContext';
import { listApprovedPlatformRecordsRequest, nearbyPlatformPointsRequest } from '../../lib/client/platformApi';
import type { PlatformNearbyPoint, PlatformRecord } from '../../shared/platformTypes';

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

interface Props {
  onSelectPoint: (point: DataPoint) => void;
  onPrefetchDetails?: () => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  userRole?: UserRole;
  onAuth: () => void;
  onContribute?: (options?: { batch?: boolean; assignment?: CollectionAssignment | null }) => void;
  onProfile: () => void;
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
  language: 'en' | 'fr';
  platformFieldContext?: PlatformFieldContext | null;
  platformFieldContextError?: string;
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

const Home: React.FC<Props> = ({
  onSelectPoint,
  onPrefetchDetails,
  isAuthenticated,
  isAdmin,
  userRole = 'agent',
  onAuth,
  onContribute,
  onProfile,
  activeCategory,
  onCategoryChange,
  language,
  platformFieldContext = null,
  platformFieldContextError = '',
}) => {
  const [deviceRuntime] = useState(() => ({ lowEnd: detectLowEndDevice() }));
  const [viewMode, setViewMode] = useState<'map' | 'list'>(() => (deviceRuntime.lowEnd ? 'list' : 'map'));
  const [isVerticalPickerOpen, setIsVerticalPickerOpen] = useState(false);
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [pointsLoadError, setPointsLoadError] = useState('');
  const [nearbyCompanyPoints, setNearbyCompanyPoints] = useState<PlatformNearbyPoint[]>([]);
  const [nearbyCompanyProjectId, setNearbyCompanyProjectId] = useState('');
  const [nearbyPointsLoadError, setNearbyPointsLoadError] = useState('');
  const [isLoadingNearbyPoints, setIsLoadingNearbyPoints] = useState(false);
  const [nearbyReloadToken, setNearbyReloadToken] = useState(0);
  const [agentLocation, setAgentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [agentLocationError, setAgentLocationError] = useState('');
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [activeCompanyVerticalId, setActiveCompanyVerticalId] = useState('');
  const [mapScope, setMapScope] = useState<MapScope>(() => (isAdmin ? readStoredAdminMapScope() : 'bonamoussadi'));
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('peek');
  const contributePressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const verticalPickerRef = useRef<HTMLDivElement>(null);
  const isLowEndDevice = deviceRuntime.lowEnd;
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const companyOrganizations = platformFieldContext?.organizations ?? [];
  const isCompanyExplore = companyOrganizations.length > 0;
  const isCompanyContextPending = isAuthenticated
    && userRole !== 'client'
    && userRole !== 'point_operator'
    && platformFieldContext === null
    && !platformFieldContextError;
  const isPublicExplore = !isCompanyExplore && !isCompanyContextPending;
  const companyVerticals = useMemo(() => collectablePlatformProjects(platformFieldContext).flatMap((entry) => (
    entry.publishedSchema.definition.recordTypes.map((recordType) => ({
      id: `${entry.project.id}:${recordType.key}`,
      label: recordType.label[language],
      organizationId: entry.organization.id,
      organizationName: entry.organization.name,
      projectName: entry.project.name,
      coverageScope: entry.project.coverageScope ?? 'worldwide',
      coverageLabel: entry.project.coverageLabel,
    }))
  )), [language, platformFieldContext]);
  const activeCompanyVertical = companyVerticals.find((entry) => entry.id === activeCompanyVerticalId)
    ?? companyVerticals[0]
    ?? null;
  const primaryCompany = companyOrganizations.find((entry) => entry.organization.id === activeCompanyVertical?.organizationId)
    ?? companyOrganizations[0]
    ?? null;
  const isPrimaryCompanySuspended = primaryCompany?.organization.accessStatus === 'suspended';
  const companyCoverageLabel = activeCompanyVertical?.coverageScope === 'worldwide'
    ? t('Worldwide', 'Monde entier')
    : activeCompanyVertical?.coverageLabel ?? t('Coverage not set', 'Zone non définie');
  const showAgentWidgets = isAuthenticated && userRole !== 'client';
  const listContentTopInset = isLowEndDevice ? (isAdmin ? '18.5rem' : '15rem') : (isAdmin ? '15rem' : '11.75rem');
  const listContentTopInsetPx = isLowEndDevice ? (isAdmin ? 296 : 240) : (isAdmin ? 240 : 188);
  const bottomNavHeightPx = 80;
  const missionPeekHeightPx = isPublicExplore ? 152 : 0;
  const mapBottomChromePx = bottomNavHeightPx + missionPeekHeightPx + 12;
  const floatingCtaOffsetPx = missionPeekHeightPx + 20;
  const floatingHintOffsetPx = missionPeekHeightPx + 88;

  useEffect(() => {
    if (companyVerticals.length === 0) {
      setActiveCompanyVerticalId('');
      return;
    }
    if (!companyVerticals.some((entry) => entry.id === activeCompanyVerticalId)) {
      setActiveCompanyVerticalId(companyVerticals[0].id);
    }
  }, [activeCompanyVerticalId, companyVerticals]);
  const mapScopeOptions: Array<{ value: MapScope; label: string }> = [
    { value: 'bonamoussadi', label: t('Bonamoussadi', 'Bonamoussadi') },
    { value: 'cameroon', label: t('Cameroon', 'Cameroun') },
    { value: 'global', label: t('Worldwide', 'Monde entier') },
  ];
  const mapCacheAuthKey = useMemo(
    () => `${isAuthenticated ? 'auth' : 'anon'}:${isAdmin ? 'admin' : userRole}`,
    [isAuthenticated, isAdmin, userRole],
  );
  const viewModeTabs: Array<{ value: 'map' | 'list'; label: string }> = [
    { value: 'map', label: t('Map', 'Carte') },
    { value: 'list', label: t('List', 'Liste') },
  ];
  const toggleCategoryPicker = () => setIsVerticalPickerOpen((prev) => !prev);
  const setViewModeWithTransition = (next: 'map' | 'list') => {
    if (viewMode === next) return;
    void runViewTransition(() => setViewMode(next));
  };

  useEffect(() => {
    if (!isVerticalPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (verticalPickerRef.current && !verticalPickerRef.current.contains(e.target as Node)) {
        setIsVerticalPickerOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVerticalPickerOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVerticalPickerOpen]);

  const effectiveMapScope: MapScope = isCompanyExplore ? 'global' : mapScope;
  const selectedCityLabel = isCompanyExplore
    ? companyCoverageLabel
    : mapScope === 'cameroon'
      ? t('Cameroon', 'Cameroun')
      : mapScope === 'global'
        ? t('Worldwide', 'Monde entier')
        : t('Bonamoussadi, Douala, Cameroon', 'Bonamoussadi, Douala, Cameroun');

  const mapCenter: [number, number] =
    isCompanyExplore
      ? [20, 0]
      : mapScope === 'cameroon'
      ? [CAMEROON_CENTER.latitude, CAMEROON_CENTER.longitude]
      : mapScope === 'global'
        ? [20, 0]
        : [BONAMOUSSADI_CENTER.latitude, BONAMOUSSADI_CENTER.longitude];
  const mapZoom = isCompanyExplore ? 3 : mapScope === 'cameroon' ? 6 : mapScope === 'global' ? 2 : 15;
  const mapMinZoom = isCompanyExplore ? 2 : mapScope === 'cameroon' ? 5 : mapScope === 'global' ? 2 : 15;
  const mapMaxZoom = isCompanyExplore ? 19 : mapScope === 'cameroon' ? 10 : mapScope === 'global' ? 18 : 19;
  const mapBounds = isCompanyExplore
    ? undefined
    : mapScope === 'bonamoussadi' ? BONAMOUSSADI_MAP_BOUNDS : mapScope === 'cameroon' ? CAMEROON_MAP_BOUNDS : undefined;
  const mapLockLabel = isCompanyExplore
    ? t('Company workspace', 'Espace entreprise')
    : mapScope === 'bonamoussadi'
      ? t('Zone active', 'Zone active')
      : t('Full access', 'Accès complet');

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
    if (point.platformRecord) {
      return `${point.platformRecord.recordTypeLabel} · ${t('Company verified', 'Vérifié par l’entreprise')}`;
    }
    if (point.platformEnrichmentTarget) {
      return `${t('ADL verified point', 'Point ADL vérifié')} · ${point.lastUpdated}`;
    }
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

  const mapPlatformRecordToPoint = (record: PlatformRecord): DataPoint | null => {
    const gps = record.evidence.gps;
    if (!gps) return null;
    const vertical = companyVerticals.find((entry) => (
      entry.organizationId === record.organizationId
      && entry.id === `${record.projectId}:${record.recordTypeKey}`
    ));
    const preferredName = ['name', 'title', 'label', 'site_name', 'siteName', 'description']
      .map((key) => record.data[key])
      .find((value) => typeof value === 'string' && value.trim().length > 0);
    const fallbackName = Object.values(record.data)
      .find((value) => typeof value === 'string' && value.trim().length > 0);
    const recordTypeLabel = vertical?.label ?? record.recordTypeKey.replaceAll('_', ' ');
    return {
      id: record.id,
      name: String(preferredName ?? fallbackName ?? recordTypeLabel),
      type: Category.CENSUS_PROXY,
      location: `GPS: ${gps.latitude.toFixed(5)}°, ${gps.longitude.toFixed(5)}°`,
      coordinates: { latitude: gps.latitude, longitude: gps.longitude },
      lastUpdated: formatTimeAgo(record.reviewedAt ?? record.createdAt),
      updatedAtIso: record.reviewedAt ?? record.createdAt,
      availability: 'High',
      trustScore: 100,
      contributorTrust: t('Company approved', 'Approuvé par l’entreprise'),
      photoUrl: record.evidence.photos[0],
      details: {
        ...record.data,
        companyRecord: true,
        reviewStatus: record.status,
        gpsAccuracyMeters: gps.accuracyMeters,
        evidenceNotes: record.evidence.notes,
        capturedAt: record.evidence.capturedAt ?? record.createdAt,
      },
      gaps: [],
      verified: true,
      platformRecord: {
        ...record,
        recordTypeLabel,
      },
    };
  };

  const getListCardTone = (point: DataPoint) => {
    if (point.type === Category.PHARMACY) return 'bg-forest-wash text-forest-dark';
    if (point.type === Category.FUEL) return 'bg-terra-wash text-terra-dark';
    if (point.type === Category.MOBILE_MONEY) return 'bg-navy-wash text-navy';
    if (point.type === Category.ALCOHOL_OUTLET) return 'bg-red-50 text-red-800';
    if (point.type === Category.BILLBOARD) return 'bg-gold-wash text-amber-900';
    if (point.type === Category.TRANSPORT_ROAD) return 'bg-gray-100 text-gray-700';
    return 'bg-slate-100 text-slate-700';
  };

  const formatPharmacyOpenStatus = (point: DataPoint) => {
    if (point.type !== Category.PHARMACY) return null;
    return point.isOpenNow ? t('Ouvert maintenant', 'Ouvert maintenant') : t('Statut indisponible', 'Statut indisponible');
  };

  useEffect(() => {
    setMapScope(isAdmin ? readStoredAdminMapScope() : 'bonamoussadi');
  }, [isAuthenticated, isAdmin]);

  // React immediately when the scope is changed elsewhere (e.g. the Profile
  // screen's map-access control), even if this Home view stays mounted.
  useEffect(() => {
    if (typeof window === 'undefined' || !isAdmin) return;
    const handleScopeChange = (event: Event) => {
      const next = (event as CustomEvent<MapScope>).detail;
      if (next === 'bonamoussadi' || next === 'cameroon' || next === 'global') {
        setMapScope((prev) => (prev === next ? prev : next));
      }
    };
    window.addEventListener(ADMIN_MAP_SCOPE_EVENT, handleScopeChange);
    return () => window.removeEventListener(ADMIN_MAP_SCOPE_EVENT, handleScopeChange);
  }, [isAdmin]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (isAdmin) {
        window.localStorage.setItem(ADMIN_MAP_SCOPE_STORAGE_KEY, mapScope);
      } else {
        window.localStorage.removeItem(ADMIN_MAP_SCOPE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access failures.
    }
  }, [isAdmin, mapScope]);

  const loadPoints = async () => {
    if (isCompanyExplore && activeCompanyVertical) {
      try {
        setIsLoadingPoints(true);
        setPointsLoadError('');
        const records = await listApprovedPlatformRecordsRequest(activeCompanyVertical.organizationId);
        setPoints(records.map(mapPlatformRecordToPoint).filter((point): point is DataPoint => point !== null));
      } catch {
        setPoints([]);
        setPointsLoadError(t(
          'Company records failed to load. Tap retry or check your connection.',
          'Impossible de charger les données entreprise. Réessayez ou vérifiez votre connexion.',
        ));
      } finally {
        setIsLoadingPoints(false);
      }
      return;
    }
    if (!isPublicExplore) {
      setPoints([]);
      setIsLoadingPoints(false);
      setPointsLoadError('');
      return;
    }
    const cached = readCachedMapPoints(mapScope, { authKey: mapCacheAuthKey });
    if (cached) {
      const mapped = cached
        .map(mapProjectedToPoint)
        .filter((point) => (mapScope === 'bonamoussadi' ? isWithinBonamoussadi(point.coordinates) : true));
      setPoints(mapped);
      setIsLoadingPoints(false);
      setPointsLoadError('');
    }

    try {
      if (!cached) setIsLoadingPoints(true);
      setPointsLoadError('');
      const params = new URLSearchParams();
      if (mapScope !== 'bonamoussadi') params.set('scope', mapScope);
      const query = params.toString();
      const data = await apiJson<ProjectedPoint[]>(
        query ? `/api/submissions?${query}` : '/api/submissions',
        isNative() ? { credentials: 'omit' } : {}
      );
      if (Array.isArray(data)) {
        writeCachedMapPoints(mapScope, data, { authKey: mapCacheAuthKey });
        const mapped = data
          .map(mapProjectedToPoint)
          .filter((point) => (mapScope === 'bonamoussadi' ? isWithinBonamoussadi(point.coordinates) : true));
        setPoints(mapped);
      } else {
        setPoints([]);
      }
    } catch {
      if (!cached) {
        setPoints([]);
        setPointsLoadError(
          t(
            "Data points failed to load. Tap retry or check back in a moment.",
            "Impossible de charger les points. Réessayez ou revenez dans un instant."
          )
        );
      } else {
        setPointsLoadError(
          t(
            "Showing saved map data while the network catches up.",
            "Affichage des données carte enregistrées pendant la synchronisation."
          )
        );
      }
    } finally {
      setIsLoadingPoints(false);
    }
  };

  useEffect(() => {
    void loadPoints();
  }, [isPublicExplore, isCompanyExplore, activeCompanyVertical?.organizationId, mapScope, mapCacheAuthKey]);

  useEffect(() => {
    let cancelled = false;
    const loadAssignments = async () => {
      if (!isAuthenticated || userRole === 'client' || !isPublicExplore) {
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
  }, [isAuthenticated, isPublicExplore, userRole]);

  useEffect(() => {
    return () => {
      if (contributePressTimer.current) {
        window.clearTimeout(contributePressTimer.current);
      }
    };
  }, []);

  const filteredPoints = useMemo(() => points.filter((point) => {
    if (!isCompanyExplore) return point.type === activeCategory;
    return Boolean(activeCompanyVertical)
      && point.platformRecord?.organizationId === activeCompanyVertical.organizationId
      && point.platformRecord?.projectId === activeCompanyVertical.id.split(':', 1)[0]
      && point.platformRecord?.recordTypeKey === activeCompanyVertical.id.slice(activeCompanyVertical.id.indexOf(':') + 1);
  }), [activeCategory, activeCompanyVertical, isCompanyExplore, points]);

  // Org points are the company's own records — don't inject them as extra map
  // pins (that duplicated each asset and mislabeled it through the public
  // category mapper). Instead, join nearby targets onto the record pins by
  // chain root id so tapping a record offers "update this point".
  const nearbyTargetsByRoot = useMemo(() => {
    if (!activeCompanyVertical || nearbyCompanyProjectId !== activeCompanyVertical.id.split(':', 1)[0]) {
      return new Map<string, PlatformNearbyPoint>();
    }
    return new Map(nearbyCompanyPoints.map((point) => [point.pointId, point]));
  }, [activeCompanyVertical, nearbyCompanyPoints, nearbyCompanyProjectId]);

  const displayedPoints = useMemo(() => {
    if (!isCompanyExplore || !activeCompanyVertical) return filteredPoints;
    return filteredPoints.map((point) => {
      const record = point.platformRecord;
      if (!record) return point;
      const target = nearbyTargetsByRoot.get(record.pointId ?? record.id);
      if (!target) return point;
      return {
        ...point,
        platformEnrichmentTarget: { choiceKey: activeCompanyVertical.id, point: target },
      };
    });
  }, [activeCompanyVertical, filteredPoints, isCompanyExplore, nearbyTargetsByRoot]);

  const exploreLoadError = nearbyPointsLoadError || (isCompanyExplore ? agentLocationError : '') || pointsLoadError;
  const isLoadingExplorePoints = isLoadingPoints || isLoadingNearbyPoints;

  const mapPointGroups = useMemo<MapPointGroup[]>(() => {
    const groups = new Map<string, MapPointGroup>();
    for (const point of displayedPoints) {
      if (!point.coordinates) continue;
      if (!isCompanyExplore && mapScope === 'bonamoussadi' && !isWithinBonamoussadi(point.coordinates)) continue;
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
  }, [displayedPoints, isCompanyExplore, mapScope]);

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
  useEffect(() => {
    if (!isAuthenticated || userRole === 'client') {
      setAgentLocation(null);
      setAgentLocationError('');
      return undefined;
    }
    if (!navigator.geolocation) {
      setAgentLocationError(t(
        'Location is unavailable. Turn on GPS to see nearby ADL points.',
        'La localisation est indisponible. Activez le GPS pour voir les points ADL proches.',
      ));
      return undefined;
    }
    let cancelled = false;
    let watchId: number | null = null;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const startWatch = () => {
      if (cancelled) return;
      setAgentLocationError('');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setAgentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAgentLocationError('');
        },
        () => setAgentLocationError(t(
          'Location permission is required to see nearby ADL points.',
          'La localisation est nécessaire pour voir les points ADL proches.',
        )),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      );
    };

    const idleWindow = window as WindowWithIdleCallback;
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleId = idleWindow.requestIdleCallback(startWatch, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(startWatch, 1200);
    }

    return () => {
      cancelled = true;
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isAuthenticated, language, nearbyReloadToken, userRole]);

  const nearbyLatitude = agentLocation ? Number(agentLocation.lat.toFixed(4)) : null;
  const nearbyLongitude = agentLocation ? Number(agentLocation.lng.toFixed(4)) : null;
  useEffect(() => {
    let cancelled = false;
    if (
      !isCompanyExplore
      || !activeCompanyVertical
      || isPrimaryCompanySuspended
      || nearbyLatitude === null
      || nearbyLongitude === null
    ) {
      setNearbyCompanyPoints([]);
      setNearbyCompanyProjectId('');
      setNearbyPointsLoadError('');
      setIsLoadingNearbyPoints(false);
      return undefined;
    }

    const loadNearbyPoints = async () => {
      try {
        setIsLoadingNearbyPoints(true);
        setNearbyPointsLoadError('');
        const nearby = await nearbyPlatformPointsRequest({
          projectId: activeCompanyVertical.id.split(':', 1)[0],
          latitude: nearbyLatitude,
          longitude: nearbyLongitude,
          radiusMeters: 5000,
        });
        if (!cancelled) {
          setNearbyCompanyPoints(nearby);
          setNearbyCompanyProjectId(activeCompanyVertical.id.split(':', 1)[0]);
        }
      } catch {
        if (!cancelled) {
          setNearbyCompanyPoints([]);
          setNearbyCompanyProjectId('');
          setNearbyPointsLoadError(t(
            'Nearby ADL points failed to load. Check your GPS or connection, then retry.',
            'Impossible de charger les points ADL proches. Vérifiez votre GPS ou votre connexion, puis réessayez.',
          ));
        }
      } finally {
        if (!cancelled) setIsLoadingNearbyPoints(false);
      }
    };

    void loadNearbyPoints();
    return () => {
      cancelled = true;
    };
  }, [
    activeCompanyVertical?.id,
    isCompanyExplore,
    isPrimaryCompanySuspended,
    language,
    nearbyLatitude,
    nearbyLongitude,
    nearbyReloadToken,
  ]);

  const nearbyEnrichCount = useMemo(() => {
    if (!agentLocation) return 0;
    return displayedPoints.filter((p) => {
      if (!p.coordinates || !p.gaps || p.gaps.length === 0) return false;
      return haversineMeters(agentLocation.lat, agentLocation.lng, p.coordinates.latitude, p.coordinates.longitude) <= 200;
    }).length;
  }, [agentLocation, displayedPoints]);

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
  }, [activeAssignment, activeCategory, filteredPoints.length, isAuthenticated, nearbyEnrichCount, onAuth, onContribute, language, viewMode]);

  const launchSingleCapture = () => {
    if (isAuthenticated && onContribute) {
      onContribute({ assignment: activeAssignment });
      return;
    }
    onAuth();
  };

  const handleContributePressStart = () => {
    if (!isAuthenticated || !onContribute || isCompanyExplore) return;
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
      data-testid="screen-home"
      className="relative h-full min-h-0 bg-page overflow-x-hidden"
    >
      {userRole === 'client' ? (
        <header className="route-grid shrink-0 border-b border-gray-100 bg-white px-4 pb-3 pt-2.5 absolute top-0 left-0 right-0 z-20">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-[15px] font-bold text-ink-dark">{t('Map Explorer', 'Explorateur')}</div>
            <button
              type="button"
              onClick={() => setIsVerticalPickerOpen((v) => !v)}
              className="flex h-[34px] items-center gap-1 rounded-[10px] border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 motion-pressable"
            >
              <Filter size={13} />
              {t('Filter', 'Filtrer')}
            </button>
          </div>
          <FilterChipRow
            chips={selectableCategories.map((cat) => ({ id: cat, label: categoryLabel(cat) }))}
            active={activeCategory}
            onChange={onCategoryChange}
          />
        </header>
      ) : (
        <header className="route-grid absolute top-0 left-0 right-0 z-20 border-b border-gray-100 bg-white/95 px-[var(--screen-gutter)] pt-4 pb-3 backdrop-blur-xl">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                {isCompanyExplore ? (
                  primaryCompany?.organization.logoUrl ? (
                    <img
                      data-testid="company-explore-logo"
                      src={primaryCompany.organization.logoUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-lg border border-gray-100 bg-white object-contain"
                    />
                  ) : (
                    <span
                      data-testid="company-logo-fallback"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: primaryCompany?.organization.accentColor ?? '#0f2b46' }}
                      aria-hidden="true"
                    >
                      <Building2 size={17} />
                    </span>
                  )
                ) : (
                  <BrandLogo size={20} className="shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div data-testid={isCompanyExplore ? 'company-explore-name' : undefined} className="min-w-0 truncate text-[15px] font-bold leading-tight text-ink-dark">
                      {primaryCompany?.organization.name ?? t('African Data Layer', 'African Data Layer')}
                    </div>
                    {isAdmin && (
                      <span className="micro-label rounded-full bg-navy-wash px-2 py-0.5 text-navy">
                        {t('Admin', 'Admin')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-medium leading-4 text-gray-500">
                    {mapLockLabel} · {selectedCityLabel}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={isAuthenticated ? onProfile : onAuth}
              className="motion-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-navy/10 bg-navy-wash text-navy"
              aria-label={isAuthenticated ? t('Profile', 'Profil') : t('Sign in', 'Connexion')}
            >
              <User size={17} />
            </button>
          </div>

          <div ref={verticalPickerRef} className="relative">
            {isPrimaryCompanySuspended ? (
              <div className="flex min-h-14 items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3" role="alert">
                <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-800" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="micro-label block text-amber-900">{t('Company access suspended', 'Accès entreprise suspendu')}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-5 text-amber-900">
                    {primaryCompany?.organization.suspensionReason ?? t('Contact ADL support.', 'Contactez le support ADL.')}
                  </span>
                </span>
              </div>
            ) : isCompanyExplore ? (
              <button
                type="button"
                data-testid="company-vertical-picker"
                onClick={toggleCategoryPicker}
                aria-controls="home-company-vertical-picker-list"
                aria-expanded={isVerticalPickerOpen}
                disabled={companyVerticals.length === 0}
                className="motion-pressable flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-navy/10 bg-navy-wash px-4 text-left disabled:cursor-default"
              >
                <span className="min-w-0">
                  <span className="micro-label block text-navy">{t('Company vertical', 'Verticale entreprise')}</span>
                  <span className="block truncate text-sm font-semibold text-ink-dark">
                    {activeCompanyVertical?.label ?? t('No published company verticals', 'Aucune verticale entreprise publiée')}
                  </span>
                </span>
                {companyVerticals.length > 0 && <ChevronDown size={18} className="shrink-0 text-navy" aria-hidden="true" />}
              </button>
            ) : isCompanyContextPending ? (
              <div data-testid="company-context-loading" className="flex min-h-12 items-center rounded-2xl border border-gray-100 bg-white px-4 text-sm font-semibold text-gray-500">
                {t('Loading your workspace…', 'Chargement de votre espace…')}
              </div>
            ) : (
              <VerticalPickerBar
                active={activeCategory}
                onToggle={toggleCategoryPicker}
                language={language}
                ariaControls="home-vertical-picker-list"
                ariaExpanded={isVerticalPickerOpen}
              />
            )}
            {isVerticalPickerOpen && (
              <div id={isCompanyExplore ? 'home-company-vertical-picker-list' : 'home-vertical-picker-list'} className="absolute left-0 right-0 z-30 mt-2 max-h-[50vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-lg" role="listbox" aria-label={t('Category', 'Catégorie')}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {isCompanyExplore ? companyVerticals.map((entry) => {
                    const isActive = activeCompanyVertical?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setActiveCompanyVerticalId(entry.id);
                          setIsVerticalPickerOpen(false);
                        }}
                        className={`motion-pressable min-h-12 rounded-xl border px-3 py-2 text-left ${
                          isActive ? 'border-navy bg-navy text-white' : 'border-gray-100 bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="block text-xs font-semibold">{entry.label}</span>
                        <span className={`micro-label mt-1 block ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                          {entry.projectName}
                        </span>
                      </button>
                    );
                  }) : selectableCategories.map((category) => {
                    const verticalId = LEGACY_CATEGORY_MAP[category] ?? category;
                    const vertical = VERTICALS[verticalId];
                    const isActive = activeCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          onCategoryChange(category);
                          setIsVerticalPickerOpen(false);
                        }}
                        className={`motion-pressable flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
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

          {isLowEndDevice && (
            <div className="mt-3 rounded-2xl border border-navy-border bg-navy-wash px-3 py-2 text-[11px] font-semibold leading-4 text-navy">
              {t('Lite mode is on to keep map movement smooth on this phone.', 'Le mode allégé est activé pour garder la carte fluide sur ce téléphone.')}
            </div>
          )}

          {isAdmin && !isCompanyExplore && (
            <div data-testid="home-map-scope-toggle" className="mt-3 space-y-2">
              <div className="micro-label text-gray-400">{t('Map Scope', 'Portée de la carte')}</div>
              <div className="grid grid-cols-3 gap-2">
                {mapScopeOptions.map((scope) => {
                  const isActive = mapScope === scope.value;
                  return (
                    <button
                      key={scope.value}
                      type="button"
                      data-testid={`home-map-scope-${scope.value}`}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (isActive) return;
                        void runViewTransition(() => setMapScope(scope.value));
                      }}
                      className={`motion-pressable min-h-[44px] rounded-xl border px-3 text-xs font-semibold ${
                        isActive ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {scope.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3" aria-label={t('View mode', 'Mode de vue')}>
            <div className="flex gap-2">
              {viewModeTabs.map((tab) => {
                const active = viewMode === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={tab.label}
                    onClick={() => setViewModeWithTransition(tab.value)}
                    className={`motion-pressable flex h-9 flex-1 items-center justify-center rounded-xl text-xs font-semibold ${
                      active ? 'bg-navy text-white' : 'bg-white text-gray-500 shadow-sm'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </header>
      )}

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden"
        style={{ top: viewMode === 'list' ? listContentTopInset : '0px' }}
      >
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
              mapScope={effectiveMapScope}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              mapMinZoom={mapMinZoom}
              mapMaxZoom={mapMaxZoom}
              mapBounds={mapBounds}
              mapPointGroups={mapPointGroups}
              selectedCityLabel={selectedCityLabel}
              onSelectPoint={onSelectPoint}
              onPrefetchDetails={onPrefetchDetails}
              categoryLabel={categoryLabel}
              formatExplorerPrimaryMeta={formatExplorerPrimaryMeta}
              formatPharmacyOpenStatus={formatPharmacyOpenStatus}
              language={language}
              t={t}
              isLowEndDevice={isLowEndDevice}
              nearbyEnrichCount={nearbyEnrichCount}
              assignmentZones={assignmentZones}
              sheetSnap={sheetSnap}
              viewportTopInsetPx={listContentTopInsetPx}
              viewportBottomInsetPx={mapBottomChromePx}
              userRole={userRole}
              companyMode={isCompanyExplore}
            />
          </Suspense>
        )}
        {viewMode === 'map' && userRole === 'client' && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30">
            <div className="rounded-2xl bg-white/96 px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: VERTICALS[LEGACY_CATEGORY_MAP[activeCategory] ?? activeCategory]?.bgColor }}
                >
                  <VerticalIcon name={LEGACY_CATEGORY_MAP[activeCategory] ?? activeCategory} size={14} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-ink-dark">
                    {displayedPoints.length} {t('points', 'points')}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {categoryLabel(activeCategory)} · {t('Bonamoussadi', 'Bonamoussadi')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {viewMode === 'map' && exploreLoadError && !isLoadingExplorePoints && (
          <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-terra/20 bg-white/96 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-5 text-gray-900">{exploreLoadError}</p>
                <button
                  type="button"
                onClick={() => {
                    setPointsLoadError('');
                    setNearbyPointsLoadError('');
                    setAgentLocationError('');
                  }}
                  className="shrink-0 rounded-full p-2.5 text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={t('Dismiss', 'Fermer')}
                >
                  <X size={14} />
                </button>
              </div>
              <button
                type="button"
                  onClick={() => {
                    void loadPoints();
                    setNearbyReloadToken((current) => current + 1);
                  }}
                className="mt-3 rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-white"
              >
                {t('Try again', 'Réessayer')}
              </button>
            </div>
          </div>
        )}
        {viewMode === 'list' && (
          <div
            data-testid="home-list-view"
            className="surface-reveal no-scrollbar relative z-10 flex-1 overflow-y-auto bg-page min-h-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex flex-col gap-2.5 p-4 pb-24">
              <div className="text-[13px] font-semibold text-gray-700">
                {isCompanyExplore
                  ? t(`${displayedPoints.length} nearby ADL and company points`, `${displayedPoints.length} points ADL proches et entreprise`)
                  : `${displayedPoints.length} ${categoryLabel(activeCategory).toLowerCase()} ${t('points', 'points')}`}
              </div>
              {isLoadingExplorePoints && (
                <div className="card-soft p-4 text-xs text-gray-500">
                  {t('Loading data points...', 'Chargement des points de données...')}
                </div>
              )}
              {exploreLoadError && !isLoadingExplorePoints && (
                <div className="card-soft border border-terra/20 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-5 text-gray-900">{exploreLoadError}</p>
                    <button
                      type="button"
                    onClick={() => {
                        setPointsLoadError('');
                        setNearbyPointsLoadError('');
                        setAgentLocationError('');
                      }}
                      className="shrink-0 rounded-full p-2.5 text-gray-400 transition-colors hover:text-gray-600"
                      aria-label={t('Dismiss', 'Fermer')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                      onClick={() => {
                        void loadPoints();
                        setNearbyReloadToken((current) => current + 1);
                      }}
                    className="motion-pressable mt-3 rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-white"
                  >
                    {t('Try again', 'Réessayer')}
                  </button>
                </div>
              )}
              {displayedPoints.map((point) => {
                const locationLabel = point.location || t('Location unavailable', 'Localisation indisponible');
                const updatedLabel = point.lastUpdated;
                const verticalId = LEGACY_CATEGORY_MAP[point.type] ?? point.type;
                const vertical = VERTICALS[verticalId];

                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => onSelectPoint(point)}
                    onMouseEnter={() => onPrefetchDetails?.()}
                    className="card-soft motion-pressable flex w-full items-center gap-3 p-3.5 text-left"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${getListCardTone(point)}`}>
                      <VerticalIcon name={vertical?.icon ?? 'pill'} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="min-w-0 truncate text-[13px] font-semibold leading-tight text-ink-dark">{point.name}</h4>
                        {typeof point.price === 'number' && (
                          <span className="shrink-0 whitespace-nowrap text-xs font-bold text-ink-dark">
                            {point.price.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {point.currency ?? 'XAF'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-gray-500">{locationLabel}</p>
                      <p className="mt-1 truncate text-[11px] text-gray-500">{formatExplorerPrimaryMeta(point)}</p>
                      {point.type === Category.PHARMACY && (
                        <p className="micro-label mt-1 text-gray-500">{formatPharmacyOpenStatus(point)}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">{t('Updated', 'Mis à jour')} {updatedLabel}</span>
                        {point.verified && (
                          <span className="micro-label rounded-full bg-forest-wash px-1.5 py-0.5 text-forest-dark">
                            {t('Verified', 'Vérifié')}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
                  </button>
                );
              })}
              {isCompanyExplore && displayedPoints.length === 0 && !isLoadingExplorePoints && (
                <div data-testid="company-map-empty-state" className="card-soft p-5 text-center">
                  <p className="text-sm font-semibold text-ink-dark">
                    {t('No nearby ADL or company points yet', 'Aucun point ADL proche ou point entreprise pour le moment')}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {t('Move closer to a mapped point or use Contribute to capture a new record.', 'Rapprochez-vous d’un point cartographié ou utilisez Contribuer pour créer un enregistrement.')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'map' && isAuthenticated && isPublicExplore && (
          <BottomSheet
            peekHeight={missionPeekHeightPx}
            onSnapChange={setSheetSnap}
            hidden={false}
            isLowEndDevice={isLowEndDevice}
          >
            <div className="-mx-4 shrink-0 border-t border-gray-100 bg-white px-4 py-3">
              <MissionCards
                cards={missionCards as MissionCard[]}
                sheetSnap={sheetSnap}
                activeAssignment={activeAssignment}
                showAgentWidgets={showAgentWidgets}
                language={language}
              />
            </div>
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
              bottom: `calc(var(--bottom-nav-height) + var(--safe-bottom) + ${floatingCtaOffsetPx}px)`,
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

        {onContribute && isAuthenticated && isPublicExplore && sheetSnap === 'peek' && (
          <div
            className="surface-reveal fixed right-4 z-40"
            style={{ bottom: `calc(var(--bottom-nav-height) + var(--safe-bottom) + ${floatingHintOffsetPx}px)` }}
          >
            <div className="max-w-[14rem] rounded-2xl bg-white/96 px-3 py-2 text-[11px] font-semibold leading-4 text-gray-600 shadow-lg">
              {t('Tap for one point. Press and hold to start a batch.', 'Touchez pour un point. Maintenez pour lancer une série.')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
