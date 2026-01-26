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
  const [quality, setQuality] = useState('Premium');
  const [availability, setAvailability] = useState('Available');
  const [provider, setProvider] = useState('MTN');
  const [queueLength, setQueueLength] = useState('Moderate');
  const [paymentModes, setPaymentModes] = useState(['Cash', 'Mobile Money']);
  const [profession, setProfession] = useState('Transit Operator');
  const [phoneMasked, setPhoneMasked] = useState('+237 ••• •• 489');
  const [problem, setProblem] = useState('');
  const [hours, setHours] = useState('08:00 - 20:00');
  const [merchantId, setMerchantId] = useState('M-129384');
  const [reliability, setReliability] = useState('Excellent');
  const [comment, setComment] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextPreview = URL.createObjectURL(file);
    setPhotoPreview(prevPreview => {
      if (prevPreview) {
        URL.revokeObjectURL(prevPreview);
      }
      return nextPreview;
    });
  };

  const totalSteps = 3;

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
            </div>

            {type === 'Fuel' ? (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Fuel Price</label>
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
                  <p className="text-[10px] text-gray-400">GPS: Akwa, Douala • 4.0510°N</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#4c7c59] uppercase">Matched</span>
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
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profession</label>
                  <input
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone (masked)</label>
                  <input
                    value={phoneMasked}
                    onChange={(e) => setPhoneMasked(e.target.value)}
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
                      onClick={() => setQueueLength(item)}
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
                <Star size={12} className="mr-1" /> Tier 3 • Advanced • +10 XP
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Advanced Verification</h2>
              <p className="text-sm text-gray-500">Add deeper metadata for validation and fraud resistance.</p>
            </div>

            {type === 'Kiosk' && (
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Merchant ID</label>
                  <input
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    className="mt-2 w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-3 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reliability Rating</label>
                  <div className="flex items-center space-x-2 mt-2">
                    {['Excellent', 'Good', 'Congested'].map(item => (
                      <button
                        key={item}
                        onClick={() => setReliability(item)}
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

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <div className="pt-6 px-8">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-500"><ChevronLeft size={24} /></button>
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
            <button
              onClick={handleNext}
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
