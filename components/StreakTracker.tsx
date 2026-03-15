import React from 'react';
import { Flame } from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  streakDays: number;
  activeDays: boolean[];
}

const DAY_LABELS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const StreakTracker: React.FC<Props> = ({ language, streakDays, activeDays }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const DAY_LABELS = language === 'fr' ? DAY_LABELS_FR : DAY_LABELS_EN;

  return (
    <div className="card-pill p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="micro-label-wide text-gray-400">
            {t('Streak Tracker', 'Suivi de série')}
          </div>
          <h4 className="mt-1 text-base font-bold text-gray-900">
            {t('Show up again tomorrow', 'Revenez encore demain')}
          </h4>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-terra-wash px-3 py-1 text-terra">
          <Flame size={14} />
          <span className="text-sm font-bold">{streakDays} {t('days', 'jours')}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label, index) => {
          const active = activeDays[index] === true;
          return (
            <div key={`${label}-${index}`} className="text-center">
              <div className="micro-label text-gray-400">{label}</div>
              <div
                className={`mt-2 h-10 rounded-2xl flex items-center justify-center micro-label ${
                  active ? 'bg-terra text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {active ? t('Hit', 'Actif') : '...'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StreakTracker;
