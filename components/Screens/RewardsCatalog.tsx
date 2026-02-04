import React, { useEffect, useState } from 'react';
import { ArrowLeft, Smartphone, Fuel, Gift, Award, CheckCircle } from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import type { UserProfile } from '../../shared/types';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

const RewardsCatalog: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [selectedReward, setSelectedReward] = useState<number | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rewards = [
    { id: 1, name: t('Mobile credit (5,000 FCFA)', 'Credit mobile (5 000 FCFA)'), cost: '5,000 XP', stock: t('In Stock', 'En stock'), icon: <Smartphone />, category: t('Mobile credit', 'Credit mobile') },
    { id: 2, name: t('Fuel discount 10%', 'Reduction carburant 10%'), cost: '12,000 XP', stock: t('Low Stock', 'Stock faible'), icon: <Fuel />, category: t('Fuel discounts', 'Reductions carburant') },
    { id: 3, name: t('Gift card (Local Grocer)', 'Carte cadeau (epicerie locale)'), cost: '8,500 XP', stock: t('In Stock', 'En stock'), icon: <Gift />, category: t('Gift cards', 'Cartes cadeaux') },
    { id: 4, name: t('Community badge boost', 'Boost badge communaute'), cost: '2,000 XP', stock: t('Out of Stock', 'Rupture de stock'), icon: <Award />, category: t('Recognition', 'Reconnaissance') }
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
        <h3 className="text-sm font-bold mx-auto">{t('Rewards', 'Recompenses')}</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-[#0f2b46] p-6 rounded-2xl text-white shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t('Your Balance', 'Votre solde')}</span>
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
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Redeemable Rewards', 'Recompenses echangeables')}</h4>
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
                      item.stock === t('In Stock', 'En stock') ? 'text-[#4c7c59]' : item.stock === t('Low Stock', 'Stock faible') ? 'text-[#c86b4a]' : 'text-gray-400'
                    }`}>
                      {item.stock}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (item.stock === t('Out of Stock', 'Rupture de stock')) return;
                    setSelectedReward(item.id);
                    setRedeemed(false);
                  }}
                  disabled={item.stock === t('Out of Stock', 'Rupture de stock')}
                  className={`px-4 py-2 text-[10px] font-bold uppercase rounded-xl tracking-widest transition-all ${
                    item.stock === t('Out of Stock', 'Rupture de stock')
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
          <p className="text-xs text-gray-400 font-medium">{t('Rewards are replenished via local merchant partnerships in Douala.', 'Les recompenses sont reapprovisionnees avec des partenaires marchands locaux a Douala.')}</p>
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
                <h4 className="text-lg font-bold text-gray-900">{t('Reward Redeemed', 'Recompense echangee')}</h4>
                <p className="text-xs text-gray-500">{t('Your voucher is available in the Rewards wallet.', 'Votre bon est disponible dans le portefeuille recompenses.')}</p>
                <button
                  onClick={() => setSelectedReward(null)}
                  className="w-full h-12 bg-[#0f2b46] text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                >
                  {t('Done', 'Termine')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900">{t('Confirm Redemption', 'Confirmer l\'echange')}</h4>
                  <button onClick={() => setSelectedReward(null)} className="text-xs font-bold text-gray-400 uppercase">{t('Close', 'Fermer')}</button>
                </div>
                <div className="bg-[#f9fafb] border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-900">{activeReward?.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{t('Cost', 'Cout')}: {activeReward?.cost}</p>
                </div>
                <button
                  onClick={() => setRedeemed(true)}
                  className="w-full h-12 bg-[#c86b4a] text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                >
                  {t('Confirm Redeem', 'Confirmer echange')}
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
