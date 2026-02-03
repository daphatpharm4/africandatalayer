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
}

const ContributionFlow: React.FC<Props> = ({ onBack, onComplete }) => {
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
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

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

  const totalSteps = 3;

  const getCurrentLocation = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error('Unable to access location.')),
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
      return "We couldn't verify your location from your network. Try switching Wi-Fi/data and retake the photo on site.";
    }
    if (lower.includes('device location does not match ip location')) {
      return "We couldn't verify your device location from your network. Try switching Wi-Fi/data and retry.";
    }
    if (lower.includes('photo gps coordinates do not match submission location')) {
      return "Photo GPS doesn't match the submitted location. Retake the photo at the site or update the coordinates.";
    }
    if (lower.includes('photo is missing gps metadata')) {
      return 'Your photo has no GPS metadata. On iPhone, allow Location for Safari and Camera, then retake.';
    }
    if (lower.includes('unable to read photo gps metadata')) {
      return "We couldn't read GPS from the photo. Please retake the photo.";
    }
    if (lower.includes('photo is required')) {
      return 'Please capture a photo before submitting.';
    }
    if (lower.includes('invalid fuel price')) {
      return 'Please enter a valid fuel price.';
    }
    if (lower.includes('missing or invalid location')) {
      return "We couldn't determine your location. Enable location or enter coordinates.";
    }
    if (lower.includes('unauthorized')) {
      return 'Please sign in to contribute.';
    }
    return message || 'Submission failed.';
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
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Submission Complete</h2>
            <p className="text-sm text-gray-500">Your report is safely stored offline and queued for sync.</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">XP Earned</span>
              <span className="text-sm font-bold text-[#4c7c59]">+25 XP</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Total XP: 3,460</p>
              <p className="text-[10px] text-gray-400">Next badge: Urban Validator</p>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#4c7c59] rounded-full" style={{ width: '68%' }}></div>
              </div>
            </div>
          </div>
          <div className="bg-[#f2f4f7] border border-gray-100 rounded-2xl p-4 text-left text-xs text-gray-500">
            Fraud checks: camera metadata + device GPS + contributor reputation.
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
                <ShieldCheck size={12} className="mr-1" /> Tier 1 • Mandatory • +5 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Live Camera Capture</h2>
              <p className="text-sm text-gray-500">Open the camera to capture the station/kiosk. Live capture only.</p>
            </div>

            <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Captured station or kiosk" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <Camera size={48} className="mb-4 opacity-40" />
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Live Camera Preview</p>
                  <span className="mt-2 text-[10px] text-gray-400">EXIF metadata + GPS tagged</span>
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
                {photoPreview ? 'Retake Photo' : 'Capture Photo'}
              </label>
            </div>
            {photoError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                {photoError}
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Type</h4>
              <div className="grid grid-cols-2 gap-4">
                {['Fuel', 'Kiosk'].map(item => (
                  <button
                    key={item}
                    onClick={() => setType(item as 'Fuel' | 'Kiosk')}
                    className={`h-14 rounded-xl flex items-center justify-center space-x-2 border-2 transition-all ${
                      type === item ? 'bg-[#e7eef4] border-[#0f2b46] text-[#0f2b46]' : 'bg-white border-gray-100 text-gray-400'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${type === item ? 'bg-[#0f2b46] text-white' : 'border-2 border-gray-200'}`}>
                      {type === item && <Check size={12} />}
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wide">{item}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {type === 'Fuel' ? 'Fuel Station Name' : 'Kiosk Name'}
                </label>
                <input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder={type === 'Fuel' ? 'e.g. Total Bonamoussadi' : 'e.g. MTN Express Kiosk'}
                  className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                />
              </div>
            </div>

            {type === 'Fuel' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Fuel Type</label>
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
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Fuel Price (XAF)</label>
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
                  {['Premium', 'Standard', 'Low'].map(item => (
                    <button
                      key={item}
                      onClick={() => setQuality(item)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                        quality === item ? 'bg-[#4c7c59] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Kiosk Availability</label>
                <div className="flex p-1 bg-gray-50 rounded-xl">
                  {['Available', 'Limited', 'Out'].map(item => (
                    <button
                      key={item}
                      onClick={() => setAvailability(item)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                        availability === item ? 'bg-white shadow text-[#0f2b46]' : 'text-gray-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Provider</label>
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
                  <p className="text-xs font-bold text-gray-900">Device Location</p>
                  <p className="text-[10px] text-gray-400">
                    {location
                      ? `GPS: ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`
                      : 'GPS: unavailable'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-[#4c7c59] uppercase">{location ? 'Matched' : 'Pending'}</span>
                <button
                  type="button"
                  onClick={retryLocation}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]"
                >
                  Retry
                </button>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Manual Coordinates</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={manualLatitude}
                  onChange={(e) => {
                    setManualLatitude(e.target.value);
                    setLocationError('');
                  }}
                  placeholder="Latitude"
                  className="h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                />
                <input
                  value={manualLongitude}
                  onChange={(e) => {
                    setManualLongitude(e.target.value);
                    setLocationError('');
                  }}
                  placeholder="Longitude"
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
                <Sparkles size={12} className="mr-1" /> Tier 2 • Optional • +10 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Context & Operations</h2>
              <p className="text-sm text-gray-500">Add context to improve data quality and monetization.</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                All fields optional • Bonus XP
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profession</label>
                  <input
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Transit Operator"
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone (masked)</label>
                  <input
                    value={phoneMasked}
                    onChange={(e) => setPhoneMasked(e.target.value)}
                    placeholder="e.g. +237 ••• •• 489"
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Queue Length</label>
                <div className="flex p-1 bg-gray-50 rounded-xl mt-2">
                  {['Short', 'Moderate', 'Long'].map(item => (
                    <button
                      key={item}
                      onClick={() => setQueueLength((prev) => (prev === item ? '' : item))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        queueLength === item ? 'bg-white shadow text-[#0f2b46]' : 'text-gray-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment Modes</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Cash', 'Mobile Money', 'Cards'].map(item => (
                    <button
                      key={item}
                      onClick={() =>
                        setPaymentModes((prev) =>
                          prev.includes(item) ? prev.filter(p => p !== item) : [...prev, item]
                        )
                      }
                      className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        paymentModes.includes(item) ? 'bg-[#0f2b46] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problems Noticed</label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="e.g. no cash, slow approvals"
                    className="mt-2 w-full h-20 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs resize-none"
                  />
              </div>
              {type === 'Kiosk' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Opening Hours</label>
                  <input
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="e.g. 08:00 - 20:00"
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
                <Star size={12} className="mr-1" /> Tier 3 • Optional • +10 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Advanced Verification</h2>
              <p className="text-sm text-gray-500">Add deeper metadata for validation and fraud resistance.</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                All fields optional • Bonus XP
              </p>
            </div>

            {type === 'Kiosk' && (
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Merchant ID</label>
                  <input
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    placeholder="e.g. M-129384"
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reliability Rating</label>
                  <div className="flex items-center space-x-2 mt-2">
                    {['Excellent', 'Good', 'Congested'].map(item => (
                      <button
                        key={item}
                      onClick={() => setReliability((prev) => (prev === item ? '' : item))}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                        reliability === item ? 'bg-[#4c7c59] text-white' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <Camera size={40} className="mb-3 opacity-40" />
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Optional Second Photo</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Freeform Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share any extra context for validators..."
                className="mt-2 w-full h-28 bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs resize-none"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BadgeCheck size={18} className="text-[#4c7c59]" />
                <div>
                  <p className="text-xs font-bold text-gray-900">XP Summary</p>
                  <p className="text-[10px] text-gray-400">Tier 1 + Tier 2 + Tier 3</p>
                </div>
              </div>
              <span className="text-sm font-bold text-[#4c7c59]">+25 XP</span>
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
      setPhotoError('Please capture a Tier 1 photo before continuing.');
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
          setPhotoError('Please capture a Tier 1 photo before submitting.');
          return;
        }

        const manual = parseManualLocation();
        if ((manualLatitude.trim() || manualLongitude.trim()) && !manual) {
          setStep(1);
          setLocationError('Enter a valid latitude and longitude.');
          return;
        }
        const currentLocation = location ?? manual ?? null;
        const imageBase64 = await fileToBase64(photoFile);
        const parsedFuelPrice = Number(price);
        const normalizedFuelPrice = Number.isFinite(parsedFuelPrice) ? parsedFuelPrice : undefined;

        if (type === 'Fuel' && normalizedFuelPrice === undefined) {
          setStep(1);
          throw new Error('Invalid fuel price');
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

        const payload = {
          category: type === 'Fuel' ? 'fuel_station' : 'mobile_money',
          location: currentLocation ?? undefined,
          details,
          imageBase64,
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
        const message = error instanceof Error ? error.message : 'Submission failed.';
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
          <span className="text-xs font-bold text-gray-900 uppercase tracking-[0.2em]">Tier {step} Contribution</span>
          <span className="text-[10px] font-bold text-gray-400">Step {step} of {totalSteps}</span>
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
            Return to Map
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                type="button"
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-gray-50"
              >
                {step === 1 ? 'Back to Map' : 'Back'}
              </button>
              {step > 1 && (
                <button
                  onClick={handleSkip}
                  type="button"
                  className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-gray-50"
                >
                  {step === totalSteps ? 'Skip Tier 3' : 'Skip Tier 2'}
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
                  <span>Submitting</span>
                </>
              ) : (
                <>
                  <span>{step === totalSteps ? 'Submit Data' : 'Save & Continue'}</span>
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">XP Preview</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">Total XP: 3,460</p>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#4c7c59] rounded-full" style={{ width: '68%' }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Next badge: Urban Validator</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContributionFlow;
