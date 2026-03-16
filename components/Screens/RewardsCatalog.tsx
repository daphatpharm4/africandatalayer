import React, { useEffect, useState } from 'react';
import { Smartphone, Fuel, Gift, Award, CheckCircle } from 'lucide-react';
import ScreenHeader from '../shared/ScreenHeader';
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
    { id: 1, name: t('Mobile credit (5,000 FCFA)', 'Crédit mobile (5 000 FCFA)'), cost: '5,000 XP', stock: t('In Stock', 'En stock'), icon: <Smartphone />, category: t('Mobile credit', 'Crédit mobile') },
    { id: 2, name: t('Fuel discount 10%', 'Réduction carburant 10%'), cost: '12,000 XP', stock: t('Low Stock', 'Stock faible'), icon: <Fuel />, category: t('Fuel discounts', 'Réductions carburant') },
    { id: 3, name: t('Gift card (Local Grocer)', 'Carte cadeau (épicerie locale)'), cost: '8,500 XP', stock: t('In Stock', 'En stock'), icon: <Gift />, category: t('Gift cards', 'Cartes cadeaux') },
    { id: 4, name: t('Community badge boost', 'Boost badge communauté'), cost: '2,000 XP', stock: t('Out of Stock', 'Rupture de stock'), icon: <Award />, category: t('Recognition', 'Reconnaissance') }
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
    <div className="screen-shell">
      <ScreenHeader title={t('Rewards', 'R\u00e9compenses')} onBack={onBack} language={language} />

      <div className="p-4 space-y-6">
        <div className="bg-navy p-6 rounded-2xl text-white shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="micro-label opacity-80">{t('Your Balance', 'Votre solde')}</span>
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
          <h4 className="micro-label text-gray-400 px-1">{t('Redeemable Rewards', 'Récompenses échangeables')}</h4>
          <div className="grid gap-3">
            {rewards.map(item => (
              <div key={item.id} className="card p-4 flex items-center justify-between group">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-50 text-navy rounded-2xl active:bg-gray-100 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{item.name}</span>
                    <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">{item.category}</span>
                    <span className={`micro-label ${
                      item.stock === t('In Stock', 'En stock') ? 'text-forest' : item.stock === t('Low Stock', 'Stock faible') ? 'text-terra' : 'text-gray-400'
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
                  className={`px-4 py-2 micro-label rounded-xl transition-all ${
                    item.stock === t('Out of Stock', 'Rupture de stock')
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-navy-light text-navy hover:bg-navy hover:text-white'
                  }`}
                >
                  {item.cost}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {selectedReward && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4 shadow-xl">
            {redeemed ? (
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-forest-wash text-forest flex items-center justify-center mx-auto">
                  <CheckCircle size={28} />
                </div>
                <h4 className="text-lg font-bold text-gray-900">{t('Reward Redeemed', 'Récompense échangée')}</h4>
                <p className="text-xs text-gray-500">{t('Your voucher is available in the Rewards wallet.', 'Votre bon est disponible dans le portefeuille récompenses.')}</p>
                <button
                  onClick={() => setSelectedReward(null)}
                  className="w-full h-12 bg-navy text-white rounded-xl micro-label"
                >
                  {t('Done', 'Terminé')}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900">{t('Confirm Redemption', 'Confirmer l\'échange')}</h4>
                  <button onClick={() => setSelectedReward(null)} className="text-xs font-bold text-gray-400 uppercase">{t('Close', 'Fermer')}</button>
                </div>
                <div className="bg-page border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-900">{activeReward?.name}</p>
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-1">{t('Cost', 'Coût')}: {activeReward?.cost}</p>
                </div>
                <button
                  onClick={() => setRedeemed(true)}
                  className="w-full h-12 bg-terra text-white rounded-xl micro-label"
                >
                  {t('Confirm Redeem', 'Confirmer échange')}
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
