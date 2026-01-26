
import React from 'react';
import { User, ShieldCheck, Database, Award, Wallet, ChevronRight, Settings as SettingsIcon, Clock, Zap, ArrowLeft, Gift } from 'lucide-react';

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onRedeem: () => void;
}

const Profile: React.FC<Props> = ({ onBack, onSettings, onRedeem }) => {
  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-blue-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Profile & Rewards</h3>
        <button onClick={onSettings} className="p-2 text-blue-600 absolute right-2">
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex flex-col items-center py-4 text-center">
           <div className="relative mb-4">
             <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-blue-50 overflow-hidden">
                <img src="https://picsum.photos/seed/jeanpaul/300/300" alt="avatar" className="w-full h-full object-cover" />
             </div>
             <div className="absolute -bottom-1 -right-1 p-1 bg-green-500 rounded-full border-2 border-white">
                <ShieldCheck size={14} className="text-white" />
             </div>
           </div>
           <h2 className="text-xl font-bold text-gray-900">Jean-Paul Eto'o</h2>
           <div className="flex items-center justify-center text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-widest space-x-2">
              <Database size={12} />
              <span>Douala, Cameroon</span>
           </div>
           <div className="mt-4">
              <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-widest border border-blue-100 shadow-sm">
                Senior Contributor
              </span>
           </div>
        </div>

        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden group">
           <div className="relative z-10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Available Rewards</span>
              <div className="flex items-baseline space-x-1">
                 <h3 className="text-3xl font-extrabold tracking-tight">45,000</h3>
                 <span className="text-lg font-bold opacity-60">XP</span>
              </div>
           </div>
           <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                 <Award size={24} />
              </div>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <button 
             onClick={onRedeem}
             className="h-14 bg-white text-blue-600 border border-blue-100 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-blue-50 transition-all flex items-center justify-center space-x-2"
           >
             <Gift size={16} />
             <span>Redeem XP</span>
           </button>
           <button className="h-14 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">View Benefits</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-green-600">
                 <ShieldCheck size={16} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Trust Score</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-2xl font-bold text-gray-900">98%</span>
                 <div className="mt-2 h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: '98%' }} />
                 </div>
              </div>
           </div>
           <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-blue-600">
                 <Database size={16} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Reports</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-2xl font-bold text-gray-900">1,240</span>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Top 5%</p>
              </div>
           </div>
        </div>

        <div className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contribution History</h4>
              <button className="text-[10px] font-bold text-blue-600 uppercase">View All</button>
           </div>
           
           <div className="space-y-3">
              {[
                { title: 'Petrol Price - Total', time: '1h ago', loc: 'Akwa', xp: '+500', status: 'VERIFIED' },
                { title: 'Kiosk Availability', time: '3h ago', loc: 'Deido', xp: '+250', status: 'PENDING' }
              ].map((act, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                   <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                         {i === 0 ? <Zap size={18} /> : <Clock size={18} />}
                      </div>
                      <div className="flex flex-col">
                         <span className="text-xs font-bold text-gray-900">{act.title}</span>
                         <span className="text-[10px] text-gray-400 font-bold uppercase">{act.time} • {act.loc}</span>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-green-600">{act.xp} XP</p>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${act.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {act.status}
                      </span>
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
