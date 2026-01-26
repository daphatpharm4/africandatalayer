import React from 'react';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Calendar,
  Gift,
  MapPin,
  Settings as SettingsIcon,
  Wallet
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onRedeem: () => void;
}

const Profile: React.FC<Props> = ({ onBack, onSettings, onRedeem }) => {
  const history = [
    { date: 'Today • 11:14', location: 'Akwa, Douala', type: 'Fuel Price', xp: 5 },
    { date: 'Yesterday • 17:40', location: 'Bonapriso, Douala', type: 'Kiosk Availability', xp: 15 },
    { date: 'Mar 22 • 08:22', location: 'Deido, Douala', type: 'Queue Length', xp: 10 }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Dashboard</h3>
        <button onClick={onSettings} className="p-2 text-[#0f2b46] absolute right-2">
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex flex-col items-center py-4 text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-[#e7eef4] overflow-hidden">
              <img src="https://picsum.photos/seed/jeanpaul/300/300" alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-[#4c7c59] rounded-full border-2 border-white">
              <BadgeCheck size={14} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Jean-Paul Eto'o</h2>
          <div className="flex items-center justify-center text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-widest space-x-2">
            <MapPin size={12} />
            <span>Douala, Cameroon</span>
          </div>
          <div className="mt-4">
            <span className="px-4 py-1.5 bg-[#e7eef4] text-[#0f2b46] text-[10px] font-bold rounded-full uppercase tracking-widest border border-[#d5e1eb] shadow-sm">
              Senior Contributor
            </span>
          </div>
        </div>

        <div className="bg-[#0f2b46] rounded-2xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">XP Balance</span>
            <div className="flex items-baseline space-x-1">
              <h3 className="text-3xl font-extrabold tracking-tight">45,000</h3>
              <span className="text-lg font-bold opacity-60">XP</span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <Award size={24} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onRedeem}
            className="h-14 bg-white text-[#0f2b46] border border-[#d5e1eb] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-[#f2f4f7] transition-all flex items-center justify-center space-x-2"
          >
            <Gift size={16} />
            <span>Redeem XP</span>
          </button>
          <button className="h-14 bg-[#c86b4a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-[#b85f3f] transition-all flex items-center justify-center space-x-2">
            <Wallet size={16} />
            <span>Convert to Rewards</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-[#4c7c59]">
              <BadgeCheck size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Trust Score</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">98%</span>
              <div className="mt-2 h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                <div className="h-full bg-[#4c7c59] rounded-full transition-all duration-1000" style={{ width: '98%' }} />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-[#0f2b46]">
              <Calendar size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Badges</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">7</span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Next: Urban Validator</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contribution History</h4>
            <button className="text-[10px] font-bold text-[#0f2b46] uppercase">View All</button>
          </div>

          <div className="space-y-3">
            {history.map((act, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <Calendar size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900">{act.type}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{act.date}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{act.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#4c7c59]">+{act.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default Profile;
