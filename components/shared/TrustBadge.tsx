import React from 'react';

export type TrustTier = 'gold' | 'silver' | 'bronze';

interface Props {
  tier: TrustTier;
  language: 'en' | 'fr';
}

const clsMap: Record<TrustTier, string> = { gold: 'tier-gold', silver: 'tier-silver', bronze: 'tier-bronze' };

const TrustBadge: React.FC<Props> = ({ tier, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const label = tier === 'gold'
    ? t('Gold', 'Or')
    : tier === 'silver'
      ? t('Silver', 'Argent')
      : t('Bronze', 'Bronze');
  return (
    <span className={`micro-label rounded-full px-2 py-0.5 text-[10px] ${clsMap[tier]}`}>{label}</span>
  );
};

export default React.memo(TrustBadge);
