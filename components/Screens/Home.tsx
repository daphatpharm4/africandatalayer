import React, { useMemo, useState } from 'react';
import { Category, DataPoint } from '../../types';
import {
  Fuel,
  Landmark,
  List,
  Map as MapIcon,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  User
} from 'lucide-react';

interface Props {
  onSelectPoint: (point: DataPoint) => void;
  isAuthenticated: boolean;
  onAuth: () => void;
  onContribute: () => void;
}

const MOCK_POINTS: DataPoint[] = [
  {
    id: '1',
    name: 'Total Akwa',
    type: Category.FUEL,
    location: 'Gare des Grands Bus, Akwa, Douala',
    price: 840,
    quality: 'Premium',
    currency: 'XAF',
    lastUpdated: '12 mins ago',
    availability: 'High',
    queueLength: 'Short',
    trustScore: 98,
    contributorTrust: 'Gold',
    verified: true,
    hours: 'Open 24 Hours • Daily',
    paymentMethods: ['Cash', 'MTN MoMo', 'Orange Money', 'Cards']
  },
  {
    id: '2',
    name: 'MTN Mobile Money - Bonapriso',
    type: Category.MOBILE_MONEY,
    location: 'Rue des Ecoles, Bonapriso, Douala',
    lastUpdated: '42 mins ago',
    availability: 'High',
    queueLength: 'Moderate',
    trustScore: 94,
    contributorTrust: 'Silver',
    provider: 'MTN',
    merchantId: 'M-129384',
    reliability: 'Excellent',
    verified: false
  },
  {
    id: '3',
    name: 'Tradex Gare des Grands Bus',
    type: Category.FUEL,
    location: 'Akwa, Douala',
    price: 828,
    quality: 'Standard',
    currency: 'XAF',
    lastUpdated: '42 mins ago',
    availability: 'High',
    queueLength: 'Moderate',
    trustScore: 92,
    contributorTrust: 'Gold',
    verified: true,
    hours: 'Open 24 Hours • Daily'
  },
  {
    id: '4',
    name: 'Orange Money Kiosk',
    type: Category.MOBILE_MONEY,
    location: 'Marché Deido, Douala',
    lastUpdated: '3h ago',
    availability: 'Low',
    queueLength: 'Long',
    trustScore: 78,
    contributorTrust: 'Bronze',
    provider: 'Orange',
    merchantId: 'O-99231',
    reliability: 'Congested'
  }
];

const MARKER_POSITIONS: Record<string, { top: string; left: string }> = {
  '1': { top: '22%', left: '32%' },
  '2': { top: '52%', left: '58%' },
  '3': { top: '28%', left: '45%' },
  '4': { top: '42%', left: '18%' }
};

