import React from 'react';
import { Award, CheckCircle, ChevronRight, Map, Sparkles, Zap } from 'lucide-react';
import { getEnrichFieldLabel } from '../shared/enrichFieldCatalog';

interface RewardBreakdown {
  baseXp: number;
  fieldBonus: number;
  comboBonus: number;
  verificationBonus: number;
  thresholdBonus: number;
  totalXp: number;
}

interface QuickEnrichPrompt {
  completionPercent: number;
  currentScore: number;
  projectedScore: number;
  missingFields: string[];
  totalMissing: number;
}

interface Props {
  language: 'en' | 'fr';
  xpBreakdown: RewardBreakdown;
  syncMessage?: string;
  isBatchMode?: boolean;
  quickEnrichPrompt?: QuickEnrichPrompt;
  onPrimary: () => void;
  onSecondary: () => void;
  onTertiary?: () => void;
}

const XPPopup: React.FC<Props> = ({
  language,
  xpBreakdown,
  syncMessage,
  isBatchMode,
  quickEnrichPrompt,
  onPrimary,
  onSecondary,
  onTertiary,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const rewardItems = [
    {
      id: 'base',
      label: t('Base', 'Base'),
      value: xpBreakdown.baseXp,
      icon: <Award size={12} />,
      tileClass: 'bg-navy-wash text-navy',
    },
    {
      id: 'fields',
      label: t('Fields', 'Champs'),
      value: xpBreakdown.fieldBonus,
      icon: <Sparkles size={12} />,
      tileClass: 'bg-terra-wash text-terra',
    },
    {
      id: 'combo',
      label: t('Combo', 'Combo'),
      value: xpBreakdown.comboBonus,
      icon: <Zap size={12} />,
      tileClass: 'bg-streak-wash text-streak',
    },
    {
      id: 'boost',
      label: t('Boost', 'Boost'),
      value: xpBreakdown.verificationBonus + xpBreakdown.thresholdBonus,
      icon: <CheckCircle size={12} />,
      tileClass: 'bg-forest-wash text-forest',
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-forest-wash text-forest flex items-center justify-center">
          <CheckCircle size={30} />
        </div>

        <div className="space-y-2">
          <p className="micro-label-wide text-forest">
            {quickEnrichPrompt ? t('Point Created', 'Point créé') : t('Data Captured!', 'Données capturées !')}
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900" style={{ animation: 'xp-count-up 0.5s ease-out' }}>
            +{xpBreakdown.totalXp} XP
          </h2>
          <p className="text-sm text-gray-500">
            {quickEnrichPrompt
              ? t('Finish it now to turn this into a trusted point.', 'Finalisez-le maintenant pour en faire un point fiable.')
              : isBatchMode
                ? t('Saved! Keep going, you\'re on a roll.', 'Sauvegardé ! Continuez, vous êtes lancé.')
                : t('Saved! Will upload automatically when you have internet.', 'Sauvegardé ! Sera envoyé automatiquement avec internet.')}
          </p>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          {rewardItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 text-left">
              {rewardItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`stat-tile ${item.tileClass}`}
                  style={{ animation: `xp-slide-in 0.4s ease-out ${0.1 + index * 0.1}s both` }}
                >
                  <div className="inline-flex items-center gap-1 micro-label">
                    {item.icon}
                    {item.label}
                  </div>
                  <div className="mt-2 text-lg font-bold text-gray-900">+{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {quickEnrichPrompt && (
            <div className="rounded-3xl border border-terra-wash bg-terra-wash/60 p-4 text-left space-y-3">
              <div className="flex items-center gap-4">
                <div
                  className="relative h-16 w-16 rounded-full"
                  style={{
                    background: `conic-gradient(#c86b4a ${quickEnrichPrompt.completionPercent * 3.6}deg, #f1f5f9 0deg)`,
                  }}
                >
                  <div className="absolute inset-[6px] rounded-full bg-white flex items-center justify-center">
                    <span className="text-sm font-bold text-terra-dark">{quickEnrichPrompt.completionPercent}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-bold text-gray-900">
                    {quickEnrichPrompt.totalMissing > 1
                      ? t(`${quickEnrichPrompt.totalMissing} details missing`, `${quickEnrichPrompt.totalMissing} détails manquants`)
                      : t('1 detail missing', '1 détail manquant')}
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-2">
                    <span>{t('Trust', 'Confiance')} {quickEnrichPrompt.currentScore}%</span>
                    <ChevronRight size={12} />
                    <span>{quickEnrichPrompt.projectedScore}% {t('if completed', 'si complété')}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickEnrichPrompt.missingFields.map((field) => (
                  <span key={field} className="micro-label rounded-full border border-white bg-white px-3 py-2 text-terra-dark">
                    {getEnrichFieldLabel(field, language)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {syncMessage && (
            <div className="rounded-2xl border border-navy-border bg-navy-wash p-4 text-xs text-navy text-left">
              {syncMessage}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onPrimary} className="btn-cta">
            {quickEnrichPrompt
              ? t('Complete This Point', 'Compléter ce point')
              : isBatchMode
                ? t('Capture Next', 'Capture suivante')
                : t('Add Another', 'Ajouter encore')}
          </button>
          <button type="button" onClick={onSecondary} className="btn-ghost">
            <span className="inline-flex items-center gap-2">
              <Map size={14} />
              {quickEnrichPrompt
                ? t('Add Another', 'Ajouter encore')
                : isBatchMode
                  ? t('End Batch', 'Fin du lot')
                  : t('Back to Map', 'Retour carte')}
            </span>
          </button>
        </div>
        {quickEnrichPrompt && onTertiary && (
          <button type="button" onClick={onTertiary} className="w-full text-center micro-label text-gray-500">
            {t('Later', 'Plus tard')}
          </button>
        )}
      </div>
    </div>
  );
};

export default XPPopup;
