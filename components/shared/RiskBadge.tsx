import React from 'react';

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
  const cls = level === 'low' ? 'risk-low' : level === 'medium' ? 'risk-medium' : 'risk-high';
  return (
    <span className={`micro-label rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
  );
};

export default React.memo(RiskBadge);
