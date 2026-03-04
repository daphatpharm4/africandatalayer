import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  MapPin,
  ShieldCheck
} from 'lucide-react';
import { categoryLabel as getCategoryLabel, VERTICALS } from '../../shared/verticals';
import VerticalIcon from '../shared/VerticalIcon';
import { enqueueSubmission, flushOfflineQueue, getQueueStats, type QueueSyncSummary } from '../../lib/client/offlineQueue';
import { detectLowEndDevice, getClientDeviceInfo } from '../../lib/client/deviceProfile';
import { sendSubmissionPayload, toSubmissionSyncError } from '../../lib/client/submissionSync';
import { apiJson } from '../../lib/client/api';
import type { ClientExifData, DedupCheckResult, SubmissionCategory, SubmissionInput } from '../../shared/types';
import { ENRICH_FIELD_CATALOG, getEnrichFieldLabel, type EnrichFieldConfig, type EnrichFieldOption } from '../../shared/enrichFieldCatalog';
import { Category, ContributionMode, DataPoint } from '../../types';
import exifr from 'exifr';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  language: 'en' | 'fr';
  mode: ContributionMode;
  seedPoint: DataPoint | null;
}

type Vertical = SubmissionCategory;

const providerOptions = ['MTN', 'Orange', 'Airtel'];
const paymentMethodOptions = ['Cash', 'Mobile Money', 'Card'];
const fuelTypeOptions = ['Super', 'Diesel', 'Gas'];
const outletTypeOptions = ['bar', 'restaurant', 'off_licence', 'street_vendor', 'nightclub'];
const billboardTypeOptions = ['standard', 'digital', 'street_furniture', 'wall_paint', 'poster', 'informal'];
const roadConditionOptions = ['good', 'fair', 'poor', 'impassable'];
const roadSurfaceOptions = ['asphalt', 'laterite', 'gravel', 'earth', 'concrete'];
const roadBlockageOptions = ['flooding', 'construction', 'accident', 'debris', 'market_encroachment'];
const buildingTypeOptions = ['residential', 'commercial', 'mixed', 'industrial', 'institutional', 'religious'];
const occupancyStatusOptions = ['occupied', 'partially_occupied', 'vacant', 'under_construction'];
const openingHourPresets = ['08:00 - 20:00', '09:00 - 19:00', '24/7'];
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

