import React from 'react';
import { Award, CheckCircle, Map, PlusCircle, Zap } from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  totalXp: number;
  baseXp: number;
  qualityBonus: number;
  streakBonus: number;
  syncMessage?: string;
  isBatchMode?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}

const XPPopup: React.FC<Props> = ({
  language,
  totalXp,
  baseXp,
  qualityBonus,
  streakBonus,
  syncMessage,
  isBatchMode,
  onPrimary,
  onSecondary,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  return (
    <div className="flex flex-col h-full bg-page">
      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-forest-wash text-forest flex items-center justify-center">
          <CheckCircle size={30} />
        </div>

        <div className="space-y-2">
          <p className="micro-label-wide text-forest">
            {t('Data Captured!', 'Données capturées !')}
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900" style={{ animation: 'xp-count-up 0.5s ease-out' }}>+{totalXp} XP</h2>
          <p className="text-sm text-gray-500">
            {isBatchMode
              ? t('Saved! Keep going, you\'re on a roll.', 'Sauvegardé ! Continuez, vous êtes lancé.')
              : t('Saved! Will upload automatically when you have internet.', 'Sauvegardé ! Sera envoyé automatiquement avec internet.')}
          </p>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="stat-tile bg-navy-wash" style={{ animation: 'xp-slide-in 0.4s ease-out 0.1s both' }}>
              <div className="inline-flex items-center gap-1 micro-label text-navy">
                <Award size={12} />
                {t('Base', 'Base')}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">+{baseXp}</div>
            </div>
            <div className="stat-tile bg-terra-wash" style={{ animation: 'xp-slide-in 0.4s ease-out 0.2s both' }}>
              <div className="inline-flex items-center gap-1 micro-label text-terra">
                <Zap size={12} />
                {t('Quality', 'Qualite')}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">+{qualityBonus}</div>
            </div>
            <div className="stat-tile bg-streak-wash" style={{ animation: 'xp-slide-in 0.4s ease-out 0.3s both' }}>
              <div className="inline-flex items-center gap-1 micro-label text-streak">
                <PlusCircle size={12} />
                {t('Streak', 'Serie')}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">+{streakBonus}</div>
            </div>
          </div>

          {syncMessage && (
            <div className="rounded-2xl border border-navy-border bg-navy-wash p-4 text-xs text-navy text-left">
              {syncMessage}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-0 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="btn-cta"
        >
          {isBatchMode ? t('Capture Next', 'Capture suivante') : t('Add Another', 'Ajouter encore')}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="btn-ghost"
        >
          <span className="inline-flex items-center gap-2">
            <Map size={14} />
            {isBatchMode ? t('End Batch', 'Fin du lot') : t('Back to Map', 'Retour carte')}
          </span>
        </button>
      </div>
    </div>
  );
};

export default XPPopup;
