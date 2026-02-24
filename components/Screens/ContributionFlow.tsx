import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  MapPin,
  Pill,
  Landmark,
  Fuel,
  ShieldCheck
} from 'lucide-react';
import { enqueueSubmission, flushOfflineQueue, getQueueStats, type QueueSyncSummary } from '../../lib/client/offlineQueue';
import { detectLowEndDevice, getClientDeviceInfo } from '../../lib/client/deviceProfile';
import { sendSubmissionPayload, toSubmissionSyncError } from '../../lib/client/submissionSync';
import type { SubmissionCategory, SubmissionInput } from '../../shared/types';
import { Category, ContributionMode, DataPoint } from '../../types';

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
const openingHourPresets = ['08:00 - 20:00', '09:00 - 19:00', '24/7'];
const MAX_UPLOAD_DIMENSION = 1600;
const IMAGE_QUALITY_LOW_END = 0.72;
const IMAGE_QUALITY_DEFAULT = 0.82;

const pointTypeToVertical = (type: Category): Vertical => {
  if (type === Category.PHARMACY) return 'pharmacy';
  if (type === Category.FUEL) return 'fuel_station';
  return 'mobile_money';
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

  const [siteName, setSiteName] = useState(seedPoint?.name ?? '');
  const [openingHours, setOpeningHours] = useState(seedPoint?.openingHours ?? '');
  const [isOpenNow, setIsOpenNow] = useState(seedPoint?.isOpenNow ?? true);
  const [isOnDuty, setIsOnDuty] = useState(seedPoint?.isOnDuty ?? false);
  const [providers, setProviders] = useState<string[]>(seedPoint?.providers ?? []);
  const [hasMin50000XafAvailable, setHasMin50000XafAvailable] = useState(
    seedPoint?.hasMin50000XafAvailable ?? seedPoint?.hasCashAvailable ?? true
  );
  const [merchantId, setMerchantId] = useState(seedPoint?.merchantId ?? '');
  const [merchantProvider, setMerchantProvider] = useState(seedPoint?.providers?.[0] ?? providerOptions[0]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(seedPoint?.paymentMethods ?? []);
  const [hasFuelAvailable, setHasFuelAvailable] = useState(seedPoint?.hasFuelAvailable ?? true);
  const [fuelTypes, setFuelTypes] = useState<string[]>(seedPoint?.fuelTypes ?? (seedPoint?.fuelType ? [seedPoint.fuelType] : []));
  const [priceFuelType, setPriceFuelType] = useState(seedPoint?.fuelType ?? fuelTypeOptions[0]);
  const [priceValue, setPriceValue] = useState(seedPoint?.price ? String(seedPoint.price) : '');
  const [quality, setQuality] = useState(seedPoint?.quality ?? 'Standard');
  const [isLowEndDevice] = useState<boolean>(() => detectLowEndDevice());

  const gaps = useMemo(() => seedPoint?.gaps ?? [], [seedPoint]);
  const isEnrichMode = mode === 'ENRICH' && Boolean(seedPoint);
  const gapLabel = (gap: string) => {
    const labels: Record<string, { en: string; fr: string }> = {
      openingHours: { en: 'Opening Hours', fr: 'Heures d\'ouverture' },
      isOpenNow: { en: 'Open Now Status', fr: 'Statut ouvert maintenant' },
      isOnDuty: { en: 'On-call Pharmacy', fr: 'Pharmacie de garde' },
      merchantIdByProvider: { en: 'Merchant IDs', fr: 'ID marchands' },
      paymentMethods: { en: 'Payment Methods', fr: 'Moyens de paiement' },
      hasCashAvailable: { en: 'Min 50,000 XAF Available', fr: 'Minimum 50 000 XAF disponible' },
      hasMin50000XafAvailable: { en: 'Min 50,000 XAF Available', fr: 'Minimum 50 000 XAF disponible' },
      providers: { en: 'Providers', fr: 'Operateurs' },
      fuelTypes: { en: 'Fuel Types', fr: 'Types de carburant' },
      pricesByFuel: { en: 'Fuel Prices', fr: 'Prix carburant' },
      quality: { en: 'Quality', fr: 'Qualite' },
      hasFuelAvailable: { en: 'Fuel Availability', fr: 'Disponibilite carburant' }
    };
    const label = labels[gap];
    if (!label) return gap;
    return language === 'fr' ? label.fr : label.en;
  };

  useEffect(() => {
    if (seedPoint) {
      setVertical(pointTypeToVertical(seedPoint.type));
    }
  }, [seedPoint]);

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
      return compressed;
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
        openingHours: openingHours.trim() || undefined,
        clientDevice
      };
    }
    if (vertical === 'mobile_money') {
      return {
        providers,
        hasMin50000XafAvailable,
        openingHours: openingHours.trim() || undefined,
        paymentMethods: paymentMethods.length ? paymentMethods : undefined,
        merchantIdByProvider: merchantId.trim() ? { [merchantProvider]: merchantId.trim() } : undefined,
        clientDevice
      };
    }
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
  };

  const buildEnrichDetails = (): Record<string, unknown> => {
    const details: Record<string, unknown> = { clientDevice: getClientDeviceInfo() };
    for (const gap of gaps) {
      if (gap === 'openingHours' && openingHours.trim()) details.openingHours = openingHours.trim();
      if (gap === 'isOpenNow') details.isOpenNow = isOpenNow;
      if (gap === 'isOnDuty') details.isOnDuty = isOnDuty;
      if (gap === 'providers' && providers.length) details.providers = providers;
      if (gap === 'hasCashAvailable' || gap === 'hasMin50000XafAvailable') details.hasMin50000XafAvailable = hasMin50000XafAvailable;
      if (gap === 'merchantIdByProvider' && merchantId.trim()) details.merchantIdByProvider = { [merchantProvider]: merchantId.trim() };
      if (gap === 'paymentMethods' && paymentMethods.length) details.paymentMethods = paymentMethods;
      if (gap === 'fuelTypes' && fuelTypes.length) details.fuelTypes = fuelTypes;
      if (gap === 'pricesByFuel' && Number.isFinite(Number(priceValue))) details.pricesByFuel = { [priceFuelType]: Number(priceValue) };
      if (gap === 'quality' && quality) details.quality = quality;
      if (gap === 'hasFuelAvailable') details.hasFuelAvailable = hasFuelAvailable;
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
    } else if (Object.keys(details).filter((field) => field !== 'clientDevice').length === 0) {
      setErrorMessage(t('Fill at least one gap field to enrich this point.', 'Renseignez au moins un champ manquant pour enrichir ce point.'));
      return false;
    }

    return true;
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
      const imageBase64 = await fileToBase64(photoFile);
      const payload: SubmissionInput = {
        eventType: isEnrichMode ? 'ENRICH_EVENT' : 'CREATE_EVENT',
        category: vertical,
        pointId: isEnrichMode && seedPoint ? seedPoint.id : undefined,
        location: location ?? manual ?? undefined,
        details,
        imageBase64
      };

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
        return;
      }

      setSubmitted(true);
    } catch (error) {
      const syncError = toSubmissionSyncError(error);
      setErrorMessage(syncError.message || t('Submission failed.', 'Echec de la soumission.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderVerticalSelector = () => {
    if (isEnrichMode) return null;
    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Vertical', 'Verticale')}</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setVertical('pharmacy')}
            className={`h-11 rounded-xl border text-xs font-bold uppercase tracking-widest ${vertical === 'pharmacy' ? 'bg-[#eaf3ee] border-[#2f855a] text-[#2f855a]' : 'border-gray-100 text-gray-500'}`}
          >
            {t('Pharmacy', 'Pharmacie')}
          </button>
          <button
            onClick={() => setVertical('mobile_money')}
            className={`h-11 rounded-xl border text-xs font-bold uppercase tracking-widest ${vertical === 'mobile_money' ? 'bg-[#e7eef4] border-[#0f2b46] text-[#0f2b46]' : 'border-gray-100 text-gray-500'}`}
          >
            {t('Kiosk', 'Kiosque')}
          </button>
          <button
            onClick={() => setVertical('fuel_station')}
            className={`h-11 rounded-xl border text-xs font-bold uppercase tracking-widest ${vertical === 'fuel_station' ? 'bg-[#f7e8e1] border-[#c86b4a] text-[#c86b4a]' : 'border-gray-100 text-gray-500'}`}
          >
            {t('Fuel', 'Carburant')}
          </button>
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('Min 50,000 XAF available', 'Minimum 50 000 XAF disponible')}</span>
            <button
              onClick={() => setHasMin50000XafAvailable((prev) => !prev)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${hasMin50000XafAvailable ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {hasMin50000XafAvailable ? t('Yes', 'Oui') : t('No', 'Non')}
            </button>
          </div>
        </div>
      );
    }
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
  };

  const renderEnrichFields = () => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <h4 className="text-sm font-bold text-gray-900">{t('Enrich Missing Fields', 'Enrichir les champs manquants')}</h4>
      <div className="flex flex-wrap gap-2">
        {gaps.map((gap) => (
          <span key={gap} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-[#fff8f4] text-[#b85f3f] border border-[#f5d5c6]">
            {gapLabel(gap)}
          </span>
        ))}
      </div>

      {gaps.includes('openingHours') && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Opening hours', 'Heures d\'ouverture')}</label>
          <div className="flex flex-wrap gap-2">
            {openingHourPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setOpeningHours(preset)}
                className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${openingHours === preset ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            value={openingHours}
            onChange={(event) => setOpeningHours(event.target.value)}
            placeholder={t('Custom opening hours', 'Heures d\'ouverture personnalisees')}
            className="w-full h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      )}

      {gaps.includes('isOpenNow') && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">{t('Open now', 'Ouvert maintenant')}</span>
          <button
            onClick={() => setIsOpenNow((prev) => !prev)}
            className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${isOpenNow ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            {isOpenNow ? t('Yes', 'Oui') : t('No', 'Non')}
          </button>
        </div>
      )}

      {gaps.includes('isOnDuty') && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">{t('On-call pharmacy', 'Pharmacie de garde')}</span>
          <button
            onClick={() => setIsOnDuty((prev) => !prev)}
            className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${isOnDuty ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            {isOnDuty ? t('Yes', 'Oui') : t('No', 'Non')}
          </button>
        </div>
      )}

      {gaps.includes('providers') && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Providers', 'Operateurs')}</label>
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
      )}

      {(gaps.includes('hasCashAvailable') || gaps.includes('hasMin50000XafAvailable')) && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">{t('Min 50,000 XAF available', 'Minimum 50 000 XAF disponible')}</span>
          <button
            onClick={() => setHasMin50000XafAvailable((prev) => !prev)}
            className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${hasMin50000XafAvailable ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            {hasMin50000XafAvailable ? t('Yes', 'Oui') : t('No', 'Non')}
          </button>
        </div>
      )}

      {gaps.includes('merchantIdByProvider') && (
        <div className="grid grid-cols-2 gap-3">
          <select
            value={merchantProvider}
            onChange={(event) => setMerchantProvider(event.target.value)}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
          <input
            value={merchantId}
            onChange={(event) => setMerchantId(event.target.value)}
            placeholder={t('Merchant ID', 'ID marchand')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      )}

      {gaps.includes('paymentMethods') && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Payment methods', 'Moyens de paiement')}</label>
          <div className="flex flex-wrap gap-2">
            {paymentMethodOptions.map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethods((prev) => toggleListValue(prev, method))}
                className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${paymentMethods.includes(method) ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      )}

      {gaps.includes('fuelTypes') && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Fuel types', 'Types de carburant')}</label>
          <div className="flex flex-wrap gap-2">
            {fuelTypeOptions.map((type) => (
              <button
                key={type}
                onClick={() => setFuelTypes((prev) => toggleListValue(prev, type))}
                className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${fuelTypes.includes(type) ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-500'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {gaps.includes('pricesByFuel') && (
        <div className="grid grid-cols-2 gap-3">
          <select
            value={priceFuelType}
            onChange={(event) => setPriceFuelType(event.target.value)}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          >
            {fuelTypeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input
            type="number"
            value={priceValue}
            onChange={(event) => setPriceValue(event.target.value)}
            placeholder={t('Price (XAF)', 'Prix (XAF)')}
            className="h-11 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
          />
        </div>
      )}

      {gaps.includes('quality') && (
        <div className="flex gap-2">
          {['Premium', 'Standard', 'Low'].map((option) => (
            <button
              key={option}
              onClick={() => setQuality(option)}
              className={`flex-1 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest ${quality === option ? 'bg-[#4c7c59] text-white' : 'bg-gray-50 text-gray-500'}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {gaps.includes('hasFuelAvailable') && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">{t('Fuel available', 'Carburant disponible')}</span>
          <button
            onClick={() => setHasFuelAvailable((prev) => !prev)}
            className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${hasFuelAvailable ? 'bg-[#4c7c59] text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            {hasFuelAvailable ? t('Yes', 'Oui') : t('No', 'Non')}
          </button>
        </div>
      )}
    </div>
  );

  const verticalIcon = vertical === 'pharmacy' ? <Pill size={18} /> : vertical === 'mobile_money' ? <Landmark size={18} /> : <Fuel size={18} />;

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
              {vertical === 'pharmacy'
                ? t('Pharmacy', 'Pharmacie')
                : vertical === 'mobile_money'
                  ? t('Mobile Money Kiosk', 'Kiosque mobile money')
                  : t('Fuel Station', 'Station-service')}
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

        {syncMessage && (
          <div className="rounded-xl border border-[#d5e1eb] bg-white p-3 text-xs text-[#0f2b46]">
            {syncMessage}
          </div>
        )}
      </div>

      <div className="p-6 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
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
