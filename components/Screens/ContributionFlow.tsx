import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Camera,
  Check,
  ArrowRight,
  ShieldCheck,
  MapPin,
  BadgeCheck,
  Sparkles,
  Star
} from 'lucide-react';
import { apiFetch } from '../../lib/client/api';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  language: 'en' | 'fr';
}

const TIER_1_XP = 5;
const TIER_2_XP = 10;
const TIER_3_XP = 20;

const ContributionFlow: React.FC<Props> = ({ onBack, onComplete, language }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [type, setType] = useState<'Fuel' | 'Kiosk'>('Fuel');
  const [price, setPrice] = useState('840');
  const [fuelType, setFuelType] = useState<'Diesel' | 'Super' | 'Gaz'>('Super');
  const [quality, setQuality] = useState('Premium');
  const [availability, setAvailability] = useState('Available');
  const [provider, setProvider] = useState('MTN');
  const [queueLength, setQueueLength] = useState<'' | 'Short' | 'Moderate' | 'Long'>('');
  const [paymentModes, setPaymentModes] = useState<string[]>([]);
  const [siteName, setSiteName] = useState('');
  const [profession, setProfession] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [problem, setProblem] = useState('');
  const [hours, setHours] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [reliability, setReliability] = useState<'' | 'Excellent' | 'Good' | 'Congested'>('');
  const [comment, setComment] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [secondPhotoPreview, setSecondPhotoPreview] = useState<string | null>(null);
  const [secondPhotoFile, setSecondPhotoFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const typeOptions = [
    { value: 'Fuel' as const, label: t('Fuel', 'Carburant') },
    { value: 'Kiosk' as const, label: t('Kiosk', 'Kiosque') },
  ];
  const qualityOptions = [
    { value: 'Premium', label: t('Premium', 'Premium') },
    { value: 'Standard', label: t('Standard', 'Standard') },
    { value: 'Low', label: t('Low', 'Faible') },
  ];
  const availabilityOptions = [
    { value: 'Available', label: t('Available', 'Disponible') },
    { value: 'Limited', label: t('Limited', 'Limite') },
    { value: 'Out', label: t('Out', 'Rupture') },
  ];
  const queueLengthOptions = [
    { value: 'Short', label: t('Short', 'Courte') },
    { value: 'Moderate', label: t('Moderate', 'Moyenne') },
    { value: 'Long', label: t('Long', 'Longue') },
  ];
  const paymentModeOptions = [
    { value: 'Cash', label: t('Cash', 'Especes') },
    { value: 'Mobile Money', label: t('Mobile Money', 'Mobile Money') },
    { value: 'Cards', label: t('Cards', 'Cartes') },
  ];
  const reliabilityOptions = [
    { value: 'Excellent', label: t('Excellent', 'Excellent') },
    { value: 'Good', label: t('Good', 'Bon') },
    { value: 'Congested', label: t('Congested', 'Sature') },
  ];

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
      if (secondPhotoPreview) {
        URL.revokeObjectURL(secondPhotoPreview);
      }
    };
  }, [photoPreview, secondPhotoPreview]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoError('');
    const nextPreview = URL.createObjectURL(file);
    setPhotoPreview(prevPreview => {
      if (prevPreview) {
        URL.revokeObjectURL(prevPreview);
      }
      return nextPreview;
    });
  };

  const handleSecondPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextPreview = URL.createObjectURL(file);
    setSecondPhotoFile(file);
    setSecondPhotoPreview((prevPreview) => {
      if (prevPreview) {
        URL.revokeObjectURL(prevPreview);
      }
      return nextPreview;
    });
  };

  const totalSteps = 3;
  const tier2Completed = Boolean(
    profession.trim() ||
      phoneMasked.trim() ||
      queueLength ||
      paymentModes.length ||
      problem.trim() ||
      (type === 'Kiosk' && hours.trim())
  );
  const tier3Completed = Boolean(
    comment.trim() || (type === 'Kiosk' && (merchantId.trim() || reliability)) || secondPhotoFile
  );
  const earnedXp = TIER_1_XP + (tier2Completed ? TIER_2_XP : 0) + (tier3Completed ? TIER_3_XP : 0);

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

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Unable to read file.'));
        }
      };
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });

  const parseManualLocation = () => {
    const latRaw = manualLatitude.trim();
    const lngRaw = manualLongitude.trim();
    if (!latRaw && !lngRaw) return null;
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  };

  const retryLocation = async () => {
    setLocationError('');
    try {
      const current = await getCurrentLocation();
      setLocation(current);
      setLocationError('');
    } catch {
      setLocation(null);
      setLocationError('Unable to access location. Enable location or enter coordinates.');
    }
  };

  const mapSubmissionError = (rawMessage: string) => {
    const message = rawMessage.replace(/^Error:\s*/i, '').trim();
    const lower = message.toLowerCase();
    if (lower.includes('photo location does not match ip location')) {
      return t("We couldn't verify your location from your network. Try switching Wi-Fi/data and retake the photo on site.", "Impossible de verifier votre localisation depuis votre reseau. Changez de Wi-Fi/donnees et reprenez la photo sur place.");
    }
    if (lower.includes('device location does not match ip location')) {
      return t("We couldn't verify your device location from your network. Try switching Wi-Fi/data and retry.", "Impossible de verifier la localisation appareil depuis votre reseau. Changez de Wi-Fi/donnees et reessayez.");
    }
    if (lower.includes('photo gps coordinates do not match submission location')) {
      return t("Photo GPS doesn't match the submitted location. Retake the photo at the site or update the coordinates.", "Le GPS de la photo ne correspond pas a la localisation envoyee. Reprenez la photo sur place ou corrigez les coordonnees.");
    }
    if (lower.includes('photo is missing gps metadata')) {
      return t('Your photo has no GPS metadata. On iPhone, allow Location for Safari and Camera, then retake.', 'Votre photo n\'a pas de metadonnees GPS. Sur iPhone, autorisez la localisation pour Safari et Camera puis reprenez.');
    }
    if (lower.includes('unable to read photo gps metadata')) {
      return t("We couldn't read GPS from the photo. Please retake the photo.", "Impossible de lire le GPS de la photo. Reprenez la photo.");
    }
    if (lower.includes('photo is required')) {
      return t('Please capture a photo before submitting.', 'Veuillez capturer une photo avant de soumettre.');
    }
    if (lower.includes('invalid photo format')) {
      return t('Unsupported photo format. Use JPG, PNG, WEBP, or HEIC.', 'Format photo non supporte. Utilisez JPG, PNG, WEBP ou HEIC.');
    }
    if (lower.includes('photo exceeds maximum size')) {
      return t('Photo is too large. Retake with lower quality and try again.', 'Photo trop volumineuse. Reprenez avec une qualite plus faible puis reessayez.');
    }
    if (lower.includes('unable to store photo')) {
      return t("We couldn't save your photo right now. Please retry.", "Impossible d'enregistrer votre photo maintenant. Reessayez.");
    }
    if (lower.includes('blob storage is not configured')) {
      return t("Photo storage isn't configured on the server yet.", "Le stockage photo n'est pas encore configure sur le serveur.");
    }
    if (lower.includes('entity_too_large') || lower.includes('body exceeded 2mb limit')) {
      return t('Server storage is full. Please contact admin or try again later.', 'Le stockage serveur est plein. Contactez un admin ou reessayez plus tard.');
    }
    if (lower.includes('invalid fuel price')) {
      return t('Please enter a valid fuel price.', 'Veuillez saisir un prix carburant valide.');
    }
    if (lower.includes('missing or invalid location')) {
      return t("We couldn't determine your location. Enable location or enter coordinates.", "Impossible de determiner votre position. Activez la localisation ou saisissez les coordonnees.");
    }
    if (lower.includes('unauthorized')) {
      return t('Please sign in to contribute.', 'Connectez-vous pour contribuer.');
    }
    return message || t('Submission failed.', 'Echec de la soumission.');
  };

  const readErrorMessage = async (response: Response) => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        const raw = typeof data === 'string' ? data : data?.error ?? data?.message ?? JSON.stringify(data);
        return mapSubmissionError(String(raw));
      } catch {
        const raw = await response.text();
        return mapSubmissionError(raw);
      }
    }
    const raw = await response.text();
    return mapSubmissionError(raw);
  };

  const renderStep = () => {
    if (submitted) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-center">
          <div className="w-16 h-16 bg-[#eaf3ee] text-[#4c7c59] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <BadgeCheck size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Submission Complete', 'Soumission terminee')}</h2>
            <p className="text-sm text-gray-500">{t('Your report is safely stored offline and queued for sync.', 'Votre signalement est enregistre hors ligne et en file pour synchronisation.')}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('XP Earned', 'XP gagnes')}</span>
              <span className="text-sm font-bold text-[#4c7c59]">+{earnedXp} XP</span>
            </div>
            <div className="text-left space-y-1">
              <p className="text-[11px] text-gray-600">{t('Tier', 'Niveau')} 1: +{TIER_1_XP} XP</p>
              <p className="text-[11px] text-gray-600">{t('Tier', 'Niveau')} 2: +{tier2Completed ? TIER_2_XP : 0} XP</p>
              <p className="text-[11px] text-gray-600">{t('Tier', 'Niveau')} 3: +{tier3Completed ? TIER_3_XP : 0} XP</p>
            </div>
          </div>
          <div className="bg-[#f2f4f7] border border-gray-100 rounded-2xl p-4 text-left text-xs text-gray-500">
            {t('Fraud checks: camera metadata + device GPS + contributor reputation.', 'Controles anti-fraude : metadonnees camera + GPS appareil + reputation contributeur.')}
          </div>
        </div>
      );
    }

    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-[#e7eef4] text-[#0f2b46] text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center">
                <ShieldCheck size={12} className="mr-1" /> {t('Tier', 'Niveau')} 1 • {t('Mandatory', 'Obligatoire')} • +5 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Live Camera Capture', 'Capture camera en direct')}</h2>
              <p className="text-sm text-gray-500">{t('Open the camera to capture the station/kiosk. Live capture only.', 'Ouvrez la camera pour capturer station/kiosque. Capture directe uniquement.')}</p>
            </div>

            <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt={t('Captured station or kiosk', 'Station ou kiosque capture')} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <Camera size={48} className="mb-4 opacity-40" />
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">{t('Live Camera Preview', 'Apercu camera en direct')}</p>
                  <span className="mt-2 text-[10px] text-gray-400">{t('EXIF metadata + GPS tagged', 'Metadonnees EXIF + GPS')}</span>
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
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                {photoError}
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Select Type', 'Choisir type')}</h4>
              <div className="grid grid-cols-2 gap-4">
                {typeOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setType(value)}
                    className={`h-14 rounded-xl flex items-center justify-center space-x-2 border-2 transition-all ${
                      type === value ? 'bg-[#e7eef4] border-[#0f2b46] text-[#0f2b46]' : 'bg-white border-gray-100 text-gray-400'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${type === value ? 'bg-[#0f2b46] text-white' : 'border-2 border-gray-200'}`}>
                      {type === value && <Check size={12} />}
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {type === 'Fuel' ? t('Fuel Station Name', 'Nom station-service') : t('Kiosk Name', 'Nom du kiosque')}
                </label>
                <input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder={type === 'Fuel' ? t('e.g. Total Bonamoussadi', 'ex. Total Bonamoussadi') : t('e.g. MTN Express Kiosk', 'ex. Kiosque MTN Express')}
                  className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                />
              </div>
            </div>

            {type === 'Fuel' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Fuel Type', 'Type de carburant')}</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['Diesel', 'Super', 'Gaz'].map(item => (
                      <button
                        key={item}
                        onClick={() => setFuelType(item as 'Diesel' | 'Super' | 'Gaz')}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                          fuelType === item ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Fuel Price (XAF)', 'Prix carburant (XAF)')}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full h-20 bg-white border-2 border-gray-100 rounded-2xl px-6 text-3xl font-bold text-gray-900 focus:border-[#0f2b46] focus:outline-none transition-colors"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300 uppercase">XAF</span>
                </div>
                <div className="flex items-center space-x-2">
                  {qualityOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setQuality(value)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                        quality === value ? 'bg-[#4c7c59] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Kiosk Availability', 'Disponibilite kiosque')}</label>
                <div className="flex p-1 bg-gray-50 rounded-xl">
                  {availabilityOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setAvailability(value)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                        availability === value ? 'bg-white shadow text-[#0f2b46]' : 'text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Provider', 'Operateur')}</label>
                <div className="flex items-center space-x-2">
                  {['MTN', 'Orange', 'Airtel'].map(item => (
                    <button
                      key={item}
                      onClick={() => setProvider(item)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                        provider === item ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-[#f2f4f7] p-4 rounded-2xl border border-gray-100">
              <div className="flex items-center space-x-3">
                <MapPin size={18} className="text-[#0f2b46]" />
                <div>
                  <p className="text-xs font-bold text-gray-900">{t('Device Location', 'Position appareil')}</p>
                  <p className="text-[10px] text-gray-400">
                    {location
                      ? `GPS: ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
                      : t('GPS: unavailable', 'GPS: indisponible')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-[#4c7c59] uppercase">{location ? t('Matched', 'Valide') : t('Pending', 'En attente')}</span>
                <button
                  type="button"
                  onClick={retryLocation}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]"
                >
                  {t('Retry', 'Reessayer')}
                </button>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Manual Coordinates', 'Coordonnees manuelles')}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{t('Optional', 'Optionnel')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={manualLatitude}
                  onChange={(e) => {
                    setManualLatitude(e.target.value);
                    setLocationError('');
                  }}
                  placeholder={t('Latitude', 'Latitude')}
                  className="h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                />
                <input
                  value={manualLongitude}
                  onChange={(e) => {
                    setManualLongitude(e.target.value);
                    setLocationError('');
                  }}
                  placeholder={t('Longitude', 'Longitude')}
                  className="h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                />
              </div>
              {locationError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                  {locationError}
                </div>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-[#eaf3ee] text-[#4c7c59] text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center">
                <Sparkles size={12} className="mr-1" /> {t('Tier', 'Niveau')} 2 • {t('Optional', 'Optionnel')} • +10 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Context & Operations', 'Contexte et operations')}</h2>
              <p className="text-sm text-gray-500">{t('Add context to improve data quality and monetization.', 'Ajoutez du contexte pour ameliorer la qualite des donnees et la monetisation.')}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {t('All fields optional • Bonus XP', 'Tous les champs sont optionnels • XP bonus')}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Profession', 'Profession')}</label>
                  <input
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder={t('e.g. Transit Operator', 'ex. Operateur transport')}
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Phone (masked)', 'Telephone (masque)')}</label>
                  <input
                    value={phoneMasked}
                    onChange={(e) => setPhoneMasked(e.target.value)}
                    placeholder={t('e.g. +237 ••• •• 489', 'ex. +237 ••• •• 489')}
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Queue Length', 'Longueur de file')}</label>
                <div className="flex p-1 bg-gray-50 rounded-xl mt-2">
                  {queueLengthOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setQueueLength((prev) => (prev === value ? '' : value))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        queueLength === value ? 'bg-white shadow text-[#0f2b46]' : 'text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Payment Modes', 'Moyens de paiement')}</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {paymentModeOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() =>
                        setPaymentModes((prev) =>
                          prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
                        )
                      }
                      className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        paymentModes.includes(value) ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Problems Noticed', 'Problemes constates')}</label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder={t('e.g. no cash, slow approvals', 'ex. pas de cash, validation lente')}
                    className="mt-2 w-full h-20 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs resize-none"
                  />
              </div>
              {type === 'Kiosk' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Opening Hours', 'Heures d\'ouverture')}</label>
                  <input
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder={t('e.g. 08:00 - 20:00', 'ex. 08:00 - 20:00')}
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-[#f7e8e1] text-[#c86b4a] text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center">
                <Star size={12} className="mr-1" /> {t('Tier', 'Niveau')} 3 • {t('Optional', 'Optionnel')} • +20 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('Advanced Verification', 'Verification avancee')}</h2>
              <p className="text-sm text-gray-500">{t('Add deeper metadata for validation and fraud resistance.', 'Ajoutez des metadonnees plus profondes pour la validation et la resistance a la fraude.')}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {t('All fields optional • Bonus XP', 'Tous les champs sont optionnels • XP bonus')}
              </p>
            </div>

            {type === 'Kiosk' && (
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Merchant ID', 'ID marchand')}</label>
                  <input
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder={t('e.g. M-129384', 'ex. M-129384')}
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Reliability Rating', 'Niveau de fiabilite')}</label>
                  <div className="flex items-center space-x-2 mt-2">
                    {reliabilityOptions.map(({ value, label }) => (
                      <button
                        key={value}
                      onClick={() => setReliability((prev) => (prev === value ? '' : value))}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                        reliability === value ? 'bg-[#4c7c59] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden">
              {secondPhotoPreview ? (
                <img src={secondPhotoPreview} alt={t('Optional second capture', 'Deuxieme capture optionnelle')} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <Camera size={40} className="mb-3 opacity-40" />
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">{t('Optional Second Photo', 'Deuxieme photo optionnelle')}</p>
                </>
              )}
              <input
                id="capture-second-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleSecondPhotoChange}
                className="sr-only"
              />
              <label
                htmlFor="capture-second-photo"
                className="relative z-10 mt-4 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 shadow-sm backdrop-blur hover:bg-white"
              >
                {secondPhotoPreview ? t('Retake 2nd Photo', 'Reprendre 2e photo') : t('Capture 2nd Photo', 'Capturer 2e photo')}
              </label>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Freeform Comment', 'Commentaire libre')}</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('Share any extra context for validators...', 'Partagez tout contexte supplementaire pour les validateurs...')}
                className="mt-2 w-full h-28 bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs resize-none"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BadgeCheck size={18} className="text-[#4c7c59]" />
                <div>
                  <p className="text-xs font-bold text-gray-900">{t('XP Summary', 'Resume XP')}</p>
                  <p className="text-[10px] text-gray-400">{t('Tier', 'Niveau')} 1 + {t('Tier', 'Niveau')} 2 + {t('Tier', 'Niveau')} 3</p>
                </div>
              </div>
              <span className="text-sm font-bold text-[#4c7c59]">+{earnedXp} XP</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleNext = async () => {
    setPhotoError('');
    setLocationError('');
    if (step === 1 && !photoFile) {
      setPhotoError(t('Please capture a Tier 1 photo before continuing.', 'Veuillez capturer une photo niveau 1 avant de continuer.'));
      return;
    }

    if (step < totalSteps) {
      setErrorMessage('');
      setStep((prev) => prev + 1);
      return;
    }

    const submit = async () => {
      setIsSubmitting(true);
      setErrorMessage('');
      try {
        if (!photoFile) {
          setStep(1);
          setPhotoError(t('Please capture a Tier 1 photo before submitting.', 'Veuillez capturer une photo niveau 1 avant de soumettre.'));
          return;
        }

        const manual = parseManualLocation();
        if ((manualLatitude.trim() || manualLongitude.trim()) && !manual) {
          setStep(1);
          setLocationError(t('Enter a valid latitude and longitude.', 'Entrez une latitude et une longitude valides.'));
          return;
        }
        const currentLocation = location ?? manual ?? null;
        const imageBase64 = await fileToBase64(photoFile);
        const secondImageBase64 = secondPhotoFile ? await fileToBase64(secondPhotoFile) : undefined;
        const parsedFuelPrice = Number(price);
        const normalizedFuelPrice = Number.isFinite(parsedFuelPrice) ? parsedFuelPrice : undefined;

        if (type === 'Fuel' && normalizedFuelPrice === undefined) {
          setStep(1);
          throw new Error(t('Invalid fuel price', 'Prix carburant invalide'));
        }

        const details: Record<string, unknown> = {
          price: type === 'Fuel' ? normalizedFuelPrice : undefined,
          fuelPrice: type === 'Fuel' ? normalizedFuelPrice : undefined,
          fuelType: type === 'Fuel' ? fuelType : undefined,
          quality: type === 'Fuel' ? quality : undefined,
          availability: type === 'Kiosk' ? availability : undefined,
          provider: type === 'Kiosk' ? provider : undefined,
        };

        if (siteName.trim()) details.siteName = siteName.trim();
        if (queueLength) details.queueLength = queueLength;
        if (paymentModes.length) details.paymentModes = paymentModes;
        if (profession.trim()) details.profession = profession.trim();
        if (phoneMasked.trim()) details.phoneMasked = phoneMasked.trim();
        if (problem.trim()) details.problem = problem.trim();
        if (type === 'Kiosk' && hours.trim()) details.hours = hours.trim();
        if (type === 'Kiosk' && merchantId.trim()) details.merchantId = merchantId.trim();
        if (type === 'Kiosk' && reliability) details.reliability = reliability;
        if (comment.trim()) details.comment = comment.trim();
        details.tier2Completed = tier2Completed;
        details.tier3Completed = tier3Completed;
        details.xpAwarded = earnedXp;

        const payload = {
          category: type === 'Fuel' ? 'fuel_station' : 'mobile_money',
          location: currentLocation ?? undefined,
          details,
          imageBase64,
          secondImageBase64,
        };

        const response = await apiFetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await readErrorMessage(response);
          throw new Error(message);
        }

        setSubmitted(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : t('Submission failed.', 'Echec de la soumission.');
        setErrorMessage(message.replace(/^Error:\s*/, ''));
      } finally {
        setIsSubmitting(false);
      }
    };

    submit();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      return;
    }
    onBack();
  };

  const handleSkip = () => {
    if (step < totalSteps) {
      setStep((prev) => prev + 1);
      return;
    }
    handleNext();
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <div className="pt-6 px-8">
        <div className="flex items-center justify-between mb-2">
          <button onClick={handleBack} className="p-1 -ml-1 text-gray-500">
            <ChevronLeft size={24} />
          </button>
          <span className="text-xs font-bold text-gray-900 uppercase tracking-[0.2em]">{t('Tier', 'Niveau')} {step} {t('Contribution', 'Contribution')}</span>
          <span className="text-[10px] font-bold text-gray-400">{t('Step', 'Etape')} {step} / {totalSteps}</span>
        </div>
        <div className="h-1 flex space-x-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-[#0f2b46]' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
        {renderStep()}
      </div>

      <div className="p-6 pt-2 space-y-3">
        {submitted ? (
          <button
            onClick={onComplete}
            className="w-full h-14 bg-[#c86b4a] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg hover:bg-[#b85f3f] active:scale-95 transition-all"
          >
            {t('Return to Map', 'Retour a la carte')}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                type="button"
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-gray-50"
              >
                {step === 1 ? t('Back to Map', 'Retour carte') : t('Back', 'Retour')}
              </button>
              {step > 1 && (
                <button
                  onClick={handleSkip}
                  type="button"
                  className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-gray-50"
                >
                  {step === totalSteps ? t('Skip Tier 3', 'Passer niveau 3') : t('Skip Tier 2', 'Passer niveau 2')}
                </button>
              )}
            </div>
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="w-full h-14 bg-[#0f2b46] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-[#0b2236] active:scale-95 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('Submitting', 'Soumission...')}</span>
                </>
              ) : (
                <>
                  <span>{step === totalSteps ? t('Submit Data', 'Soumettre') : t('Save & Continue', 'Enregistrer et continuer')}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            {errorMessage && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                {errorMessage}
              </div>
            )}
            {step === totalSteps && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('XP Preview', 'Apercu XP')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{t('You will earn', 'Vous gagnerez')} +{earnedXp} XP</p>
                <p className="text-[10px] text-gray-500 mt-2">
                  {t('Tier', 'Niveau')} 1 ({TIER_1_XP}) + {t('Tier', 'Niveau')} 2 ({tier2Completed ? TIER_2_XP : 0}) + {t('Tier', 'Niveau')} 3 ({tier3Completed ? TIER_3_XP : 0})
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContributionFlow;
