import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  MapPin,
  ShieldCheck,
  Signal
} from 'lucide-react';
import { categoryLabel as getCategoryLabel, VERTICALS } from '../../shared/verticals';
import { BASE_EVENT_XP } from '../../shared/xp';
import VerticalIcon from '../shared/VerticalIcon';
import {
  enqueueSubmission,
  flushOfflineQueue,
  getQueueStats,
  retryQueueItem,
  updateQueueItemPayload,
  type QueueItem,
  type QueueSyncSummary,
} from '../../lib/client/offlineQueue';
import { detectLowEndDevice, getClientDeviceInfo } from '../../lib/client/deviceProfile';
import { collectGpsIntegrity } from '../../lib/client/gpsIntegrity';
import { hashDataUrl } from '../../lib/client/photoIntegrity';
import { sendSubmissionPayload, toSubmissionSyncError } from '../../lib/client/submissionSync';
import { apiJson } from '../../lib/client/api';
import type { ClientExifData, CollectionAssignment, ConsentStatus, DedupCheckResult, SubmissionCategory, SubmissionInput } from '../../shared/types';
import { ENRICH_FIELD_CATALOG, getEnrichFieldLabel, type EnrichFieldConfig, type EnrichFieldOption } from '../../shared/enrichFieldCatalog';
import { Category } from '../../types';
import type { ContributionMode, DataPoint } from '../../types';
import exifr from 'exifr';
import XPPopup from '../XPPopup';
import LevelUpCelebration from '../LevelUpCelebration';
import VoiceMicButton from '../shared/VoiceMicButton';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  language: 'en' | 'fr';
  mode: ContributionMode;
  seedPoint: DataPoint | null;
  queuedDraft?: QueueItem | null;
  assignment?: CollectionAssignment | null;
  isBatchMode?: boolean;
  onQueueOpen?: () => void;
  onDraftConsumed?: () => void;
  onBatchExit?: () => void;
}

type Vertical = SubmissionCategory;

const providerOptions = ['MTN', 'Orange', 'Airtel'];
const fuelTypeOptions = ['Super', 'Diesel', 'Gas'];
const outletTypeOptions = ['bar', 'restaurant', 'off_licence', 'street_vendor', 'nightclub'];
const billboardTypeOptions = ['standard', 'digital', 'street_furniture', 'wall_paint', 'poster', 'informal'];
const roadConditionOptions = ['good', 'fair', 'poor', 'impassable'];
const roadSurfaceOptions = ['asphalt', 'laterite', 'gravel', 'earth', 'concrete'];
const roadBlockageOptions = ['flooding', 'construction', 'accident', 'debris', 'market_encroachment'];
const buildingTypeOptions = ['residential', 'commercial', 'mixed', 'industrial', 'institutional', 'religious'];
const occupancyStatusOptions = ['occupied', 'partially_occupied', 'vacant', 'under_construction'];
const openingHourPresets = ['08:00 - 20:00', '09:00 - 19:00', '24/7'];

const PHOTO_GUIDE_CONFIG: Record<string, { frameLabel: { en: string; fr: string }; tips: Array<{ en: string; fr: string }> }> = {
  pharmacy: {
    frameLabel: { en: 'Pharmacy', fr: 'Pharmacie' },
    tips: [
      { en: 'Capture the green cross sign and full storefront', fr: 'Capturez le signe de la croix verte et la devanture complète' },
      { en: 'Include the pharmacy name if visible', fr: 'Incluez le nom de la pharmacie si visible' },
    ],
  },
  mobile_money: {
    frameLabel: { en: 'Mobile Money', fr: 'Mobile Money' },
    tips: [
      { en: 'Show the provider logo and agent booth', fr: 'Montrez le logo du fournisseur et le kiosque agent' },
      { en: 'Capture visible signage', fr: 'Capturez la signalisation visible' },
    ],
  },
  fuel_station: {
    frameLabel: { en: 'Fuel Station', fr: 'Station-service' },
    tips: [
      { en: 'Capture the brand sign and pump area', fr: 'Capturez le panneau de marque et la zone de pompe' },
      { en: 'Include price display if visible', fr: 'Incluez l\'affichage des prix si visible' },
    ],
  },
  alcohol_outlet: {
    frameLabel: { en: 'Alcohol Outlet', fr: 'Point de vente' },
    tips: [
      { en: 'Show the business sign and entrance', fr: 'Montrez l\'enseigne et l\'entrée' },
      { en: 'Capture any license information', fr: 'Capturez toute information de licence' },
    ],
  },
  billboard: {
    frameLabel: { en: 'Billboard', fr: 'Panneau' },
    tips: [
      { en: 'Capture the full billboard face including frame', fr: 'Capturez la face complète du panneau avec le cadre' },
      { en: 'Include brand/advertiser text', fr: 'Incluez le texte de la marque/annonceur' },
    ],
  },
  transport_road: {
    frameLabel: { en: 'Road', fr: 'Route' },
    tips: [
      { en: 'Capture the road surface and any blockage', fr: 'Capturez la surface de la route et tout blocage' },
      { en: 'Show road condition clearly', fr: 'Montrez clairement l\'état de la route' },
    ],
  },
  census_proxy: {
    frameLabel: { en: 'Building', fr: 'Bâtiment' },
    tips: [
      { en: 'Capture the full building from ground to roof', fr: 'Capturez le bâtiment complet du sol au toit' },
      { en: 'Show the entrance and number of floors', fr: 'Montrez l\'entrée et le nombre d\'étages' },
    ],
  },
};
// Vercel serverless payload limit is 4.5MB; base64 adds ~33% overhead.
// Keep raw threshold at 3MB so base64 + JSON stays under 4.5MB.
const MAX_SUBMISSION_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 1600;
const IMAGE_QUALITY_LOW_END = 0.72;
const IMAGE_QUALITY_DEFAULT = 0.82;
const JPEG_MIME_TYPES = new Set(['image/jpeg', 'image/jpg']);

function normalizeText(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return value || null;
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  return Array.from(new Set(cleaned));
}

function normalizeNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function optionLabel(option: EnrichFieldOption, language: 'en' | 'fr'): string {
  return language === 'fr' ? option.labelFr : option.labelEn;
}

function firstStringRecordEntry(input: unknown): [string, string] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim()) return [key, value];
  }
  return null;
}

function firstNumberRecordEntry(input: unknown): [string, number] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value)) return [key, value];
  }
  return null;
}

function formatEnrichFieldValue(value: unknown, language: 'en' | 'fr'): string | null {
  if (typeof value === 'boolean') return value ? (language === 'fr' ? 'Oui' : 'Yes') : (language === 'fr' ? 'Non' : 'No');
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0)
      .join(', ');
    return joined || null;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => {
        if (typeof entryValue === 'string' || typeof entryValue === 'number') {
          const trimmed = String(entryValue).trim();
          return trimmed ? `${key}: ${trimmed}` : null;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));
    return entries.length > 0 ? entries.join(', ') : null;
  }
  return null;
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;
  const base64 = dataUrl.slice(commaIndex + 1);
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function extractJpegExifSegment(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;

    const segmentLength = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (segmentLength < 2) break;
    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > bytes.length) break;

    if (marker === 0xe1 && segmentLength >= 8) {
      const signature = String.fromCharCode(
        bytes[offset + 4] ?? 0,
        bytes[offset + 5] ?? 0,
        bytes[offset + 6] ?? 0,
        bytes[offset + 7] ?? 0,
        bytes[offset + 8] ?? 0,
        bytes[offset + 9] ?? 0,
      );
      if (signature === 'Exif\0\0') {
        return bytes.slice(offset, segmentEnd);
      }
    }

    offset = segmentEnd;
  }

  return null;
}

function injectExifIntoJpeg(compressedBytes: Uint8Array, exifSegment: Uint8Array): Uint8Array | null {
  if (compressedBytes.length < 2) return null;
  if (compressedBytes[0] !== 0xff || compressedBytes[1] !== 0xd8) return null;
  if (!exifSegment.length) return null;

  const merged = new Uint8Array(compressedBytes.length + exifSegment.length);
  merged[0] = compressedBytes[0];
  merged[1] = compressedBytes[1];
  merged.set(exifSegment, 2);
  merged.set(compressedBytes.slice(2), 2 + exifSegment.length);
  return merged;
}

async function preserveJpegExif(originalFile: File, compressedDataUrl: string): Promise<string> {
  if (!JPEG_MIME_TYPES.has((originalFile.type || '').toLowerCase())) return compressedDataUrl;

  const originalBytes = new Uint8Array(await originalFile.arrayBuffer());
  const exifSegment = extractJpegExifSegment(originalBytes);
  if (!exifSegment) return compressedDataUrl;

  const compressedBytes = dataUrlToBytes(compressedDataUrl);
  if (!compressedBytes) return compressedDataUrl;
  if (extractJpegExifSegment(compressedBytes)) return compressedDataUrl;

  const merged = injectExifIntoJpeg(compressedBytes, exifSegment);
  if (!merged) return compressedDataUrl;
  return bytesToDataUrl(merged, 'image/jpeg');
}

function parseDeviceFromUserAgent(): { make: string | null; model: string | null } {
  const ua = navigator.userAgent;
  // iPhone detection
  const iphoneMatch = ua.match(/iPhone/);
  if (iphoneMatch) return { make: 'Apple', model: 'iPhone' };
  // iPad detection
  const ipadMatch = ua.match(/iPad/);
  if (ipadMatch) return { make: 'Apple', model: 'iPad' };
  // Android device detection
  const androidMatch = ua.match(/;\s*([^;)]+)\s+Build\//);
  if (androidMatch) return { make: null, model: androidMatch[1]?.trim() ?? null };
  return { make: null, model: null };
}