const ContributionFlow: React.FC<Props> = ({ onBack, onComplete, language, mode, seedPoint }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [vertical, setVertical] = useState<Vertical>(() => (seedPoint ? pointTypeToVertical(seedPoint.type) : 'pharmacy'));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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
  const [priceFuelType, setPriceFuelType] = useState(seedPoint?.fuelType ?? fuelTypeOptions[0]);
  const [priceValue, setPriceValue] = useState(seedPoint?.price ? String(seedPoint.price) : '');
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

  const gaps = useMemo(() => seedPoint?.gaps ?? [], [seedPoint]);
  const isEnrichMode = mode === 'ENRICH' && Boolean(seedPoint);

  const markEnrichTouched = (field: string) => {
    setEnrichTouched((prev) => ({ ...prev, [field]: true }));
  };

  const setEnrichFieldValue = (field: string, value: unknown) => {
    setEnrichValues((prev) => ({ ...prev, [field]: value }));
    markEnrichTouched(field);
  };

  const getEnrichFieldValue = (field: string): unknown => {
    return enrichValues[field];
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
    setEnrichValues({});
    setEnrichTouched({});
    setEnrichMultiRaw({});
    setMerchantId(seedPoint?.merchantId ?? '');
    setMerchantProvider(seedPoint?.providers?.[0] ?? providerOptions[0]);
    setPriceFuelType(seedPoint?.fuelType ?? fuelTypeOptions[0]);
    setPriceValue(seedPoint?.price ? String(seedPoint.price) : '');
  }, [isEnrichMode, seedPoint?.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocation(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

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
        const reason = summary.permanentFailureMessages[0] ?? t('Submission rejected by server validation.', 'Soumission rejetee par la validation serveur.');
        const rejectedMessage = t(
          `${summary.permanentFailures} queued item(s) were rejected: ${reason}`,
          `${summary.permanentFailures} element(s) en file ont ete rejetes : ${reason}`
        );
        if (summary.failed > 0) {
          setSyncMessage(`${rejectedMessage} ${t(`${summary.failed} item(s) still pending sync.`, `${summary.failed} element(s) en attente de synchronisation.`)}`);
        } else {
          setSyncMessage(rejectedMessage);
        }
      } else if (summary.failed > 0) {
        setSyncMessage(t(`Saved offline. ${summary.failed} item(s) still pending sync.`, `${summary.failed} element(s) en attente de synchronisation.`));
      } else if (summary.synced > 0) {
        setSyncMessage(t('Saved offline and synced successfully.', 'Enregistre hors ligne puis synchronise avec succes.'));
      } else {
        const stats = await getQueueStats();
        if (stats.total > 0) {
          setSyncMessage(t(`${stats.total} item(s) queued for sync.`, `${stats.total} element(s) en file de synchronisation.`));
        }
      }
      return summary;
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : t('Saved offline. Sync will retry automatically.', 'Enregistre hors ligne. La synchronisation reessaiera automatiquement.'));
      return null;
    }
  };

  const getCurrentLocation = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(t('Geolocation not supported.', 'Geolocalisation non supportee.')));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error(t('Unable to access location.', 'Impossible d\'acceder a la localisation.'))),
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
      setLocationError(t('Unable to access location. Use manual fallback coordinates.', 'Impossible d\'acceder a la localisation. Utilisez les coordonnees manuelles.'));
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
    setPhotoError('');
    const nextPreview = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
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
      const parsedPrice = Number(priceValue);
      return {
        name: siteName.trim(),
        hasFuelAvailable,
        fuelTypes: fuelTypes.length ? fuelTypes : undefined,
        pricesByFuel: Number.isFinite(parsedPrice) ? { [priceFuelType]: parsedPrice } : undefined,
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
    for (const gap of gaps) {
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
          const parsedPrice = normalizeNumber(priceValue);
          if (parsedPrice !== null) details.pricesByFuel = { [priceFuelType]: parsedPrice };
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

    if (!photoFile) {
      setPhotoError(t('Please capture a live photo before submitting.', 'Veuillez capturer une photo en direct avant de soumettre.'));
      return false;
    }

    if (!location && !parseManualLocation()) {
      setLocationError(t('GPS is required. Retry location or enter fallback coordinates.', 'Le GPS est requis. Reessayez la localisation ou saisissez des coordonnees de secours.'));
      return false;
    }

    if (!isEnrichMode) {
      if (vertical === 'pharmacy' && !siteName.trim()) {
        setErrorMessage(t('Pharmacy name is required.', 'Le nom de la pharmacie est requis.'));
        return false;
      }
      if (vertical === 'mobile_money' && providers.length === 0) {
        setErrorMessage(t('Select at least one provider.', 'Selectionnez au moins un operateur.'));
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
        setErrorMessage(t('Road condition is required.', 'L\'etat de la route est requis.'));
        return false;
      }
      if (vertical === 'census_proxy' && !buildingType) {
        setErrorMessage(t('Building type is required.', 'Le type de batiment est requis.'));
        return false;
      }
      if (vertical === 'census_proxy' && !occupancyStatus) {
        setErrorMessage(t('Occupancy status is required.', 'Le statut d\'occupation est requis.'));
        return false;
      }
    } else if (Object.keys(details).filter((field) => field !== 'clientDevice').length === 0) {
      setErrorMessage(t('Fill at least one gap field to enrich this point.', 'Renseignez au moins un champ manquant pour enrichir ce point.'));
      return false;
    }

    return true;
  };

  const submitPayload = async (payload: SubmissionInput): Promise<boolean> => {
    const queuedItem = await enqueueSubmission(payload);
    let summary: QueueSyncSummary | null = null;
    if (navigator.onLine) {
      summary = await syncQueuedItems();
    } else {
      const stats = await getQueueStats();
      setSyncMessage(t(`Saved offline. ${stats.total} item(s) pending sync.`, `Enregistre hors ligne. ${stats.total} element(s) en attente de synchronisation.`));
    }

    if (summary && summary.permanentFailureIds.includes(queuedItem.id)) {
      const reason = summary.permanentFailureMessages[0] ?? t('Submission rejected by server validation.', 'Soumission rejetee par la validation serveur.');
      setErrorMessage(reason);
      return false;
    }

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
    if (!photoFile) {
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
      const [imageBase64, clientExif] = await Promise.all([
        fileToBase64(photoFile),
        extractClientExif(photoFile, location ?? manual ?? null),
      ]);
      const payload: SubmissionInput = {
        eventType: isEnrichMode ? 'ENRICH_EVENT' : 'CREATE_EVENT',
        category: vertical,
        pointId: isEnrichMode && seedPoint ? seedPoint.id : undefined,
        location: location ?? manual ?? undefined,
        details,
        imageBase64,
        clientExif,
      };
      const blockedByDedup = await maybePromptDedup(payload);
      if (blockedByDedup) return;
      await submitPayload(payload);
    } catch (error) {
      const syncError = toSubmissionSyncError(error);
      setErrorMessage(syncError.message || t('Submission failed.', 'Echec de la soumission.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDedupUseExisting = async () => {
    if (!pendingPayload || !dedupCheck) return;
    const targetPointId = selectedDedupPointId || dedupCheck.bestCandidatePointId || dedupCheck.candidates[0]?.pointId;
    if (!targetPointId) {
      setErrorMessage(t('No target point selected for enrich mode.', 'Aucun point cible selectionne pour le mode enrichissement.'));
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
      setErrorMessage(syncError.message || t('Submission failed.', 'Echec de la soumission.'));
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
      setErrorMessage(syncError.message || t('Submission failed.', 'Echec de la soumission.'));
    } finally {
      setIsResolvingDedup(false);
    }
  };

  const renderVerticalSelector = () => {
    if (isEnrichMode) return null;
    const verticalEntries = Object.values(VERTICALS) as Array<(typeof VERTICALS)[keyof typeof VERTICALS]>;
    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Vertical', 'Verticale')}</h4>
        <div className="grid grid-cols-2 gap-2">
          {verticalEntries.map((v) => (
            <button
              key={v.id}
              onClick={() => setVertical(v.id as Vertical)}
              className={`h-11 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 ${vertical === v.id ? `border-current` : 'border-gray-100 text-gray-500'}`}
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
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin size={16} className="text-[#0f2b46]" />
          <span className="text-xs font-bold text-gray-900">{t('GPS Location', 'Localisation GPS')}</span>
        </div>
        <button onClick={retryLocation} className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
          {t('Retry', 'Reessayer')}
        </button>
      </div>
      <p className="text-[11px] text-gray-500">
        {location
          ? `GPS: ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
          : t('GPS unavailable. Retry, then use fallback if needed.', 'GPS indisponible. Reessayez, puis utilisez le secours si necessaire.')}
      </p>
      {!location && (
        <button
          onClick={() => setShowManualLocation((prev) => !prev)}
          className="text-[10px] font-bold uppercase tracking-widest text-[#c86b4a]"
        >
          {showManualLocation ? t('Hide Manual Fallback', 'Masquer secours manuel') : t('Use Manual Fallback', 'Utiliser secours manuel')}
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
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold uppercase tracking-widest text-red-600">
          {locationError}
        </div>
      )}
    </div>
  );

  const renderPhotoBlock = () => (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-gray-900">{t('Live Camera Proof', 'Preuve camera en direct')}</h4>
      <p className="text-xs text-gray-500">{t('Camera capture only. Gallery uploads are blocked.', 'Capture camera uniquement. Import galerie bloque.')}</p>
      <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden">
        {photoPreview ? (
          <img src={photoPreview} alt={t('Captured photo', 'Photo capturee')} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
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
          className="relative z-10 mt-6 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 shadow-sm backdrop-blur hover:bg-white"
        >
          {photoPreview ? t('Retake Photo', 'Reprendre photo') : t('Capture Photo', 'Capturer photo')}
        </label>
      </div>
      {photoError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold uppercase tracking-widest text-red-600">
          {photoError}
        </div>
      )}
    </div>
  );

  const renderCreateFields = () => {
    if (vertical === 'pharmacy') {
      return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Pharmacy', 'Creer une pharmacie')}</h4>
          <input
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
            placeholder={t('Pharmacy name', 'Nom de la pharmacie')}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Open now', 'Ouvert maintenant')}</span>
            <button
              onClick={() => setIsOpenNow((prev) => !prev)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${isOpenNow ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {isOpenNow ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }
    if (vertical === 'mobile_money') {
      return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Kiosk', 'Creer un kiosque')}</h4>
          <div className="flex flex-wrap gap-2">
            {providerOptions.map((provider) => (
              <button
                key={provider}
                onClick={() => setProviders((prev) => toggleListValue(prev, provider))}
                className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${providers.includes(provider) ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-500'}`}
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
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Fuel Station', 'Creer une station-service')}</h4>
          <input
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
            placeholder={t('Fuel station name', 'Nom de la station-service')}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Fuel available', 'Carburant disponible')}</span>
            <button
              onClick={() => setHasFuelAvailable((prev) => !prev)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${hasFuelAvailable ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {hasFuelAvailable ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }

    if (vertical === 'alcohol_outlet') {
      return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Alcohol Outlet', 'Creer un point de vente d\'alcool')}</h4>
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
            <span className="text-xs font-semibold text-gray-600">{t('Formal / licensed', 'Formel / licence')}</span>
            <button
              onClick={() => setIsFormal((prev) => !prev)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${isFormal ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {isFormal ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }

    if (vertical === 'billboard') {
      return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Billboard', 'Creer un panneau')}</h4>
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
            <span className="text-xs font-semibold text-gray-600">{t('Occupied', 'Occupe')}</span>
            <button
              onClick={() => setIsOccupied((prev) => !prev)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${isOccupied ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {isOccupied ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }

    if (vertical === 'transport_road') {
      return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-900">{t('Create Road Segment', 'Creer un segment routier')}</h4>
          <input
            value={roadName}
            onChange={(event) => setRoadName(event.target.value)}
            placeholder={t('Road name', 'Nom de route')}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
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
            <span className="text-xs font-semibold text-gray-600">{t('Blocked', 'Bloque')}</span>
            <button
              onClick={() => setRoadBlocked((prev) => !prev)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${roadBlocked ? 'bg-[#c86b4a] text-white' : 'bg-gray-100 text-gray-500'}`}
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
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-gray-900">{t('Create Building', 'Creer un batiment')}</h4>
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
            placeholder={t('Storeys', 'Etages')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
          <input
            type="number"
            value={estimatedUnits}
            onChange={(event) => setEstimatedUnits(event.target.value)}
            placeholder={t('Estimated units', 'Unites estimees')}
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{gap}</label>
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEnrichFieldValue(gap, true)}
              className={`h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest ${selected === true ? 'bg-[#4c7c59] text-white' : 'bg-gray-50 text-gray-500'}`}
            >
              {t('Yes', 'Oui')}
            </button>
            <button
              type="button"
              onClick={() => setEnrichFieldValue(gap, false)}
              className={`h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest ${selected === false ? 'bg-[#c86b4a] text-white' : 'bg-gray-50 text-gray-500'}`}
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
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
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
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={priceFuelType}
                onChange={(event) => {
                  markEnrichTouched(gap);
                  setPriceFuelType(event.target.value);
                }}
                className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
              >
                {fuelTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                type="number"
                value={priceValue}
                onChange={(event) => {
                  markEnrichTouched(gap);
                  setPriceValue(event.target.value);
                }}
                placeholder={t('Price (XAF)', 'Prix (XAF)')}
                className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
              />
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
          {gap === 'openingHours' && (
            <div className="flex flex-wrap gap-2">
              {openingHourPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEnrichFieldValue(gap, preset)}
                  className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${value === preset ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-500'}`}
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
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
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
          <select
            value={value}
            onChange={(event) => setEnrichFieldValue(gap, event.target.value)}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            <option value="">{t('Select...', 'Selectionner...')}</option>
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
          ? (fieldConfig.placeholderFr ?? t('Valeurs separees par virgules', 'Valeurs separees par virgules'))
          : (fieldConfig.placeholderEn ?? t('Comma-separated values', 'Valeurs separees par virgules'));
        return (
          <div className="space-y-2" key={gap}>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleEnrichMultiValue(gap, option.value)}
                className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${selectedValues.includes(option.value) ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {optionLabel(option, language)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderEnrichFields = () => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <h4 className="text-sm font-bold text-gray-900">{t('Enrich Missing Fields', 'Enrichir les champs manquants')}</h4>
      <div className="flex flex-wrap gap-2">
        {gaps.map((gap) => (
          <span key={gap} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-[#fff8f4] text-[#b85f3f] border border-[#f5d5c6]">
            {getEnrichFieldLabel(gap, language)}
          </span>
        ))}
      </div>
      <div className="space-y-4">
        {gaps.map((gap) => (
          <React.Fragment key={`enrich-${gap}`}>
            {renderEnrichFieldInput(gap)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const verticalIcon = <VerticalIcon name={VERTICALS[vertical]?.icon ?? 'pill'} size={18} />;

  if (submitted) {
    return (
      <div className="flex flex-col h-full bg-[#f9fafb]">
        <div className="pt-6 px-8">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-500">
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className="flex-1 px-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#eaf3ee] text-[#4c7c59] flex items-center justify-center">
            <CheckCircle size={30} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t('Saved Offline', 'Enregistre hors ligne')}</h2>
          <p className="text-sm text-gray-500">
            {t('Your submission is saved locally first and will sync automatically when online.', 'Votre soumission est d\'abord enregistree localement et sera synchronisee automatiquement en ligne.')}
          </p>
          {syncMessage && (
            <div className="w-full rounded-xl border border-[#d5e1eb] bg-white p-3 text-xs text-[#0f2b46]">
              {syncMessage}
            </div>
          )}
        </div>
        <div className="p-6">
          <button
            onClick={onComplete}
            className="w-full h-14 bg-[#c86b4a] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg hover:bg-[#b85f3f] active:scale-95 transition-all"
          >
            {t('Return to Map', 'Retour a la carte')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <div className="pt-6 px-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-500">
            <ArrowLeft size={24} />
          </button>
          <span className="text-xs font-bold text-gray-900 uppercase tracking-[0.2em]">
            {isEnrichMode ? t('Enrich Point', 'Enrichir point') : t('Create Point', 'Creer point')}
          </span>
          <span className="w-6"></span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[#4c7c59] mb-4">
          <ShieldCheck size={12} />
          <span>{t('Live photo + GPS mandatory', 'Photo live + GPS obligatoires')}</span>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-5">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#0f2b46]">
            {verticalIcon}
            <span className="text-sm font-bold">
              {getCategoryLabel(vertical, language)}
            </span>
          </div>
          {isEnrichMode && seedPoint && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate max-w-[140px]">
              {seedPoint.name}
            </span>
          )}
        </div>

        {renderVerticalSelector()}
        {renderPhotoBlock()}
        {renderCommonLocationBlock()}
        {isEnrichMode ? renderEnrichFields() : renderCreateFields()}

        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold uppercase tracking-widest text-red-600">
            {errorMessage}
          </div>
        )}

        {dedupCheck && (
          <div className="rounded-2xl border border-[#f5d5c6] bg-[#fff8f4] p-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#b85f3f]">
              {t('Potential Duplicate', 'Doublon potentiel')}
            </div>
            <div className="text-xs text-gray-700">
              {t('A nearby point looks similar. Choose whether to enrich it or create a new one.', 'Un point proche semble similaire. Choisissez entre l\'enrichir ou creer un nouveau point.')}
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
                      isSelected ? 'border-[#c86b4a] bg-white' : 'border-[#f5d5c6] bg-[#fffdfb]'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-900">
                      {candidate.siteName || candidate.pointId}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {candidate.distanceMeters}m · {t('similarity', 'similarite')}: {Math.round(candidate.similarityScore * 100)}%
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
                className={`h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                  isResolvingDedup ? 'bg-gray-100 text-gray-400' : 'bg-[#0f2b46] text-white'
                }`}
              >
                {t('Enrich Existing', 'Enrichir existant')}
              </button>
              <button
                type="button"
                onClick={handleDedupCreateNew}
                disabled={isResolvingDedup}
                className={`h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                  isResolvingDedup ? 'bg-gray-100 text-gray-400' : 'bg-[#c86b4a] text-white'
                }`}
              >
                {t('Create New', 'Creer nouveau')}
              </button>
            </div>
            <button
              type="button"
              onClick={clearDedupPrompt}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-500"
            >
              {t('Dismiss', 'Ignorer')}
            </button>
          </div>
        )}

        {syncMessage && (
          <div className="rounded-xl border border-[#d5e1eb] bg-white p-3 text-xs text-[#0f2b46]">
            {syncMessage}
          </div>
        )}
      </div>

      <div className="p-6 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isResolvingDedup || Boolean(dedupCheck)}
          className="w-full h-14 bg-[#0f2b46] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-[#0b2236] active:scale-95 transition-all disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{t('Saving', 'Enregistrement')}</span>
            </>
          ) : (
            <span>{isEnrichMode ? t('Save Enrichment', 'Enregistrer enrichissement') : t('Create Point', 'Creer point')}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default ContributionFlow;
