import React from 'react';
import { Award, Gauge, MapPinned, Sparkles } from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  submissionsToday: number;
  enrichmentsToday: number;
  averageQuality: number;
  streakDays: number;
  dailyTarget: number;
}

const DailyProgressWidget: React.FC<Props> = ({
  language,
  submissionsToday,
  enrichmentsToday,
  averageQuality,
  streakDays,
  dailyTarget,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const remaining = Math.max(0, dailyTarget - submissionsToday);
  const progress = dailyTarget > 0 ? Math.min(100, Math.round((submissionsToday / dailyTarget) * 100)) : 0;

  return (
    <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
            {t('Daily Progress', 'Progression du jour')}
          </div>
          <h4 className="mt-1 text-base font-bold text-gray-900">
            {t('Keep capture quality high', 'Maintenir une capture de qualite')}
          </h4>
        </div>
        <div className="rounded-full bg-[#fff8f4] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#c86b4a]">
          {remaining === 0 ? t('Bonus ready', 'Bonus atteint') : `${remaining} ${t('to goal', 'avant objectif')}`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#f2f6fa] p-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
            <MapPinned size={12} />
            {t('Submissions', 'Soumissions')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{submissionsToday}</div>
        </div>
        <div className="rounded-2xl bg-[#f7f8fa] p-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <Sparkles size={12} />
            {t('Enrichments', 'Enrichissements')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{enrichmentsToday}</div>
        </div>
        <div className="rounded-2xl bg-[#eaf3ee] p-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#4c7c59]">
            <Gauge size={12} />
            {t('Avg Quality', 'Qualite moyenne')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{averageQuality}%</div>
        </div>
        <div className="rounded-2xl bg-[#fff8f4] p-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#c86b4a]">
            <Award size={12} />
            {t('Streak', 'Serie')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{streakDays}</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span>{t('Daily target', 'Objectif journalier')}</span>
          <span>{submissionsToday}/{dailyTarget}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0f2b46] to-[#4c7c59]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default DailyProgressWidget;