async function extractClientExif(
  file: File,
  deviceLocation: { latitude: number; longitude: number } | null,
): Promise<ClientExifData | null> {
  // Step 1: Try extracting EXIF from the raw file (works on Android, some iOS versions)
  let lat: number | null = null;
  let lng: number | null = null;
  let capturedAt: string | null = null;
  let deviceMake: string | null = null;
  let deviceModel: string | null = null;

  try {
    const buffer = await file.arrayBuffer();
    const [exifData, gpsData] = await Promise.all([
      exifr.parse(buffer, { gps: true, exif: true, tiff: true, pick: [
        'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude',
        'DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate',
        'Make', 'Model',
      ] }).catch(() => null),
      exifr.gps(buffer).catch(() => null),
    ]);
    const merged = { ...(exifData ?? {}), ...(gpsData ?? {}) } as Record<string, unknown>;
    lat = typeof merged.latitude === 'number' ? merged.latitude : null;
    lng = typeof merged.longitude === 'number' ? merged.longitude : null;
    const rawDate = merged.DateTimeOriginal ?? merged.DateTimeDigitized ?? merged.CreateDate ?? merged.ModifyDate;
    if (rawDate instanceof Date) {
      capturedAt = rawDate.toISOString();
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      const m = rawDate.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      capturedAt = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : rawDate;
    }
    deviceMake = typeof merged.Make === 'string' ? merged.Make : null;
    deviceModel = typeof merged.Model === 'string' ? merged.Model : null;
  } catch {
    // EXIF parsing failed entirely -- fall through to device fallback
  }

  // Step 2: Fill gaps with browser APIs (critical for iOS which strips EXIF from <input capture>)
  if (deviceLocation) {
    if (lat == null) lat = deviceLocation.latitude;
    if (lng == null) lng = deviceLocation.longitude;
  }
  if (!capturedAt) {
    capturedAt = new Date().toISOString();
  }
  if (!deviceMake && !deviceModel) {
    const parsed = parseDeviceFromUserAgent();
    deviceMake = parsed.make;
    deviceModel = parsed.model;
  }

  if (lat == null && lng == null && !capturedAt && !deviceMake && !deviceModel) return null;
  return { latitude: lat, longitude: lng, capturedAt, deviceMake, deviceModel };
}

const pointTypeToVertical = (type: Category): Vertical => {
  if (type === Category.PHARMACY) return 'pharmacy';
  if (type === Category.FUEL) return 'fuel_station';
  if (type === Category.MOBILE_MONEY) return 'mobile_money';
  if (type === Category.ALCOHOL_OUTLET) return 'alcohol_outlet';
  if (type === Category.BILLBOARD) return 'billboard';
  if (type === Category.TRANSPORT_ROAD) return 'transport_road';
  if (type === Category.CENSUS_PROXY) return 'census_proxy';
  return 'pharmacy';
};

