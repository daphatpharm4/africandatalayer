import React from 'react';
import StatusBadge from './StatusBadge';

export type RiskLevel = 'low' | 'medium' | 'high';

interface Props {
  level: RiskLevel;
  language: 'en' | 'fr';
}

const RiskBadge: React.FC<Props> = ({ level, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const label = level === 'low'
    ? t('Low risk', 'Faible risque')
    : level === 'medium'
      ? t('Medium risk', 'Risque moyen')
      : t('High risk', 'Risque élevé');
  const status = level === 'low' ? 'verified' : level === 'medium' ? 'warning' : 'flagged';
  return <StatusBadge status={status} label={label} className="micro-label text-[10px]" />;
};

export default React.memo(RiskBadge);