const Home: React.FC<Props> = ({ onSelectPoint, isAuthenticated, onAuth, onContribute }) => {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [groundingResults, setGroundingResults] = useState<string[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  const filteredPoints = useMemo(() => {
    if (activeCategory === 'ALL') return MOCK_POINTS;
    return MOCK_POINTS.filter(p => p.type === activeCategory);
  }, [activeCategory]);

  const handleSmartSearch = () => {
    if (!searchQuery.trim()) return;
    setGroundingResults([
      `Top result: ${searchQuery} • Bonanjo (verified 2h ago)`,
      `Nearby match: ${searchQuery} • Akwa (verified 30m ago)`
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <header className="px-4 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-[#1f2933] leading-tight">African Data Layer</h2>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">GPS Centered • Douala, Cameroon</span>
          </div>
          <button onClick={onAuth} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
            <User size={18} />
          </button>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[#4c7c59] mb-3">
          <ShieldCheck size={12} />
          <span>Offline-first sync ready</span>
        </div>

        <div className="relative mb-4 group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f2b46]">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search neighborhoods or landmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
            className="w-full h-10 pl-10 pr-12 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:bg-white focus:border-[#0f2b46] focus:outline-none transition-all"
          />
          <button
            onClick={handleSmartSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-colors text-[#0f2b46] hover:bg-[#f2f4f7]"
          >
            <Search size={16} />
          </button>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl mb-2">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === 'ALL' ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            Both
          </button>
          <button
            onClick={() => setActiveCategory(Category.FUEL)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === Category.FUEL ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            Fuel
          </button>
          <button
            onClick={() => setActiveCategory(Category.MOBILE_MONEY)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${activeCategory === Category.MOBILE_MONEY ? 'bg-white shadow-sm text-[#0f2b46]' : 'text-gray-500'}`}
          >
            Kiosk
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {groundingResults.length > 0 && (
          <div className="absolute top-0 inset-x-0 z-30 p-4 space-y-2 bg-white/95 border-b border-gray-100 shadow-lg animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#0f2b46] uppercase tracking-widest">Smart Search Results</span>
              <button onClick={() => setGroundingResults([])} className="text-[10px] text-gray-400 font-bold uppercase">Clear</button>
            </div>
            {groundingResults.map((result, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[#f2f4f7] rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-900 truncate pr-4">{result}</span>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'map' ? (
          <div className="flex-1 bg-[#e7eef4] relative overflow-hidden" onClick={() => setActiveMarkerId(null)}>
            <img
              src="https://picsum.photos/seed/douala-map/1200/1800"
              className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale"
              alt="map placeholder"
            />
            <div className="absolute inset-x-4 top-4 z-20 bg-white/95 backdrop-blur rounded-xl p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">GPS Locked</p>
                  <p className="text-xs text-gray-500">Centered on your current location</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#4c7c59] animate-pulse"></div>
              </div>
            </div>
            <div className="absolute inset-0">
              {filteredPoints.map(point => {
                const pos = MARKER_POSITIONS[point.id] || { top: '50%', left: '50%' };
                const isActive = activeMarkerId === point.id;

                return (
                  <div
                    key={point.id}
                    className="absolute transition-transform duration-300 z-10"
                    style={{ top: pos.top, left: pos.left }}
                  >
                    {isActive && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPoint(point);
                        }}
                      >
                        <div className="p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-[#0f2b46] uppercase tracking-widest">
                              {point.type === Category.FUEL ? 'Fuel Station' : 'Money Kiosk'}
                            </span>
                            <span className="text-[8px] font-bold text-[#4c7c59]">{point.trustScore}%</span>
                          </div>
                          <h4 className="text-[11px] font-bold text-gray-900 truncate">{point.name}</h4>
                          <p className="text-[9px] text-gray-400 truncate flex items-center">
                            <MapPin size={8} className="mr-0.5" /> {point.location}
                          </p>
                          <div className="text-[9px] text-gray-500 space-y-0.5">
                            <p>
                              {point.type === Category.FUEL ? `Price: ${point.price} ${point.currency} • ${point.quality}` : `Availability: ${point.availability}`}
                            </p>
                            <p>Queue: {point.queueLength} • Updated {point.lastUpdated}</p>
                            <p>Contributor: {point.contributorTrust} trust</p>
                          </div>
                        </div>
                        <div className="bg-[#0f2b46] py-1.5 text-center">
                          <span className="text-[8px] font-bold text-white uppercase tracking-widest">View Details</span>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white"></div>
                      </div>
                    )}

                    <div
                      className={`p-2.5 rounded-full border-2 border-white shadow-xl cursor-pointer transition-all active:scale-90 ${
                        isActive
                          ? 'bg-[#0f2b46] scale-125 z-20'
                          : point.type === Category.FUEL
                          ? 'bg-[#0f2b46]/80 hover:bg-[#0f2b46]'
                          : 'bg-[#1f2933]/80 hover:bg-[#1f2933]'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMarkerId(isActive ? null : point.id);
                      }}
                    >
                      {point.type === Category.FUEL ? (
                        <Fuel size={14} className="text-white" />
                      ) : (
                        <Landmark size={14} className="text-white" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 pb-24">
            {filteredPoints.map(point => (
              <button
                key={point.id}
                onClick={() => onSelectPoint(point)}
                className="w-full text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4 active:scale-[0.98] transition-transform"
              >
                <div className={`p-3 rounded-xl ${point.type === Category.FUEL ? 'bg-[#e7eef4] text-[#0f2b46]' : 'bg-gray-100 text-gray-700'}`}>
                  {point.type === Category.FUEL ? <Fuel size={20} /> : <Landmark size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-gray-900 text-sm">{point.name}</h4>
                    {point.price && <span className="font-bold text-gray-900 text-sm">{point.price} {point.currency}</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">{point.location}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">Updated {point.lastUpdated}</span>
                    {point.verified && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-[#eaf3ee] text-[#4c7c59] rounded-full font-bold uppercase tracking-wider">Verified</span>
                    )}
                  </div>
                </div>
                <MapPin size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setViewMode(v => (v === 'map' ? 'list' : 'map'))}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-[#1f2933] text-white rounded-full shadow-2xl flex items-center space-x-2 z-40 hover:bg-black active:scale-95 transition-all"
        >
          {viewMode === 'map' ? <List size={16} /> : <MapIcon size={16} />}
          <span className="text-xs font-bold uppercase tracking-wider">{viewMode === 'map' ? 'List View' : 'Map View'}</span>
        </button>

        <button
          onClick={onContribute}
          className="fixed bottom-24 right-4 w-14 h-14 bg-[#c86b4a] text-white rounded-full shadow-2xl flex items-center justify-center z-40 hover:bg-[#b85f3f] active:scale-95 transition-all"
        >
          <Plus size={22} />
        </button>

        {!isAuthenticated && (
          <div className="absolute top-20 left-4 right-4 bg-white/95 backdrop-blur p-3 rounded-xl shadow-xl border border-[#f2f4f7] z-20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#c86b4a] uppercase tracking-widest">Contributor Access</span>
              <p className="text-xs text-gray-700 font-medium">Log in to add data and earn XP.</p>
            </div>
            <button
              onClick={onAuth}
              className="px-4 py-2 bg-[#0f2b46] text-white text-[10px] font-bold uppercase rounded-xl tracking-wide hover:bg-[#0b2236]"
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
