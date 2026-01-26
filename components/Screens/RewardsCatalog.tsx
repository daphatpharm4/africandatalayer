
import React from 'react';
import { ArrowLeft, Wallet, Smartphone, Fuel, Gift, ChevronRight, Award } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const RewardsCatalog: React.FC<Props> = ({ onBack }) => {
  const rewards = [
    { id: 1, name: "Airtime Voucher $5", cost: "5,000 XP", icon: <Smartphone />, category: "Communications" },
    { id: 2, name: "Fuel Discount 10%", cost: "12,000 XP", icon: <Fuel />, category: "Infrastructure" },
    { id: 3, name: "Data Bundle 5GB", cost: "8,500 XP", icon: <GlobeIcon />, category: "Communications" },
    { id: 4, name: "Community Badge", cost: "2,000 XP", icon: <Award />, category: "Reputation" }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-blue-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Rewards Catalog</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Your Balance</span>
            <div className="text-3xl font-bold">45,000 <span className="text-sm font-medium opacity-60">XP</span></div>
          </div>
          <div className="p-3 bg-white/20 rounded-xl"><Award size={24} /></div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Available Redemptions</h4>
          <div className="grid gap-3">
            {rewards.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-50 text-blue-600 rounded-xl group-hover:bg-blue-50 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{item.name}</span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{item.category}</span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded-lg tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                  {item.cost}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-2">
           <Gift size={24} className="mx-auto text-gray-300" />
           <p className="text-xs text-gray-400 font-medium">New rewards are added based on local merchant partnerships in Douala.</p>
        </div>
      </div>
    </div>
  );
};

const GlobeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);

export default RewardsCatalog;
