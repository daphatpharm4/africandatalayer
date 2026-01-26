
import React from 'react';
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  Flame, 
  Activity, 
  Share2, 
  ShieldCheck 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

interface Props {
  onBack: () => void;
  onAdmin?: () => void;
}

const MOCK_TIME_DATA = [
  { name: 'Mon', count: 400 },
  { name: 'Tue', count: 300 },
  { name: 'Wed', count: 600 },
  { name: 'Thu', count: 800 },
  { name: 'Fri', count: 500 },
  { name: 'Sat', count: 900 },
  { name: 'Sun', count: 1248 },
];

const MOCK_HISTORICAL_XP = [
  { name: 'W1', value: 2000 },
  { name: 'W2', value: 4500 },
  { name: 'W3', value: 3800 },
  { name: 'W4', value: 8500 },
];

const Analytics: React.FC<Props> = ({ onBack, onAdmin }) => {
  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-blue-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Impact Dashboard</h3>
        <button className="p-2 text-gray-400 absolute right-2">
          <Share2 size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* User Info with potential Admin Access */}
        <div className="flex items-center justify-between py-2">
           <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full border-2 border-white shadow bg-blue-50 overflow-hidden">
                 <img src="https://picsum.photos/seed/kofi/300/300" alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                 <h4 className="font-bold text-gray-900 text-sm">Kofi Mensah</h4>
                 <div className="flex items-center space-x-1.5">
                    <ShieldCheck size={12} className="text-green-600" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Senior Contributor</span>
                 </div>
              </div>
           </div>
           {onAdmin && (
             <button 
               onClick={onAdmin}
               className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold uppercase rounded-lg tracking-wider hover:bg-black transition-colors shadow-sm"
             >
               Admin
             </button>
           )}
        </div>

        {/* Global Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Points</span>
              <div className="flex items-baseline space-x-1">
                 <span className="text-xl font-bold text-gray-900">1,248</span>
                 <span className="text-[10px] text-green-600 font-bold">+12%</span>
              </div>
           </div>
           <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City Rank</span>
              <div className="flex items-baseline space-x-1">
                 <span className="text-xl font-bold text-gray-900">#42</span>
                 <span className="text-[10px] text-blue-600 font-bold">Top 5%</span>
              </div>
           </div>
        </div>

        {/* Chart Card 1: Activity Metrics */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                 <Activity size={16} className="text-green-600" />
                 <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Performance Metrics</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Weekly</span>
           </div>
           
           <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Data Points Verified</span>
              <h3 className="text-3xl font-extrabold text-gray-900">342</h3>
           </div>

           <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={MOCK_TIME_DATA}>
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                       {MOCK_TIME_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Sun' ? '#059669' : '#e5e7eb'} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-2 px-1">
                 {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                   <span key={d} className={`text-[8px] font-bold uppercase tracking-wider ${d === 'S' ? 'text-green-600' : 'text-gray-300'}`}>{d}</span>
                 ))}
              </div>
           </div>
        </div>

        {/* Chart Card 2: Growth Metrics */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                 <TrendingUp size={16} className="text-blue-600" />
                 <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Total EXP Earned</span>
              </div>
              <div className="text-right">
                 <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">+22%</span>
                 <p className="text-[8px] text-gray-300 font-bold uppercase">vs last month</p>
              </div>
           </div>

           <h3 className="text-3xl font-extrabold text-gray-900">8,500</h3>

           <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={MOCK_HISTORICAL_XP}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                 </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-2 px-1">
                 {['W1', 'W2', 'W3', 'W4'].map(d => (
                   <span key={d} className="text-[8px] font-bold uppercase tracking-wider text-gray-300">{d}</span>
                 ))}
              </div>
           </div>
        </div>

        {/* Insights Section */}
        <div className="space-y-4">
           <div className="flex items-center space-x-2 px-1">
              <Flame className="text-green-600" size={16} />
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Community Impact Today</h4>
           </div>

           <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
              <div className="p-3 bg-gray-50 rounded-xl text-gray-900">
                 <Activity size={20} />
              </div>
              <div className="flex flex-col space-y-1">
                 <span className="text-xs font-bold text-gray-900">Price Transparency</span>
                 <p className="text-[11px] text-gray-500 leading-relaxed">
                   Your market price updates saved local shoppers an average of <span className="font-bold text-green-600">12%</span> today.
                 </p>
              </div>
           </div>

           <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
              <div className="p-3 bg-gray-50 rounded-xl text-gray-900">
                 <BarChart3 size={20} />
              </div>
              <div className="flex flex-col space-y-1">
                 <span className="text-xs font-bold text-gray-900">Policy Influence</span>
                 <p className="text-[11px] text-gray-500 leading-relaxed">
                   Your infrastructure tags were included in the <span className="font-bold text-blue-600 text-[10px] uppercase tracking-wider">Q3 Infrastructure Report</span>.
                 </p>
              </div>
           </div>
        </div>

        {/* Milestone Card */}
        <div className="bg-[#f9fafb] p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-4">
           <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Next Milestone</span>
              <h4 className="text-lg font-bold text-gray-900">Expert Validator</h4>
              <p className="text-xs text-gray-400 font-medium mt-1">1,500 / 2,000 XP</p>
           </div>
           <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: '75%' }} />
           </div>
           <p className="text-[10px] text-gray-500 italic px-4 leading-relaxed">
             "Earn 500 more XP to unlock advanced administrative verification tools."
           </p>
        </div>

        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default Analytics;
