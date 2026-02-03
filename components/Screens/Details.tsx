import React, { useState } from 'react';
import { Category, DataPoint } from '../../types';
import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock,
  CreditCard,
  ShieldCheck,
  Info,
  Navigation2,
  Zap,
  Volume2,
  Activity,
  User,
  BadgeCheck
} from 'lucide-react';

interface Props {
  point: DataPoint | null;
  onBack: () => void;
  onContribute: () => void;
  isAuthenticated: boolean;
  onAuth: () => void;
}

const Details: React.FC<Props> = ({ point, onBack, onContribute, isAuthenticated, onAuth }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!point) return null;

  const handleSpeech = () => {
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 1200);
  };

  const getReliabilityColor = (reliability?: string) => {
    if (!reliability) return 'text-gray-400 bg-gray-50';
    const r = reliability.toLowerCase();
    if (r === 'excellent' || r === 'good') return 'text-[#4c7c59] bg-[#eaf3ee]';
    if (r === 'poor' || r === 'congested') return 'text-[#b85f3f] bg-[#f7e8e1]';
    return 'text-[#0f2b46] bg-[#e7eef4]';
  };

  const hasUserPhoto = Boolean(point.photoUrl);
  const heroImage = point.photoUrl || `https://picsum.photos/seed/${point.id}/800/400?grayscale&blur=2`;
  const fuelSubtitle = [point.currency ? `${point.currency}/L` : null, point.fuelType ? `Type: ${point.fuelType}` : null, point.quality ?? null]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold truncate max-w-[200px]">{point.name}</h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleSpeech}
            disabled={isSpeaking}
            className={`p-2 text-[#0f2b46] hover:bg-[#f2f4f7] rounded-xl transition-colors ${isSpeaking ? 'animate-pulse' : ''}`}
          >
            <Volume2 size={18} />
          </button>
          <button className="p-2 -mr-2 text-gray-400">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex justify-center">
          <span className="text-[10px] font-bold bg-[#e7eef4] text-[#0f2b46] px-3 py-1 rounded-full uppercase tracking-wider">
            Last Updated {point.lastUpdated}
          </span>
        </div>

        <div className="h-44 rounded-2xl bg-gray-200 overflow-hidden relative shadow-sm border border-gray-100">
          <img src={heroImage} className={`w-full h-full object-cover ${hasUserPhoto ? '' : 'opacity-50'}`} alt={hasUserPhoto ? 'User submitted station photo' : 'Fallback location image'} />
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur rounded-xl text-[8px] font-bold text-white uppercase tracking-widest">
            {hasUserPhoto ? 'User Photo' : 'Demo Image'}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-2 bg-[#0f2b46] rounded-full border-2 border-white shadow-xl">
              {point.type === Category.FUEL ? <Zap size={20} className="text-white" /> : <ShieldCheck size={20} className="text-white" />}
            </div>
          </div>
          <button className="absolute bottom-3 right-3 p-2 bg-white rounded-xl shadow-md border border-gray-100 text-[#0f2b46]">
            <Navigation2 size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center">
              {point.type === Category.FUEL ? <Zap size={10} className="mr-1" /> : <CreditCard size={10} className="mr-1" />}
              {point.type === Category.FUEL ? 'Fuel Price' : 'Availability'}
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 tracking-tight">
                {point.type === Category.FUEL ? (typeof point.price === 'number' ? `${point.price}` : '--') : point.availability}
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                {point.type === Category.FUEL ? fuelSubtitle || 'Price details unavailable' : 'Real-time status'}
              </span>
            </div>
            <div className="mt-2 flex items-center">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${point.type === Category.FUEL ? 'text-[#4c7c59] bg-[#eaf3ee]' : 'text-[#0f2b46] bg-[#e7eef4]'}`}>
                {point.type === Category.FUEL ? (point.fuelType || 'Fuel') : 'Verified'}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center">
              <ShieldCheck size={10} className="mr-1" />
              Trust Score
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 tracking-tight">{point.trustScore}%</span>
              <span className="text-[10px] text-gray-500 font-medium">Community confidence</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#0f2b46] rounded-full" style={{ width: `${point.trustScore}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BadgeCheck className="text-[#4c7c59]" size={20} />
              <h4 className="text-sm font-bold text-gray-900">Contributor Trust</h4>
            </div>
            <span className="text-sm font-bold text-[#4c7c59]">{point.contributorTrust}</span>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Weighted by recent verification accuracy and photo metadata match.
          </p>
        </div>

        {point.type === Category.MOBILE_MONEY && (
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="text-[#0f2b46]" size={20} />
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Reliability Indicator</h4>
              </div>
              <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${getReliabilityColor(point.reliability)}`}>
                {point.reliability || 'Unrated'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed italic">
              Merchant stability is monitored via real-time transaction reports.
            </p>
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="text-[#0f2b46]" size={20} />
              <h4 className="text-sm font-bold text-gray-900">Data Integrity</h4>
            </div>
            <span className="text-sm font-bold text-[#0f2b46]">{point.trustScore}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0f2b46] rounded-full" style={{ width: `${point.trustScore}%` }}></div>
          </div>
          <div className="flex items-center text-[10px] text-gray-400 font-medium leading-relaxed">
            <Info size={12} className="mr-1 shrink-0" />
            Verified with device GPS + live camera capture.
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="text-sm font-bold text-gray-900 px-1">Location Intelligence</h4>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
              <MapPin size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Address</span>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{point.location}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
              <Clock size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Hours</span>
              <p className="text-xs text-gray-500 mt-0.5">{point.hours || 'Standard Business Hours'}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
              <User size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Queue Length</span>
              <p className="text-xs text-gray-500 mt-0.5">{point.queueLength}</p>
            </div>
          </div>

          {point.type === Category.FUEL && point.fuelType && (
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
              <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                <Zap size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900">Fuel Type</span>
                <p className="text-xs text-gray-500 mt-0.5">{point.fuelType}</p>
              </div>
            </div>
          )}

          {point.type === Category.MOBILE_MONEY && point.merchantId && (
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
              <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                <BadgeCheck size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900">Merchant ID</span>
                <p className="text-xs font-mono text-gray-600 mt-0.5">{point.merchantId}</p>
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
              <CreditCard size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900">Accepted Payments</span>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                {point.paymentMethods?.join(', ') || 'Cash, Mobile Money'}
              </p>
            </div>
          </div>
        </div>

        <div className="h-24"></div>
      </div>

      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[calc(28rem-2rem)] px-4 flex items-center space-x-2 z-40">
        <button
          onClick={isAuthenticated ? onContribute : onAuth}
          className="flex-1 h-14 bg-[#c86b4a] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 hover:bg-[#b85f3f] active:scale-95 transition-all"
        >
          <Zap size={18} />
          <span>{isAuthenticated ? 'Add Data' : 'Sign In to Add Data'}</span>
        </button>
        <button className="h-14 w-14 bg-gray-100 text-gray-900 rounded-xl shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <Navigation2 size={20} />
        </button>
      </div>
    </div>
  );
};

export default Details;
