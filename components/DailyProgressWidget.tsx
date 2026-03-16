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
    <div className="card-pill p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="micro-label-wide text-gray-400">
            {t('Daily Progress', 'Progression du jour')}
          </div>
          <h4 className="mt-1 text-base font-bold text-gray-900">
            {t('Keep capture quality high', 'Maintenir une capture de qualité')}
          </h4>
        </div>
        <div className="rounded-full bg-terra-wash px-3 py-1 micro-label text-terra">
          {remaining === 0 ? t('Bonus ready', 'Bonus atteint') : `${remaining} ${t('to goal', 'avant objectif')}`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-tile bg-navy-wash">
          <div className="inline-flex items-center gap-2 micro-label text-navy">
            <MapPinned size={12} />
            {t('Submissions', 'Soumissions')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{submissionsToday}</div>
        </div>
        <div className="stat-tile bg-navy-wash">
          <div className="inline-flex items-center gap-2 micro-label text-gray-500">
            <Sparkles size={12} />
            {t('Enrichments', 'Enrichissements')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{enrichmentsToday}</div>
        </div>
        <div className="stat-tile bg-forest-wash">
          <div className="inline-flex items-center gap-2 micro-label text-forest">
            <Gauge size={12} />
            {t('Avg Quality', 'Qualité moyenne')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{averageQuality}%</div>
        </div>
        <div className="stat-tile bg-terra-wash">
          <div className="inline-flex items-center gap-2 micro-label text-terra">
            <Award size={12} />
            {t('Streak', 'Série')}
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{streakDays}</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between micro-label text-gray-400">
          <span>{t('Daily target', 'Objectif journalier')}</span>
          <span>{submissionsToday}/{dailyTarget}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-navy" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default DailyProgressWidget;
