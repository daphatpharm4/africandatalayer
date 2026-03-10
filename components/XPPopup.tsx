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
    <div className="flex flex-col h-full bg-[#f9fafb]">
      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center text-center space-y-5">
        <div className="w-20 h-20 rounded-[28px] bg-[#eaf3ee] text-[#4c7c59] flex items-center justify-center shadow-sm">
          <CheckCircle size={38} />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#4c7c59]">
            {t('Submission Captured', 'Soumission capturee')}
          </p>
          <h2 className="text-3xl font-extrabold text-gray-900" style={{ animation: 'xp-count-up 0.5s ease-out' }}>+{totalXp} XP</h2>
          <p className="text-sm text-gray-500">
            {isBatchMode
              ? t('Batch capture saved. Keep the corridor momentum.', 'Capture en lot enregistree. Continuez le rythme.')
              : t('Saved locally first, then synced when connectivity allows.', 'Sauvegarde locale d abord, puis synchronisation des que possible.')}
          </p>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="rounded-2xl bg-[#f2f6fa] p-3" style={{ animation: 'xp-slide-in 0.4s ease-out 0.1s both' }}>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                <Award size={12} />
                {t('Base', 'Base')}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">+{baseXp}</div>
            </div>
            <div className="rounded-2xl bg-[#fff8f4] p-3" style={{ animation: 'xp-slide-in 0.4s ease-out 0.2s both' }}>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#c86b4a]">
                <Zap size={12} />
                {t('Quality', 'Qualite')}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">+{qualityBonus}</div>
            </div>
            <div className="rounded-2xl bg-[#f7f4ff] p-3" style={{ animation: 'xp-slide-in 0.4s ease-out 0.3s both' }}>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#6b46c1]">
                <PlusCircle size={12} />
                {t('Streak', 'Serie')}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">+{streakBonus}</div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f9fafb] p-4 text-left">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {t('Level Progress', 'Progression')}
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#0f2b46] to-[#4c7c59]" style={{ animation: 'xp-pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {t('Strong capture quality and GPS evidence boosted this submission.', 'La qualite de capture et la preuve GPS ont augmente cette soumission.')}
            </div>
          </div>

          {syncMessage && (
            <div className="rounded-2xl border border-[#d5e1eb] bg-[#f2f6fa] p-4 text-xs text-[#0f2b46] text-left">
              {syncMessage}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-0 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="h-14 rounded-2xl bg-[#c86b4a] text-white text-xs font-bold uppercase tracking-widest shadow-sm"
        >
          {isBatchMode ? t('Capture Next', 'Capture suivante') : t('Add Another', 'Ajouter encore')}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="h-14 rounded-2xl border border-gray-200 bg-white text-xs font-bold uppercase tracking-widest text-[#0f2b46]"
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
