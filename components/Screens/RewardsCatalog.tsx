import React, { useEffect, useState } from 'react';
import { ArrowLeft, Smartphone, Fuel, Gift, Award, CheckCircle } from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import type { UserProfile } from '../../shared/types';

interface Props {
  onBack: () => void;
}

const RewardsCatalog: React.FC<Props> = ({ onBack }) => {
  const [selectedReward, setSelectedReward] = useState<number | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rewards = [
    { id: 1, name: 'Mobile credit (5,000 FCFA)', cost: '5,000 XP', stock: 'In Stock', icon: <Smartphone />, category: 'Mobile credit' },
    { id: 2, name: 'Fuel discount 10%', cost: '12,000 XP', stock: 'Low Stock', icon: <Fuel />, category: 'Fuel discounts' },
    { id: 3, name: 'Gift card (Local Grocer)', cost: '8,500 XP', stock: 'In Stock', icon: <Gift />, category: 'Gift cards' },
    { id: 4, name: 'Community badge boost', cost: '2,000 XP', stock: 'Out of Stock', icon: <Award />, category: 'Recognition' }
  ];

  const activeReward = rewards.find((reward) => reward.id === selectedReward);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const data = await apiJson<UserProfile>('/api/user');
        setXpBalance(typeof data?.XP === 'number' ? data.XP : 0);
      } catch {
        setXpBalance(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">Rewards</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-[#0f2b46] p-6 rounded-2xl text-white shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Your Balance</span>
            {isLoading ? (
              <div className="h-8 w-28 rounded-lg bg-white/20 animate-pulse"></div>
            ) : (
              <div className="text-3xl font-bold">
                {xpBalance?.toLocaleString?.() ?? '0'} <span className="text-sm font-medium opacity-60">XP</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-white/20 rounded-2xl"><Award size={24} /></div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Redeemable Rewards</h4>
          <div className="grid gap-3">
            {rewards.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-50 text-[#0f2b46] rounded-2xl group-hover:bg-[#f2f4f7] transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{item.name}</span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{item.category}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      item.stock === 'In Stock' ? 'text-[#4c7c59]' : item.stock === 'Low Stock' ? 'text-[#c86b4a]' : 'text-gray-400'
                    }`}>
                      {item.stock}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (item.stock === 'Out of Stock') return;
                    setSelectedReward(item.id);
                    setRedeemed(false);
                  }}
                  disabled={item.stock === 'Out of Stock'}
                  className={`px-4 py-2 text-[10px] font-bold uppercase rounded-xl tracking-widest transition-all ${
                    item.stock === 'Out of Stock'
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-[#e7eef4] text-[#0f2b46] hover:bg-[#0f2b46] hover:text-white'
                  }`}
                >
                  {item.cost}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-2">
          <Gift size={24} className="mx-auto text-gray-300" />
          <p className="text-xs text-gray-400 font-medium">Rewards are replenished via local merchant partnerships in Douala.</p>
        </div>
      </div>

      {selectedReward && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4 shadow-xl">
            {redeemed ? (
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-[#eaf3ee] text-[#4c7c59] flex items-center justify-center mx-auto">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900">Reward Redeemed</h4>
                <p className="text-xs text-gray-500">Your voucher is available in the Rewards wallet.</p>
                <button
                  onClick={() => setSelectedReward(null)}
                  className="w-full h-12 bg-[#0f2b46] text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900">Confirm Redemption</h4>
                  <button onClick={() => setSelectedReward(null)} className="text-xs font-bold text-gray-400 uppercase">Close</button>
                </div>
                <div className="bg-[#f9fafb] border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-900">{activeReward?.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Cost: {activeReward?.cost}</p>
                </div>
                <button
                  onClick={() => setRedeemed(true)}
                  className="w-full h-12 bg-[#c86b4a] text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                >
                  Confirm Redeem
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardsCatalog;
