import React from 'react';
import StatusBadge from './StatusBadge';

export type TrustTier = 'gold' | 'silver' | 'bronze';

interface Props {
  tier: TrustTier;
  language: 'en' | 'fr';
}

const TrustBadge: React.FC<Props> = ({ tier, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const label = tier === 'gold'
    ? t('Gold', 'Or')
    : tier === 'silver'
      ? t('Silver', 'Argent')
      : t('Bronze', 'Bronze');
  const status = tier === 'gold' ? 'verified' : tier === 'silver' ? 'idle' : 'warning';
  return <StatusBadge status={status} label={label} className="micro-label text-[10px]" />;
};

export default React.memo(TrustBadge);
