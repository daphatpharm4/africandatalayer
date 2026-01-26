import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  Medal,
  Share2,
  ShieldCheck,
  ThermometerSun
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie
} from 'recharts';

interface Props {
  onBack: () => void;
  onAdmin?: () => void;
}

const CITY_DATA = [
  { name: 'Douala', value: 1248 },
  { name: 'Lagos', value: 980 },
  { name: 'Accra', value: 640 },
  { name: 'Nairobi', value: 520 }
];

const XP_DISTRIBUTION = [
  { name: '0-100', value: 240 },
  { name: '100-500', value: 420 },
  { name: '500-1k', value: 260 },
  { name: '1k+', value: 110 }
];

const HEATMAP = [
  ['High', 'High', 'Medium', 'Low'],
  ['Medium', 'High', 'Medium', 'Low'],
  ['Low', 'Medium', 'High', 'Medium']
];

const Analytics: React.FC<Props> = ({ onBack, onAdmin }) => {
  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Investor Analytics</h3>
        <button className="p-2 text-gray-400 absolute right-2">
          <Share2 size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full border-2 border-white shadow bg-[#e7eef4] overflow-hidden">
              <img src="https://picsum.photos/seed/kofi/300/300" alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <h4 className="font-bold text-gray-900 text-sm">Kofi Mensah</h4>
              <div className="flex items-center space-x-1.5">
                <ShieldCheck size={12} className="text-[#4c7c59]" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Senior Contributor</span>
              </div>
            </div>
          </div>
          {onAdmin && (
            <button
              onClick={onAdmin}
              className="px-3 py-1.5 bg-[#1f2933] text-white text-[10px] font-bold uppercase rounded-xl tracking-wider hover:bg-black transition-colors shadow-sm"
            >
              Admin
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">% Approved</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-gray-900">92%</span>
              <span className="text-[10px] text-[#4c7c59] font-bold">+4%</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Cities</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-gray-900">18</span>
              <span className="text-[10px] text-[#0f2b46] font-bold">+3</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 size={16} className="text-[#0f2b46]" />
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Contributions per City</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Weekly</span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CITY_DATA} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                  {CITY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#0f2b46' : '#d5e1eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Medal size={16} className="text-[#4c7c59]" />
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">XP Distribution</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">All Users</span>
          </div>
          <div className="h-44 w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={XP_DISTRIBUTION} dataKey="value" outerRadius={70} innerRadius={40}>
                  {XP_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0f2b46', '#4c7c59', '#c86b4a', '#d5e1eb'][index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ThermometerSun size={16} className="text-[#c86b4a]" />
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Data Freshness Heatmap</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Last 24h</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {HEATMAP.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`h-8 rounded-xl ${
                    cell === 'High'
                      ? 'bg-[#4c7c59]'
                      : cell === 'Medium'
                      ? 'bg-[#c86b4a]'
                      : 'bg-gray-200'
                  }`}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Medal size={16} className="text-[#0f2b46]" />
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Top Contributor Leaderboard</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Monthly</span>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Fatou B.', city: 'Dakar', xp: '12,420 XP' },
              { name: 'Jean-Paul E.', city: 'Douala', xp: '11,980 XP' },
              { name: 'Kofi M.', city: 'Accra', xp: '10,540 XP' }
            ].map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between bg-[#f9fafb] border border-gray-100 rounded-2xl p-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">#{index + 1} {entry.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{entry.city}</p>
                </div>
                <span className="text-xs font-bold text-[#4c7c59]">{entry.xp}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#f9fafb] p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-3">
          <p className="text-[10px] font-bold text-[#0f2b46] uppercase tracking-widest">API Monetization Ready</p>
          <p className="text-xs text-gray-500">
            Tiered access for municipalities, NGOs, and logistics providers with real-time SLAs.
          </p>
        </div>

        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default Analytics;