const ContributionFlow: React.FC<Props> = ({
  onBack,
  onComplete,
  language,
  mode,
  seedPoint,
  queuedDraft = null,
  assignment = null,
  isBatchMode = false,
  onQueueOpen,
  onDraftConsumed,
  onBatchExit,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [vertical, setVertical] = useState<Vertical>(() => (seedPoint ? pointTypeToVertical(seedPoint.type) : 'pharmacy'));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [draftImageBase64, setDraftImageBase64] = useState<string | null>(null);
  const [draftClientExif, setDraftClientExif] = useState<ClientExifData | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lastPosition, setLastPosition] = useState<GeolocationPosition | null>(null);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dedupCheck, setDedupCheck] = useState<DedupCheckResult | null>(null);
  const [pendingPayload, setPendingPayload] = useState<SubmissionInput | null>(null);
  const [selectedDedupPointId, setSelectedDedupPointId] = useState('');
  const [isResolvingDedup, setIsResolvingDedup] = useState(false);
  const [batchCapturedCount, setBatchCapturedCount] = useState(0);
  const [xpBreakdown, setXpBreakdown] = useState({ baseXp: 5, qualityBonus: 0, streakBonus: 0, totalXp: 5 });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('not_required');
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  const [siteName, setSiteName] = useState(seedPoint?.name ?? '');
  const [openingHours, setOpeningHours] = useState(seedPoint?.openingHours ?? '');
  const [isOpenNow, setIsOpenNow] = useState(seedPoint?.isOpenNow ?? true);
  const [isOnDuty, setIsOnDuty] = useState(seedPoint?.isOnDuty ?? false);
  const [providers, setProviders] = useState<string[]>(seedPoint?.providers ?? []);
  const [merchantId, setMerchantId] = useState(seedPoint?.merchantId ?? '');
  const [merchantProvider, setMerchantProvider] = useState(seedPoint?.providers?.[0] ?? providerOptions[0]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(seedPoint?.paymentMethods ?? []);
  const [hasFuelAvailable, setHasFuelAvailable] = useState(seedPoint?.hasFuelAvailable ?? true);
  const [fuelTypes, setFuelTypes] = useState<string[]>(seedPoint?.fuelTypes ?? (seedPoint?.fuelType ? [seedPoint.fuelType] : []));
  const [pricesByFuelDraft, setPricesByFuelDraft] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (seedPoint?.pricesByFuel && typeof seedPoint.pricesByFuel === 'object') {
      for (const [k, v] of Object.entries(seedPoint.pricesByFuel as Record<string, unknown>)) {
        if (Number.isFinite(v)) map[k] = String(v);
      }
    } else if (seedPoint?.fuelType && seedPoint?.price) {
      map[seedPoint.fuelType] = String(seedPoint.price);
    }
    return map;
  });
  const [quality, setQuality] = useState(seedPoint?.quality ?? 'Standard');
  const [outletType, setOutletType] = useState('bar');
  const [isFormal, setIsFormal] = useState(true);
  const [billboardType, setBillboardType] = useState('standard');
  const [isOccupied, setIsOccupied] = useState(true);
  const [advertiserBrand, setAdvertiserBrand] = useState('');
  const [roadName, setRoadName] = useState('');
  const [roadCondition, setRoadCondition] = useState('good');
  const [roadSurface, setRoadSurface] = useState('asphalt');
  const [roadBlocked, setRoadBlocked] = useState(false);
  const [blockageType, setBlockageType] = useState(roadBlockageOptions[0]);
  const [buildingType, setBuildingType] = useState('residential');
  const [occupancyStatus, setOccupancyStatus] = useState('occupied');
  const [storeyCount, setStoreyCount] = useState('');
  const [estimatedUnits, setEstimatedUnits] = useState('');
  const [enrichValues, setEnrichValues] = useState<Record<string, unknown>>({});
  const [enrichTouched, setEnrichTouched] = useState<Record<string, boolean>>({});
  const [enrichMultiRaw, setEnrichMultiRaw] = useState<Record<string, string>>({});
  const [isLowEndDevice] = useState<boolean>(() => detectLowEndDevice());

  const draftGapKeys = useMemo(() => {
    const details = (queuedDraft?.payload.details ?? {}) as Record<string, unknown>;
    return Object.keys(details).filter((field) => field !== 'clientDevice');
  }, [queuedDraft?.id, queuedDraft?.payload.details]);
  const seedPointDetails = useMemo(
    () => (seedPoint?.details && typeof seedPoint.details === 'object' ? seedPoint.details : {}) as Record<string, unknown>,
    [seedPoint?.id, seedPoint?.details],
  );
  const missingFields = useMemo(() => (seedPoint?.gaps && seedPoint.gaps.length > 0 ? seedPoint.gaps : draftGapKeys), [draftGapKeys, seedPoint]);
  const enrichableFields = useMemo(() => [...VERTICALS[vertical].enrichableFields], [vertical]);
  const editableEnrichFields = useMemo(() => {
    if (seedPoint) return enrichableFields;
    if (draftGapKeys.length === 0) return enrichableFields;
    const allowedFields = new Set(enrichableFields);
    const draftFields = draftGapKeys.filter((field) => allowedFields.has(field));
    return draftFields.length > 0 ? draftFields : enrichableFields;
  }, [draftGapKeys, enrichableFields, seedPoint]);
  const missingFieldSet = useMemo(() => new Set(missingFields), [missingFields]);
  const isEnrichMode = mode === 'ENRICH' && (Boolean(seedPoint) || Boolean(queuedDraft?.payload.pointId));

  const markEnrichTouched = (field: string) => {
    setEnrichTouched((prev) => ({ ...prev, [field]: true }));
  };

  const setEnrichFieldValue = (field: string, value: unknown) => {
    setEnrichValues((prev) => ({ ...prev, [field]: value }));
    markEnrichTouched(field);
  };

  const getEnrichFieldValue = (field: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(enrichValues, field)) {
      return enrichValues[field];
    }
    return seedPointDetails[field];
  };

  const renderEnrichFieldHint = (field: string) => {
    if (!seedPoint) return null;
    if (missingFieldSet.has(field)) {
      return <p className="text-[11px] font-medium text-terra-dark">{t('Currently missing', 'Actuellement manquant')}</p>;
    }
    const currentValue = formatEnrichFieldValue(seedPointDetails[field], language);
    if (!currentValue) return null;
    return <p className="text-[11px] text-gray-500">{t('Current', 'Actuel')}: {currentValue}</p>;
  };

  const toggleEnrichMultiValue = (field: string, value: string) => {
    const existing = normalizeStringList(getEnrichFieldValue(field));
    const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value];
    setEnrichFieldValue(field, next);
  };

  useEffect(() => {
    if (seedPoint) {
      setVertical(pointTypeToVertical(seedPoint.type));
    }
  }, [seedPoint]);

  useEffect(() => {
    if (queuedDraft) return;
    if (assignment?.assignedVerticals?.[0] && !isEnrichMode) {
      setVertical(assignment.assignedVerticals[0]);
    }
  }, [assignment?.assignedVerticals, isEnrichMode, queuedDraft]);

  useEffect(() => {
    setEnrichValues({});
    setEnrichTouched({});
    setEnrichMultiRaw({});
    const merchantEntry = firstStringRecordEntry(seedPointDetails.merchantIdByProvider);
    setMerchantId(merchantEntry?.[1] ?? seedPoint?.merchantId ?? '');
    setMerchantProvider(merchantEntry?.[0] ?? seedPoint?.providers?.[0] ?? providerOptions[0]);
    const rawPriceMap =
      seedPointDetails.pricesByFuel && typeof seedPointDetails.pricesByFuel === 'object'
        ? (seedPointDetails.pricesByFuel as Record<string, number>)
        : null;
    const nextDraft: Record<string, string> = {};
    if (rawPriceMap) {
      for (const [k, v] of Object.entries(rawPriceMap)) {
        if (Number.isFinite(v)) nextDraft[k] = String(v);
      }
    } else if (seedPoint?.fuelType && typeof seedPoint?.price === 'number') {
      nextDraft[seedPoint.fuelType] = String(seedPoint.price);
    }
    setPricesByFuelDraft(nextDraft);
  }, [isEnrichMode, seedPoint?.id, seedPoint?.merchantId, seedPoint?.price, seedPoint?.providers, seedPoint?.fuelType, seedPointDetails]);

  useEffect(() => {
    if (!isEnrichMode) return;
    clearDedupPrompt();
  }, [isEnrichMode, seedPoint?.id]);

  // 1A: GPS with accuracy tracking via watchPosition
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLastPosition(pos);
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsAccuracy(pos.coords.accuracy);
      },
      () => setLocation(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 1C: Smart defaults - read last vertical from localStorage
  useEffect(() => {
    if (seedPoint || queuedDraft || isEnrichMode) return;
    const lastVertical = localStorage.getItem('adl_last_vertical');
    if (lastVertical && lastVertical in VERTICALS) {
      setVertical(lastVertical as Vertical);
    }
  }, []);

  // 1C: Default isOpenNow based on time of day
  useEffect(() => {
    if (seedPoint || queuedDraft) return;
    const hour = new Date().getHours();
    setIsOpenNow(hour >= 8 && hour < 18);
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (!queuedDraft) {
      setDraftImageBase64(null);
      setDraftClientExif(null);
      return;
    }

    const details = (queuedDraft.payload.details ?? {}) as Record<string, unknown>;
    const merchantMap = details.merchantIdByProvider && typeof details.merchantIdByProvider === 'object'
      ? details.merchantIdByProvider as Record<string, string>
      : {};
    const firstMerchantProvider = Object.keys(merchantMap)[0];
    const priceMap = details.pricesByFuel && typeof details.pricesByFuel === 'object'
      ? (details.pricesByFuel as Record<string, number>)
      : {};

    setVertical(queuedDraft.payload.category as Vertical);
    setPhotoPreview(typeof queuedDraft.payload.imageBase64 === 'string' ? queuedDraft.payload.imageBase64 : null);
    setPhotoFile(null);
    setDraftImageBase64(typeof queuedDraft.payload.imageBase64 === 'string' ? queuedDraft.payload.imageBase64 : null);
    setDraftClientExif(queuedDraft.payload.clientExif ?? null);
    setLocation(queuedDraft.payload.location ?? null);
    setConsentStatus((queuedDraft.payload.consentStatus as ConsentStatus | undefined) ?? 'not_required');
    setSiteName(
      (typeof details.siteName === 'string' && details.siteName)
      || (typeof details.name === 'string' && details.name)
      || '',
    );
    setOpeningHours(typeof details.openingHours === 'string' ? details.openingHours : '');
    setIsOpenNow(typeof details.isOpenNow === 'boolean' ? details.isOpenNow : true);
    setIsOnDuty(typeof details.isOnDuty === 'boolean' ? details.isOnDuty : false);
    setProviders(Array.isArray(details.providers) ? details.providers.filter((value): value is string => typeof value === 'string') : []);
    setMerchantProvider(firstMerchantProvider ?? providerOptions[0]);
    setMerchantId(firstMerchantProvider ? merchantMap[firstMerchantProvider] ?? '' : (typeof details.merchantId === 'string' ? details.merchantId : ''));
    setPaymentMethods(Array.isArray(details.paymentMethods) ? details.paymentMethods.filter((value): value is string => typeof value === 'string') : []);
    setHasFuelAvailable(typeof details.hasFuelAvailable === 'boolean' ? details.hasFuelAvailable : true);
    setFuelTypes(Array.isArray(details.fuelTypes) ? details.fuelTypes.filter((value): value is string => typeof value === 'string') : []);
    const draftPrices: Record<string, string> = {};
    for (const [k, v] of Object.entries(priceMap)) {
      if (Number.isFinite(v)) draftPrices[k] = String(v);
    }
    setPricesByFuelDraft(draftPrices);
    setQuality(typeof details.quality === 'string' ? details.quality : 'Standard');
    setOutletType(typeof details.outletType === 'string' ? details.outletType : 'bar');
    setIsFormal(typeof details.isFormal === 'boolean' ? details.isFormal : true);
    setBillboardType(typeof details.billboardType === 'string' ? details.billboardType : 'standard');
    setIsOccupied(typeof details.isOccupied === 'boolean' ? details.isOccupied : true);
    setAdvertiserBrand(typeof details.advertiserBrand === 'string' ? details.advertiserBrand : '');
    setRoadName(
      (typeof details.roadName === 'string' && details.roadName)
      || (typeof details.name === 'string' && details.name)
      || '',
    );
    setRoadCondition(typeof details.condition === 'string' ? details.condition : 'good');
    setRoadSurface(typeof details.surfaceType === 'string' ? details.surfaceType : 'asphalt');
    setRoadBlocked(typeof details.isBlocked === 'boolean' ? details.isBlocked : false);
    setBlockageType(typeof details.blockageType === 'string' ? details.blockageType : roadBlockageOptions[0]);
    setBuildingType(typeof details.buildingType === 'string' ? details.buildingType : 'residential');
    setOccupancyStatus(typeof details.occupancyStatus === 'string' ? details.occupancyStatus : 'occupied');
    setStoreyCount(typeof details.storeyCount === 'number' ? String(details.storeyCount) : '');
    setEstimatedUnits(typeof details.estimatedUnits === 'number' ? String(details.estimatedUnits) : '');

    if (mode === 'ENRICH') {
      const nextEnrichValues = Object.fromEntries(
        Object.entries(details).filter(([field]) => field !== 'clientDevice'),
      );
      setEnrichValues(nextEnrichValues);
      setEnrichTouched(Object.fromEntries(Object.keys(nextEnrichValues).map((field) => [field, true])));
    }
  }, [mode, queuedDraft]);

  useEffect(() => {
    if (!isBatchMode) {
      setBatchCapturedCount(0);
    }
  }, [isBatchMode]);

  useEffect(() => {
    const onOnline = async () => {
      await syncQueuedItems();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const syncQueuedItems = async (): Promise<QueueSyncSummary | null> => {
    try {
      const summary = await flushOfflineQueue(sendSubmissionPayload);
      if (summary.permanentFailures > 0) {
        const reason = summary.permanentFailureMessages[0] ?? t('Submission rejected by server validation.', 'Soumission rejetée par la validation serveur.');
        const rejectedMessage = t(
          `${summary.permanentFailures} queued item(s) were rejected: ${reason}`,
          `${summary.permanentFailures} élément(s) en file ont été rejetés : ${reason}`
        );
        if (summary.failed > 0) {
          setSyncMessage(`${rejectedMessage} ${t(`${summary.failed} item(s) still pending sync.`, `${summary.failed} élément(s) en attente de synchronisation.`)}`);
        } else {
          setSyncMessage(rejectedMessage);
        }
      } else if (summary.failed > 0) {
        setSyncMessage(t(`Saved offline. ${summary.failed} item(s) still pending sync.`, `${summary.failed} élément(s) en attente de synchronisation.`));
      } else if (summary.synced > 0) {
        setSyncMessage(t('Saved offline and synced successfully.', 'Enregistré hors ligne puis synchronisé avec succès.'));
      } else {
        const stats = await getQueueStats();
        if (stats.total > 0) {
          setSyncMessage(t(`${stats.total} item(s) queued for sync.`, `${stats.total} élément(s) en file de synchronisation.`));
        }
      }
      return summary;
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : t('Saved offline. Sync will retry automatically.', 'Enregistré hors ligne. La synchronisation réessaiera automatiquement.'));
      return null;
    }
  };

  const getCurrentLocation = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(t('Geolocation not supported.', 'Géolocalisation non supportée.')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error(t('Unable to access location.', 'Impossible d\'accéder à la localisation.'))),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const retryLocation = async () => {
    setLocationError('');
    try {
      const current = await getCurrentLocation();
      setLocation(current);
      setShowManualLocation(false);
    } catch {
      setLocation(null);
      setLocationError(t('Unable to access location. Enter coordinates manually below.', 'Impossible d\'accéder à la localisation. Saisissez les coordonnées ci-dessous.'));
      setShowManualLocation(true);
    }
  };

  const parseManualLocation = () => {
    const latRaw = manualLatitude.trim();
    const lngRaw = manualLongitude.trim();
    if (!latRaw && !lngRaw) return null;
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setDraftImageBase64(null);
    setDraftClientExif(null);
    setPhotoError('');
    const nextPreview = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return nextPreview;
    });
  };

  const fileToBase64 = async (file: File) => {
    const readAsDataUrl = (target: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('Unable to read file.'));
        };
        reader.onerror = () => reject(new Error('Unable to read file.'));
        reader.readAsDataURL(target);
      });

    if (!file.type.startsWith('image/')) {
      return await readAsDataUrl(file);
    }

    // Keep original capture when possible so EXIF (GPS/time/device) reaches server-side forensics.
    if (file.size <= MAX_SUBMISSION_IMAGE_BYTES) {
      return await readAsDataUrl(file);
    }

    const loadImage = (objectUrl: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Unable to decode image.'));
        img.src = objectUrl;
      });

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      const maxDimension = Math.max(img.width, img.height);
      const scale = maxDimension > MAX_UPLOAD_DIMENSION ? MAX_UPLOAD_DIMENSION / maxDimension : 1;
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return await readAsDataUrl(file);
      }
      ctx.drawImage(img, 0, 0, width, height);
      const quality = isLowEndDevice ? IMAGE_QUALITY_LOW_END : IMAGE_QUALITY_DEFAULT;
      const compressed = canvas.toDataURL('image/jpeg', quality);
      return await preserveJpegExif(file, compressed);
    } catch {
      return await readAsDataUrl(file);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const toggleListValue = (current: string[], value: string): string[] => {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  };

  const buildCreateDetails = (): Record<string, unknown> => {
    const clientDevice = getClientDeviceInfo();
    if (vertical === 'pharmacy') {
      return {
        name: siteName.trim(),
        isOpenNow,
        isOnDuty,
        openingHours: openingHours.trim() || undefined,
        clientDevice
      };
    }
    if (vertical === 'mobile_money') {
      return {
        providers,
        openingHours: openingHours.trim() || undefined,
        paymentMethods: paymentMethods.length ? paymentMethods : undefined,
        merchantIdByProvider: merchantId.trim() ? { [merchantProvider]: merchantId.trim() } : undefined,
        clientDevice
      };
    }
    if (vertical === 'fuel_station') {
      const builtPrices: Record<string, number> = {};
      for (const [fuelType, raw] of Object.entries(pricesByFuelDraft)) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) builtPrices[fuelType] = parsed;
      }
      return {
        name: siteName.trim(),
        hasFuelAvailable,
        fuelTypes: fuelTypes.length ? fuelTypes : undefined,
        pricesByFuel: Object.keys(builtPrices).length > 0 ? builtPrices : undefined,
        quality,
        openingHours: openingHours.trim() || undefined,
        paymentMethods: paymentMethods.length ? paymentMethods : undefined,
        clientDevice
      };
    }
    if (vertical === 'alcohol_outlet') {
      return {
        name: siteName.trim(),
        outletType,
        isFormal,
        openingHours: openingHours.trim() || undefined,
        paymentMethods: paymentMethods.length ? paymentMethods : undefined,
        clientDevice
      };
    }
    if (vertical === 'billboard') {
      return {
        name: siteName.trim(),
        billboardType,
        isOccupied,
        advertiserBrand: advertiserBrand.trim() || undefined,
        clientDevice
      };
    }
    if (vertical === 'transport_road') {
      return {
        roadName: roadName.trim(),
        name: roadName.trim() || undefined,
        condition: roadCondition,
        surfaceType: roadSurface,
        isBlocked: roadBlocked,
        blockageType: roadBlocked ? blockageType : undefined,
        clientDevice
      };
    }
    const parsedStoreyCount = Number(storeyCount);
    const parsedEstimatedUnits = Number(estimatedUnits);
    return {
      buildingType,
      occupancyStatus,
      storeyCount: Number.isFinite(parsedStoreyCount) ? parsedStoreyCount : undefined,
      estimatedUnits: Number.isFinite(parsedEstimatedUnits) ? parsedEstimatedUnits : undefined,
      clientDevice
    };
  };

  const buildEnrichDetails = (): Record<string, unknown> => {
    const details: Record<string, unknown> = { clientDevice: getClientDeviceInfo() };
    for (const gap of editableEnrichFields) {
      const fieldConfig = ENRICH_FIELD_CATALOG[gap];
      if (!fieldConfig) {
        const fallback = normalizeText(getEnrichFieldValue(gap));
        if (fallback) details[gap] = fallback;
        continue;
      }

      if (fieldConfig.kind === 'map_value') {
        if (!enrichTouched[gap]) continue;
        if (gap === 'merchantIdByProvider') {
          const normalizedMerchantId = merchantId.trim();
          if (normalizedMerchantId) details.merchantIdByProvider = { [merchantProvider]: normalizedMerchantId };
          continue;
        }
        if (gap === 'pricesByFuel') {
          const builtPrices: Record<string, number> = {};
          for (const [fuelType, raw] of Object.entries(pricesByFuelDraft)) {
            const parsed = normalizeNumber(raw);
            if (parsed !== null && parsed > 0) builtPrices[fuelType] = parsed;
          }
          if (Object.keys(builtPrices).length > 0) details.pricesByFuel = builtPrices;
          continue;
        }
        const rawMap = getEnrichFieldValue(gap);
        if (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) {
          const normalizedMap = Object.fromEntries(
            Object.entries(rawMap as Record<string, unknown>)
              .map(([key, value]) => [key.trim(), normalizeText(value)])
              .filter(([key, value]) => key.length > 0 && Boolean(value)),
          );
          if (Object.keys(normalizedMap).length > 0) details[gap] = normalizedMap;
        }
        continue;
      }

      const rawValue = getEnrichFieldValue(gap);
      if (fieldConfig.kind === 'boolean') {
        if (enrichTouched[gap] && typeof rawValue === 'boolean') details[gap] = rawValue;
        continue;
      }
      if (fieldConfig.kind === 'text') {
        const normalized = normalizeText(rawValue);
        if (normalized) details[gap] = normalized;
        continue;
      }
      if (fieldConfig.kind === 'number') {
        const normalized = normalizeNumber(rawValue);
        if (normalized !== null) details[gap] = normalized;
        continue;
      }
      if (fieldConfig.kind === 'single_select') {
        const normalized = normalizeText(rawValue);
        if (normalized) details[gap] = normalized;
        continue;
      }
      if (fieldConfig.kind === 'multi_select') {
        const normalized = normalizeStringList(rawValue);
        if (normalized.length > 0) details[gap] = normalized;
      }
    }
    return details;
  };

  const validateBeforeSubmit = (details: Record<string, unknown>): boolean => {
    setPhotoError('');
    setLocationError('');
    setErrorMessage('');

    if (!photoFile && !draftImageBase64) {
      setPhotoError(t('Please capture a live photo before submitting.', 'Veuillez capturer une photo en direct avant de soumettre.'));
      return false;
    }

    if (!location && !parseManualLocation()) {
      setLocationError(t('Location is required. Tap "Retry GPS" or enter coordinates manually.', 'La localisation est requise. Appuyez sur « Réessayer GPS » ou saisissez les coordonnées.'));
      return false;
    }

    if (!isEnrichMode) {
      if (vertical === 'pharmacy' && !siteName.trim()) {
        setErrorMessage(t('Pharmacy name is required.', 'Le nom de la pharmacie est requis.'));
        return false;
      }
      if (vertical === 'mobile_money' && providers.length === 0) {
        setErrorMessage(t('Select at least one provider.', 'Sélectionnez au moins un opérateur.'));
        return false;
      }
      if (vertical === 'fuel_station' && !siteName.trim()) {
        setErrorMessage(t('Fuel station name is required.', 'Le nom de la station-service est requis.'));
        return false;
      }
      if (vertical === 'alcohol_outlet' && !siteName.trim()) {
        setErrorMessage(t('Alcohol outlet name is required.', 'Le nom du point de vente d\'alcool est requis.'));
        return false;
      }
      if (vertical === 'billboard' && !siteName.trim()) {
        setErrorMessage(t('Billboard name/description is required.', 'Le nom ou la description du panneau est requis.'));
        return false;
      }
      if (vertical === 'transport_road' && !roadName.trim()) {
        setErrorMessage(t('Road segment name is required.', 'Le nom du segment routier est requis.'));
        return false;
      }
      if (vertical === 'transport_road' && !roadCondition) {
        setErrorMessage(t('Road condition is required.', 'L\'état de la route est requis.'));
        return false;
      }
      if (vertical === 'census_proxy' && !buildingType) {
        setErrorMessage(t('Building type is required.', 'Le type de bâtiment est requis.'));
        return false;
      }
      if (vertical === 'census_proxy' && !occupancyStatus) {
        setErrorMessage(t('Occupancy status is required.', 'Le statut d\'occupation est requis.'));
        return false;
      }
    } else if (Object.keys(details).filter((field) => field !== 'clientDevice').length === 0) {
      setErrorMessage(t('Update at least one field before submitting.', 'Mettez à jour au moins un champ avant de soumettre.'));
      return false;
    }

    // Consent validation for PII-rich categories
    const piiRichCategories: SubmissionCategory[] = ['pharmacy', 'mobile_money'];
    if (piiRichCategories.includes(vertical) && consentStatus === 'not_required') {
      setErrorMessage(t(
        'This category involves personal data. Please select a consent status.',
        'Cette catégorie implique des données personnelles. Veuillez sélectionner un statut de consentement.',
      ));
      return false;
    }
    if (consentStatus === 'obtained' && !consentAcknowledged) {
      setErrorMessage(t(
        'Please acknowledge that consent was properly obtained.',
        'Veuillez confirmer que le consentement a été correctement obtenu.',
      ));
      return false;
    }

    return true;
  };

  const calculateXp = (payload: SubmissionInput) => {
    const baseXp = 5;
    const qualityBonus = payload.location ? 2 : 0;
    const detailsCount = Object.keys((payload.details ?? {}) as Record<string, unknown>).filter((field) => field !== 'clientDevice').length;
    const streakBonus = isBatchMode || detailsCount >= 3 ? 1 : 0;
    return {
      baseXp,
      qualityBonus,
      streakBonus,
      totalXp: baseXp + qualityBonus + streakBonus,
    };
  };

  const submitPayload = async (payload: SubmissionInput): Promise<boolean> => {
    const queuedItem = queuedDraft
      ? await updateQueueItemPayload(queuedDraft.id, payload)
      : await enqueueSubmission(payload);
    let summary: QueueSyncSummary | null = null;
    if (navigator.onLine) {
      if (queuedDraft && queuedItem) {
        summary = await retryQueueItem(queuedItem.id, sendSubmissionPayload);
      } else {
        summary = await syncQueuedItems();
      }
    } else {
      const stats = await getQueueStats();
      setSyncMessage(t(`Saved offline. ${stats.total} item(s) pending sync.`, `Enregistré hors ligne. ${stats.total} élément(s) en attente de synchronisation.`));
    }

    if (summary && queuedItem && summary.permanentFailureIds.includes(queuedItem.id)) {
      const reason = summary.permanentFailureMessages[0] ?? t('Submission rejected by server validation.', 'Soumission rejetée par la validation serveur.');
      setErrorMessage(reason);
      return false;
    }

    const xp = calculateXp(payload);
    setXpBreakdown(xp);

    // 1C: Save last vertical to localStorage
    localStorage.setItem('adl_last_vertical', vertical);

    // 3B: Level-up detection
    try {
      const prevXpStr = localStorage.getItem('adl_total_xp');
      const prevXp = prevXpStr ? Number(prevXpStr) : 0;
      const nextXp = prevXp + xp.totalXp;
      const prevLevel = Math.floor(prevXp / 100) + 1;
      const nextLevel = Math.floor(nextXp / 100) + 1;
      localStorage.setItem('adl_total_xp', String(nextXp));
      if (nextLevel > prevLevel) {
        setNewLevel(nextLevel);
        setShowLevelUp(true);
      }
    } catch {
      // localStorage not available
    }

    if (isBatchMode) {
      setBatchCapturedCount((prev) => prev + 1);
    }
    onDraftConsumed?.();
    setSubmitted(true);
    return true;
  };

  const maybePromptDedup = async (payload: SubmissionInput): Promise<boolean> => {
    if (isEnrichMode || !navigator.onLine) return false;
    if (!payload.location) return false;

    try {
      const details = (payload.details ?? {}) as Record<string, unknown>;
      const dedupName =
        (typeof details.siteName === 'string' && details.siteName.trim()) ||
        (typeof details.name === 'string' && details.name.trim()) ||
        (typeof details.roadName === 'string' && details.roadName.trim()) ||
        '';
      const params = new URLSearchParams({
        view: 'dedup_candidates',
        category: payload.category,
        lat: String(payload.location.latitude),
        lng: String(payload.location.longitude),
      });
      if (dedupName) params.set('name', dedupName);
      const result = await apiJson<DedupCheckResult>(`/api/submissions?${params.toString()}`);
      if (result.shouldPrompt && result.candidates.length > 0) {
        setDedupCheck(result);
        setPendingPayload(payload);
        setSelectedDedupPointId(result.bestCandidatePointId ?? result.candidates[0]?.pointId ?? '');
        setSyncMessage('');
        setErrorMessage('');
        return true;
      }
    } catch {
      // If pre-check fails, fall back to normal submission flow.
    }
    return false;
  };

  const clearDedupPrompt = () => {
    setDedupCheck(null);
    setPendingPayload(null);
    setSelectedDedupPointId('');
  };

  const handleSubmit = async () => {
    if (!photoFile && !draftImageBase64) {
      setPhotoError(t('Please capture a live photo before submitting.', 'Veuillez capturer une photo en direct avant de soumettre.'));
      return;
    }

    const manual = parseManualLocation();
    if ((manualLatitude.trim() || manualLongitude.trim()) && !manual) {
      setLocationError(t('Enter a valid latitude and longitude.', 'Entrez une latitude et une longitude valides.'));
      return;
    }

    const details = isEnrichMode ? buildEnrichDetails() : buildCreateDetails();
    if (!validateBeforeSubmit(details)) return;

    setSyncMessage('');
    setIsSubmitting(true);
    try {
      clearDedupPrompt();
      const imageBase64 = photoFile ? await fileToBase64(photoFile) : draftImageBase64;
      const clientExif = photoFile ? await extractClientExif(photoFile, location ?? manual ?? null) : draftClientExif;
      const gpsIntegrity = await collectGpsIntegrity(lastPosition);
      const photoEvidenceSha256 = imageBase64
        ? await hashDataUrl(imageBase64)
        : null;
      const payload: SubmissionInput = {
        eventType: isEnrichMode ? 'ENRICH_EVENT' : 'CREATE_EVENT',
        category: vertical,
        pointId: isEnrichMode ? (seedPoint?.id ?? queuedDraft?.payload.pointId) : undefined,
        location: location ?? manual ?? undefined,
        details,
        imageBase64: imageBase64 ?? undefined,
        clientExif,
        consentStatus,
        consentRecordedAt: new Date().toISOString(),
        gpsIntegrity,
        photoEvidenceSha256: photoEvidenceSha256 ?? undefined,
      };
      const blockedByDedup = await maybePromptDedup(payload);
      if (blockedByDedup) return;
      await submitPayload(payload);
    } catch (error) {
      const syncError = toSubmissionSyncError(error);
      setErrorMessage(syncError.message || t('Submission failed.', 'Échec de la soumission.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDedupUseExisting = async () => {
    if (!pendingPayload || !dedupCheck) return;
    const targetPointId = selectedDedupPointId || dedupCheck.bestCandidatePointId || dedupCheck.candidates[0]?.pointId;
    if (!targetPointId) {
      setErrorMessage(t('No target point selected for enrich mode.', 'Aucun point cible sélectionné pour le mode enrichissement.'));
      return;
    }

    setIsResolvingDedup(true);
    setErrorMessage('');
    try {
      const success = await submitPayload({
        ...pendingPayload,
        dedupDecision: 'use_existing',
        dedupTargetPointId: targetPointId,
      });
      if (success) clearDedupPrompt();
    } catch (error) {
      const syncError = toSubmissionSyncError(error);
      setErrorMessage(syncError.message || t('Submission failed.', 'Échec de la soumission.'));
    } finally {
      setIsResolvingDedup(false);
    }
  };

  const handleDedupCreateNew = async () => {
    if (!pendingPayload) return;
    setIsResolvingDedup(true);
    setErrorMessage('');
    try {
      const success = await submitPayload({
        ...pendingPayload,
        dedupDecision: 'allow_create',
      });
      if (success) clearDedupPrompt();
    } catch (error) {
      const syncError = toSubmissionSyncError(error);
      setErrorMessage(syncError.message || t('Submission failed.', 'Échec de la soumission.'));
    } finally {
      setIsResolvingDedup(false);
    }
  };

  const renderQualityPreview = () => {
    const gpsScore = gpsAccuracy === null ? 0 : gpsAccuracy <= 10 ? 100 : gpsAccuracy <= 25 ? 80 : gpsAccuracy <= 50 ? 60 : gpsAccuracy <= 100 ? 40 : 20;
    const photoScore = (photoPreview || draftImageBase64) ? 100 : 0;
    const requiredFields = VERTICALS[vertical]?.createRequiredFields ?? [];
    const details = isEnrichMode ? buildEnrichDetails() : buildCreateDetails();
    const filledCount = requiredFields.filter((f) => {
      const v = (details as Record<string, unknown>)[f];
      return v !== undefined && v !== null && v !== '';
    }).length;
    const completeness = requiredFields.length > 0 ? Math.round((filledCount / requiredFields.length) * 100) : 100;
    const estimatedXp = BASE_EVENT_XP + (gpsScore >= 60 ? 2 : 0) + (completeness >= 100 ? 1 : 0);
    const colorFor = (score: number) => score >= 80 ? 'text-forest' : score >= 50 ? 'text-gold' : 'text-terra';

    return (
      <div className="card p-4 space-y-3">
        <h4 className="micro-label text-gray-400">{t('Quality Preview', 'Aperçu qualité')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <Signal size={16} className={`mx-auto ${colorFor(gpsScore)}`} />
            <div className={`text-lg font-bold ${colorFor(gpsScore)}`}>{gpsScore}%</div>
            <div className="micro-label text-gray-400">{t('GPS', 'GPS')}</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <Camera size={16} className={`mx-auto ${colorFor(photoScore)}`} />
            <div className={`text-lg font-bold ${colorFor(photoScore)}`}>{photoScore}%</div>
            <div className="micro-label text-gray-400">{t('Photo', 'Photo')}</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <div className={`text-lg font-bold ${colorFor(completeness)}`}>{completeness}%</div>
            <div className="micro-label text-gray-400">{t('Fields', 'Champs')}</div>
          </div>
          <div className="rounded-xl bg-forest-wash p-3 text-center">
            <div className="text-lg font-bold text-forest">+{estimatedXp}</div>
            <div className="micro-label text-gray-400">{t('Est. XP', 'XP est.')}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderVerticalSelector = () => {
    if (isEnrichMode) return null;
    const verticalEntries = Object.values(VERTICALS) as Array<(typeof VERTICALS)[keyof typeof VERTICALS]>;
    return (
      <div className="card p-4 space-y-3">
        <h4 className="micro-label text-gray-400">{t('Category', 'Catégorie')}</h4>
        <div className="grid grid-cols-2 gap-2">
          {verticalEntries.map((v) => (
            <button
              key={v.id}
              onClick={() => setVertical(v.id as Vertical)}
              className={`h-11 rounded-xl border micro-label flex items-center justify-center gap-1 ${vertical === v.id ? `border-current` : 'border-gray-100 text-gray-500'}`}
              style={vertical === v.id ? { backgroundColor: v.bgColor, color: v.color, borderColor: v.color } : undefined}
            >
              <VerticalIcon name={v.icon} size={12} />
              {getCategoryLabel(v.id, language)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderCommonLocationBlock = () => (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin size={16} className="text-navy" />
          <span className="text-xs font-bold text-gray-900">{t('GPS Location', 'Localisation GPS')}</span>
        </div>
        <button onClick={retryLocation} className="micro-label text-navy">
          {t('Retry', 'Réessayer')}
        </button>
      </div>
      <p className="text-[11px] text-gray-500">
        {location
          ? `GPS: ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
          : t('GPS unavailable. Retry or enter coordinates manually.', 'GPS indisponible. Réessayez ou saisissez les coordonnées.')}
      </p>
      {location && gpsAccuracy !== null && (() => {
        const dots = gpsAccuracy <= 10 ? 5 : gpsAccuracy <= 25 ? 4 : gpsAccuracy <= 50 ? 3 : gpsAccuracy <= 100 ? 2 : 1;
        const label = dots >= 5 ? t('Excellent', 'Excellent') : dots >= 4 ? t('Good', 'Bon') : dots >= 3 ? t('Fair', 'Correct') : t('Poor', 'Faible');
        return (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i <= dots ? 'bg-forest' : 'bg-gray-200'}`} />
              ))}
            </div>
            <span className="micro-label text-gray-400">{label} ({Math.round(gpsAccuracy)}m)</span>
          </div>
        );
      })()}
      {!location && (
        <button
          onClick={() => setShowManualLocation((prev) => !prev)}
          className="micro-label text-terra"
        >
          {showManualLocation ? t('Hide Manual Entry', 'Masquer saisie manuelle') : t('Enter Coordinates Manually', 'Saisir les coordonnées')}
        </button>
      )}
      {showManualLocation && (
        <div className="grid grid-cols-2 gap-3">
          <input
            value={manualLatitude}
            onChange={(event) => setManualLatitude(event.target.value)}
            placeholder={t('Latitude', 'Latitude')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <input
            value={manualLongitude}
            onChange={(event) => setManualLongitude(event.target.value)}
            placeholder={t('Longitude', 'Longitude')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      )}
      {locationError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 micro-label text-red-600">
          {locationError}
        </div>
      )}
    </div>
  );

  const renderPhotoBlock = () => {
    const guide = PHOTO_GUIDE_CONFIG[vertical];
    return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-900">{t('Live Camera Proof', 'Preuve caméra en direct')}</h4>
      <p className="text-xs text-gray-500">{t('Camera capture only. Gallery uploads are blocked.', 'Capture caméra uniquement. Import galerie bloqué.')}</p>
      <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden">
        {photoPreview ? (
          <img src={photoPreview} alt={t('Captured photo', 'Photo capturée')} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            {guide && (
              <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-xl flex items-center justify-center pointer-events-none z-[1]">
                <span className="micro-label text-white/80 bg-black/20 px-3 py-1 rounded-full">
                  {language === 'fr' ? guide.frameLabel.fr : guide.frameLabel.en}
                </span>
              </div>
            )}
            <Camera size={46} className="mb-4 opacity-40" />
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">{t('Live capture required', 'Capture live requise')}</p>
          </>
        )}
        <input
          id="capture-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="sr-only"
        />
        <label
          htmlFor="capture-photo"
          className="relative z-10 mt-6 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 micro-label text-gray-600 shadow-sm hover:bg-gray-50"
        >
          {photoPreview ? t('Retake Photo', 'Reprendre photo') : t('Capture Photo', 'Capturer photo')}
        </label>
      </div>
      {photoError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 micro-label text-red-600">
          {photoError}
        </div>
      )}
      {guide && (
        <ul className="space-y-1 px-1">
          {guide.tips.map((tip, i) => (
            <li key={i} className="text-xs text-gray-500 flex items-start space-x-2">
              <span className="text-gray-300 mt-0.5">•</span>
              <span>{language === 'fr' ? tip.fr : tip.en}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
    );
  };

  const renderConsentBlock = () => (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-900">{t('Consent & Privacy', 'Consentement et confidentialité')}</h4>
          <p className="text-xs text-gray-500">
            {t(
              'Choose how this capture should be treated when people or owner-identifiable details are involved.',
              'Choisissez comment traiter cette capture lorsque des personnes ou des détails identifiants sont impliqués.',
            )}
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        {([
          { value: 'not_required', label: t('No consent needed', 'Pas de consentement requis') },
          { value: 'obtained', label: t('Consent obtained', 'Consentement obtenu') },
          { value: 'refused_pii_only', label: t('Consent refused: strip PII', 'Consentement refusé : retirer les DCP') },
        ] as Array<{ value: ConsentStatus; label: string }>).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => { setConsentStatus(option.value); setConsentAcknowledged(false); }}
            className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold ${
              consentStatus === option.value ? 'border-navy bg-navy-light text-navy' : 'border-gray-100 bg-gray-50 text-gray-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {consentStatus === 'refused_pii_only' && (
        <div className="rounded-xl border border-terra-wash bg-terra-wash p-3 text-[11px] text-terra-dark">
          {t(
            'Owner-identifiable fields will be stripped before upload. Avoid capturing faces or personal phone numbers.',
            'Les champs identifiants seront retirés avant l’envoi. Évitez de capturer des visages ou des numéros personnels.',
          )}
        </div>
      )}
      {consentStatus === 'obtained' && (
        <label className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentAcknowledged}
            onChange={(e) => setConsentAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
          />
          <span className="text-[11px] text-gray-600">
            {t(
              'I confirm that consent was obtained from the relevant person(s) before capturing this data.',
              'Je confirme que le consentement a été obtenu des personnes concernées avant de capturer ces données.',
            )}
          </span>
        </label>
      )}
    </div>
  );

  const renderCreateFields = () => {
    if (vertical === 'pharmacy') {
      return (
        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Pharmacy', 'Créer une pharmacie')}</h4>
          <div className="flex items-center gap-2">
            <input
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder={t('Pharmacy name', 'Nom de la pharmacie')}
              className="flex-1 h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
            />
            <VoiceMicButton language={language} onResult={(text) => setSiteName((prev) => prev ? `${prev} ${text}` : text)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Open now', 'Ouvert maintenant')}</span>
            <button
              onClick={() => setIsOpenNow((prev) => !prev)}
              className={`px-4 py-2 rounded-full micro-label ${isOpenNow ? 'bg-forest text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {isOpenNow ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }
    if (vertical === 'mobile_money') {
      return (
        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Kiosk', 'Créer un kiosque')}</h4>
          <div className="flex flex-wrap gap-2">
            {providerOptions.map((provider) => (
              <button
                key={provider}
                onClick={() => setProviders((prev) => toggleListValue(prev, provider))}
                className={`px-3 py-2 rounded-full micro-label ${providers.includes(provider) ? 'bg-navy text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {provider}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (vertical === 'fuel_station') {
      return (
        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Fuel Station', 'Créer une station-service')}</h4>
          <div className="flex items-center gap-2">
            <input
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder={t('Fuel station name', 'Nom de la station-service')}
              className="flex-1 h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
            />
            <VoiceMicButton language={language} onResult={(text) => setSiteName((prev) => prev ? `${prev} ${text}` : text)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Fuel available', 'Carburant disponible')}</span>
            <button
              onClick={() => setHasFuelAvailable((prev) => !prev)}
              className={`px-4 py-2 rounded-full micro-label ${hasFuelAvailable ? 'bg-forest text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {hasFuelAvailable ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
          <div className="space-y-1">
            <span className="micro-label text-gray-400">{t('Fuel prices (XAF)', 'Prix carburants (XAF)')}</span>
            <div className="space-y-2">
              {fuelTypeOptions.map((fuelType) => (
                <div key={fuelType} className="grid grid-cols-2 gap-3 items-center">
                  <span className="text-xs font-semibold text-gray-600">{fuelType}</span>
                  <input
                    type="number"
                    value={pricesByFuelDraft[fuelType] ?? ''}
                    onChange={(event) =>
                      setPricesByFuelDraft((prev) => ({ ...prev, [fuelType]: event.target.value }))
                    }
                    placeholder={t('Price (XAF)', 'Prix (XAF)')}
                    className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (vertical === 'alcohol_outlet') {
      return (
        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Alcohol Outlet', 'Créer un point de vente d\'alcool')}</h4>
          <input
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
            placeholder={t('Outlet name', 'Nom du point de vente')}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <select
            value={outletType}
            onChange={(event) => setOutletType(event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            {outletTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Formal / licensed', 'Formel / licencié')}</span>
            <button
              onClick={() => setIsFormal((prev) => !prev)}
              className={`px-4 py-2 rounded-full micro-label ${isFormal ? 'bg-forest text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {isFormal ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }

    if (vertical === 'billboard') {
      return (
        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Billboard', 'Créer un panneau')}</h4>
          <input
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
            placeholder={t('Billboard description', 'Description du panneau')}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <select
            value={billboardType}
            onChange={(event) => setBillboardType(event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            {billboardTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            value={advertiserBrand}
            onChange={(event) => setAdvertiserBrand(event.target.value)}
            placeholder={t('Advertiser brand (optional)', 'Marque annonceur (optionnel)')}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Occupied', 'Occupé')}</span>
            <button
              onClick={() => setIsOccupied((prev) => !prev)}
              className={`px-4 py-2 rounded-full micro-label ${isOccupied ? 'bg-forest text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {isOccupied ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }

    if (vertical === 'transport_road') {
      return (
        <div className="card p-4 space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Road Segment', 'Créer un segment routier')}</h4>
          <div className="flex items-center gap-2">
            <input
              value={roadName}
              onChange={(event) => setRoadName(event.target.value)}
              placeholder={t('Road name', 'Nom de route')}
              className="flex-1 h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
            />
            <VoiceMicButton language={language} onResult={(text) => setRoadName((prev) => prev ? `${prev} ${text}` : text)} />
          </div>
          <select
            value={roadCondition}
            onChange={(event) => setRoadCondition(event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            {roadConditionOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select
            value={roadSurface}
            onChange={(event) => setRoadSurface(event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            {roadSurfaceOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Blocked', 'Bloqué')}</span>
            <button
              onClick={() => setRoadBlocked((prev) => !prev)}
              className={`px-4 py-2 rounded-full micro-label ${roadBlocked ? 'bg-terra text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {roadBlocked ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
          {roadBlocked && (
            <select
              value={blockageType}
              onChange={(event) => setBlockageType(event.target.value)}
              className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
            >
              {roadBlockageOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
        </div>
      );
    }

    return (
      <div className="card p-4 space-y-4">
        <h4 className="text-sm font-bold text-gray-900">{t('Create Building', 'Créer un bâtiment')}</h4>
        <select
          value={buildingType}
          onChange={(event) => setBuildingType(event.target.value)}
          className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
        >
          {buildingTypeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <select
          value={occupancyStatus}
          onChange={(event) => setOccupancyStatus(event.target.value)}
          className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
        >
          {occupancyStatusOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            value={storeyCount}
            onChange={(event) => setStoreyCount(event.target.value)}
            placeholder={t('Storeys', 'Étages')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <input
            type="number"
            value={estimatedUnits}
            onChange={(event) => setEstimatedUnits(event.target.value)}
            placeholder={t('Estimated units', 'Unités estimées')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      </div>
    );
  };

  const renderEnrichFieldInput = (gap: string) => {
    const fieldConfig: EnrichFieldConfig | undefined = ENRICH_FIELD_CATALOG[gap];
    if (!fieldConfig) {
      const raw = typeof getEnrichFieldValue(gap) === 'string' ? String(getEnrichFieldValue(gap)) : '';
      return (
        <div className="space-y-2" key={gap}>
          <label className="micro-label text-gray-400">{gap}</label>
          {renderEnrichFieldHint(gap)}
          <input
            value={raw}
            onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      );
    }

    const label = getEnrichFieldLabel(gap, language);
    const options = fieldConfig.options ?? [];

    if (fieldConfig.kind === 'boolean') {
      const selected = typeof getEnrichFieldValue(gap) === 'boolean' ? (getEnrichFieldValue(gap) as boolean) : null;
      return (
        <div className="space-y-2" key={gap}>
          <label className="micro-label text-gray-400">{label}</label>
          {renderEnrichFieldHint(gap)}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEnrichFieldValue(gap, true)}
              className={`h-10 rounded-xl micro-label ${selected === true ? 'bg-forest text-white' : 'bg-gray-50 text-gray-500'}`}
            >
              {t('Yes', 'Oui')}
            </button>
            <button
              type="button"
              onClick={() => setEnrichFieldValue(gap, false)}
              className={`h-10 rounded-xl micro-label ${selected === false ? 'bg-terra text-white' : 'bg-gray-50 text-gray-500'}`}
            >
              {t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }

    if (fieldConfig.kind === 'map_value') {
      if (gap === 'merchantIdByProvider') {
        return (
          <div className="space-y-2" key={gap}>
            <label className="micro-label text-gray-400">{label}</label>
            {renderEnrichFieldHint(gap)}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={merchantProvider}
                onChange={(event) => {
                  markEnrichTouched(gap);
                  setMerchantProvider(event.target.value);
                }}
                className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
              >
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
              <input
                value={merchantId}
                onChange={(event) => {
                  markEnrichTouched(gap);
                  setMerchantId(event.target.value);
                }}
                placeholder={t('Merchant ID', 'ID marchand')}
                className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
              />
            </div>
          </div>
        );
      }
      if (gap === 'pricesByFuel') {
        return (
          <div className="space-y-2" key={gap}>
            <label className="micro-label text-gray-400">{label}</label>
            {renderEnrichFieldHint(gap)}
            <div className="space-y-2">
              {fuelTypeOptions.map((fuelType) => (
                <div key={fuelType} className="grid grid-cols-2 gap-3 items-center">
                  <span className="text-xs font-semibold text-gray-600">{fuelType}</span>
                  <input
                    type="number"
                    value={pricesByFuelDraft[fuelType] ?? ''}
                    onChange={(event) => {
                      markEnrichTouched(gap);
                      setPricesByFuelDraft((prev) => ({ ...prev, [fuelType]: event.target.value }));
                    }}
                    placeholder={t('Price (XAF)', 'Prix (XAF)')}
                    className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    if (fieldConfig.kind === 'text') {
      const value = typeof getEnrichFieldValue(gap) === 'string' ? String(getEnrichFieldValue(gap)) : '';
      const placeholder = language === 'fr' ? (fieldConfig.placeholderFr ?? fieldConfig.labelFr) : (fieldConfig.placeholderEn ?? fieldConfig.labelEn);
      return (
        <div className="space-y-2" key={gap}>
          <label className="micro-label text-gray-400">{label}</label>
          {renderEnrichFieldHint(gap)}
          {gap === 'openingHours' && (
            <div className="flex flex-wrap gap-2">
              {openingHourPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEnrichFieldValue(gap, preset)}
                  className={`px-3 py-2 rounded-full micro-label ${value === preset ? 'bg-navy text-white' : 'bg-gray-50 text-gray-500'}`}
                >
                  {preset}
                </button>
              ))}
            </div>
          )}
          <input
            value={value}
            onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
            placeholder={placeholder}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      );
    }

    if (fieldConfig.kind === 'number') {
      const value = typeof getEnrichFieldValue(gap) === 'number' || typeof getEnrichFieldValue(gap) === 'string'
        ? String(getEnrichFieldValue(gap))
        : '';
      return (
        <div className="space-y-2" key={gap}>
          <label className="micro-label text-gray-400">{label}</label>
          {renderEnrichFieldHint(gap)}
          <input
            type="number"
            value={value}
            onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      );
    }

    if (fieldConfig.kind === 'single_select') {
      const value = typeof getEnrichFieldValue(gap) === 'string' ? String(getEnrichFieldValue(gap)) : '';
      if (options.length === 0) {
        return (
          <div className="space-y-2" key={gap}>
            <label className="micro-label text-gray-400">{label}</label>
            {renderEnrichFieldHint(gap)}
            <input
              value={value}
              onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
              className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
            />
          </div>
        );
      }
      return (
        <div className="space-y-2" key={gap}>
          <label className="micro-label text-gray-400">{label}</label>
          {renderEnrichFieldHint(gap)}
          <select
            value={value}
            onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            <option value="">{t('Select...', 'Sélectionner...')}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>{optionLabel(option, language)}</option>
            ))}
          </select>
        </div>
      );
    }

    if (fieldConfig.kind === 'multi_select') {
      const selectedValues = normalizeStringList(getEnrichFieldValue(gap));
      if (options.length === 0) {
        const raw = enrichMultiRaw[gap] ?? selectedValues.join(', ');
        const placeholder = language === 'fr'
          ? (fieldConfig.placeholderFr ?? t('Valeurs séparées par virgules', 'Valeurs séparées par virgules'))
          : (fieldConfig.placeholderEn ?? t('Comma-separated values', 'Valeurs séparées par virgules'));
        return (
          <div className="space-y-2" key={gap}>
            <label className="micro-label text-gray-400">{label}</label>
            {renderEnrichFieldHint(gap)}
            <input
              value={raw}
              onChange={(event) => {
                const nextRaw = event.target.value;
                setEnrichMultiRaw((prev) => ({ ...prev, [gap]: nextRaw }));
                const nextValues = nextRaw.split(',').map((value) => value.trim()).filter((value) => value.length > 0);
                setEnrichFieldValue(gap, nextValues);
              }}
              placeholder={placeholder}
              className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
            />
          </div>
        );
      }
      return (
        <div className="space-y-2" key={gap}>
          <label className="micro-label text-gray-400">{label}</label>
          {renderEnrichFieldHint(gap)}
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleEnrichMultiValue(gap, option.value)}
                className={`px-3 py-2 rounded-full micro-label ${selectedValues.includes(option.value) ? 'bg-navy text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {optionLabel(option, language)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const fallbackRaw =
      typeof getEnrichFieldValue(gap) === 'string' || typeof getEnrichFieldValue(gap) === 'number'
        ? String(getEnrichFieldValue(gap))
        : '';
    return (
      <div className="space-y-2" key={gap}>
        <label className="micro-label text-gray-400">{label}</label>
        {renderEnrichFieldHint(gap)}
        <input
          value={fallbackRaw}
          onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
          className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
        />
      </div>
    );
  };

  const renderEnrichFields = () => (
    <div className="card p-4 space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-gray-900">{t('Update Point Fields', 'Mettre à jour les champs du point')}</h4>
        <p className="text-xs text-gray-500">
          {t(
            'Missing fields are highlighted. Filled fields can still be updated when something changes.',
            'Les champs manquants sont mis en avant. Les champs déjà remplis peuvent aussi être mis à jour si quelque chose change.',
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {editableEnrichFields.map((gap) => (
          <span
            key={gap}
            className={`micro-label px-2 py-1 rounded-full border ${
              missingFieldSet.has(gap)
                ? 'bg-terra-wash text-terra-dark border-terra-wash'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {getEnrichFieldLabel(gap, language)}
          </span>
        ))}
      </div>
      <div className="space-y-4">
        {editableEnrichFields.map((gap) => (
          <React.Fragment key={`enrich-${gap}`}>
            {renderEnrichFieldInput(gap)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const resetForAnotherCapture = () => {
    if (photoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setSubmitted(false);
    setPhotoPreview(null);
    setPhotoFile(null);
    setDraftImageBase64(null);
    setDraftClientExif(null);
    setLocation(null);
    setManualLatitude('');
    setManualLongitude('');
    setPhotoError('');
    setLocationError('');
    setErrorMessage('');
    setSyncMessage('');
    setPendingPayload(null);
    setSelectedDedupPointId('');
    setDedupCheck(null);
    setConsentStatus('not_required');
    setConsentAcknowledged(false);
    setSiteName('');
    setOpeningHours('');
    setProviders([]);
    setMerchantId('');
    setPaymentMethods([]);
    setFuelTypes([]);
    setPricesByFuelDraft({});
    setAdvertiserBrand('');
    setRoadName('');
    setStoreyCount('');
    setEstimatedUnits('');
    setEnrichValues({});
    setEnrichTouched({});
    setEnrichMultiRaw({});
  };

  const handleBackPress = () => {
    if (isBatchMode) {
      onBatchExit?.();
    }
    onBack();
  };

  const verticalIcon = <VerticalIcon name={VERTICALS[vertical]?.icon ?? 'pill'} size={18} />;

  if (submitted) {
    if (showLevelUp) {
      return (
        <LevelUpCelebration
          level={newLevel}
          language={language}
          onDismiss={() => setShowLevelUp(false)}
        />
      );
    }
    return (
      <XPPopup
        language={language}
        totalXp={xpBreakdown.totalXp}
        baseXp={xpBreakdown.baseXp}
        qualityBonus={xpBreakdown.qualityBonus}
        streakBonus={xpBreakdown.streakBonus}
        syncMessage={syncMessage}
        isBatchMode={isBatchMode}
        onPrimary={resetForAnotherCapture}
        onSecondary={() => {
          if (isBatchMode) {
            onBatchExit?.();
          }
          onComplete();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="pt-6 px-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={handleBackPress} className="p-1 -ml-1 text-gray-500">
            <ArrowLeft size={24} />
          </button>
          <span className="text-xs font-bold text-gray-900 uppercase tracking-[0.2em]">
            {isEnrichMode ? t('Enrich Point', 'Enrichir point') : t('Create Point', 'Créer point')}
          </span>
          <span className="w-6"></span>
        </div>
        <div className="flex items-center space-x-2 micro-label text-forest mb-3">
          <ShieldCheck size={12} />
          <span>{t('Live photo + GPS mandatory', 'Photo live + GPS obligatoires')}</span>
        </div>
        {(() => {
          const steps = [
            { label: t('Type', 'Type'), done: Boolean(vertical) },
            { label: t('Photo', 'Photo'), done: Boolean(photoPreview) },
            { label: t('GPS', 'GPS'), done: Boolean(location) },
            { label: t('Details', 'Détails'), done: Boolean(siteName) },
          ];
          return (
            <div className="flex items-center gap-1.5 mb-4">
              {steps.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full transition-colors ${step.done ? 'bg-forest' : 'bg-gray-200'}`} />
                    <span className={`micro-label ${step.done ? 'text-forest' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && <div className={`flex-1 h-px ${steps[i].done ? 'bg-forest' : 'bg-gray-200'}`} />}
                </React.Fragment>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-5">
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-navy">
            {verticalIcon}
            <span className="text-sm font-bold">
              {getCategoryLabel(vertical, language)}
            </span>
          </div>
          {isEnrichMode && seedPoint && (
            <span className="micro-label text-gray-400 truncate max-w-[140px]">
              {seedPoint.name}
            </span>
          )}
        </div>

        {assignment && (
          <div className="card p-4">
            <div className="micro-label-wide text-gray-400">{t('Assignment Context', 'Contexte affectation')}</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900">{assignment.zoneLabel}</div>
                <div className="text-xs text-gray-500">
                  {assignment.assignedVerticals.map((item) => getCategoryLabel(item, language)).join(', ')}
                </div>
              </div>
              <div className="text-right">
                <div className="micro-label text-navy">
                  {assignment.pointsSubmitted}/{assignment.pointsExpected}
                </div>
                <div className="text-[11px] text-gray-400">{t('Due', 'Échéance')} {assignment.dueDate}</div>
              </div>
            </div>
          </div>
        )}

        {isBatchMode && (
          <div className="bg-navy text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <div className="micro-label-wide text-white/70">{t('Batch Capture', 'Capture en lot')}</div>
              <div className="mt-1 text-sm font-bold">{t('Captured', 'Captures')}: {batchCapturedCount}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                onBatchExit?.();
                onComplete();
              }}
              className="rounded-full bg-white/10 px-3 py-2 micro-label"
            >
              {t('End Batch', 'Fin du lot')}
            </button>
          </div>
        )}

        {renderVerticalSelector()}
        {renderPhotoBlock()}
        {renderCommonLocationBlock()}
        {isEnrichMode ? renderEnrichFields() : renderCreateFields()}
        {renderConsentBlock()}
        {renderQualityPreview()}

        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 micro-label text-red-600">
            {errorMessage}
          </div>
        )}

        {dedupCheck && (
          <div className="rounded-2xl border border-terra-wash bg-terra-wash p-4 space-y-3">
            <div className="micro-label text-terra-dark">
              {t('Potential Duplicate', 'Doublon potentiel')}
            </div>
            <div className="text-xs text-gray-700">
              {t('A nearby point looks similar. Choose whether to enrich it or create a new one.', 'Un point proche semble similaire. Choisissez entre l\'enrichir ou créer un nouveau point.')}
            </div>
            <div className="space-y-2">
              {dedupCheck.candidates.map((candidate) => {
                const isSelected = selectedDedupPointId === candidate.pointId;
                return (
                  <button
                    key={candidate.pointId}
                    type="button"
                    onClick={() => setSelectedDedupPointId(candidate.pointId)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      isSelected ? 'border-terra bg-white' : 'border-terra-wash bg-terra-wash'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-900">
                      {candidate.siteName || candidate.pointId}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {candidate.distanceMeters}m · {t('similarity', 'similarité')}: {Math.round(candidate.similarityScore * 100)}%
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDedupUseExisting}
                disabled={isResolvingDedup}
                className={`h-10 rounded-xl micro-label ${
                  isResolvingDedup ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                }`}
              >
                {t('Enrich Existing', 'Enrichir existant')}
              </button>
              <button
                type="button"
                onClick={handleDedupCreateNew}
                disabled={isResolvingDedup}
                className={`h-10 rounded-xl micro-label ${
                  isResolvingDedup ? 'bg-gray-100 text-gray-400' : 'bg-terra text-white'
                }`}
              >
                {t('Create New', 'Créer nouveau')}
              </button>
            </div>
            <button
              type="button"
              onClick={clearDedupPrompt}
              className="micro-label text-gray-500"
            >
              {t('Dismiss', 'Ignorer')}
            </button>
          </div>
        )}

        {syncMessage && (
          <div className="rounded-xl border border-navy-border bg-white p-3 text-xs text-navy space-y-2">
            <div>{syncMessage}</div>
            {onQueueOpen && (
              <button
                type="button"
                onClick={onQueueOpen}
                className="micro-label text-navy"
              >
                {t('Open queue', 'Ouvrir la file')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 p-6 pt-2 bg-page border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isResolvingDedup || Boolean(dedupCheck)}
          className="w-full h-14 bg-navy text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-navy-dark active:scale-95 transition-all disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{t('Saving', 'Enregistrement')}</span>
            </>
          ) : (
            <span>{isEnrichMode ? t('Save Enrichment', 'Enregistrer enrichissement') : t('Create Point', 'Créer point')}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default ContributionFlow;
