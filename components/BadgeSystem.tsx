import React from 'react';
import {
  Award,
  CloudRain,
  Compass,
  Flame,
  Footprints,
  Moon,
  Shield,
  Star,
  Trophy,
  Building2
} from 'lucide-react';
import type { PointEvent } from '../shared/types';
import { computeContributionSummary } from '../lib/shared/contributionMetrics';

export interface Badge {
  id: string;
  labelEn: string;
  labelFr: string;
  descriptionEn: string;
  descriptionFr: string;
  icon: React.FC<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
  earned: boolean;
  progress: number;
  target: number;
}

export function computeBadges(events: PointEvent[], language: 'en' | 'fr'): Badge[] {
  const totalSubmissions = events.length;
  const uniqueCategories = new Set(events.map((e) => e.category));

  const categoryCounts: Record<string, number> = {};
  for (const event of events) {
    categoryCounts[event.category] = (categoryCounts[event.category] ?? 0) + 1;
  }
  const maxInOneVertical = Math.max(0, ...Object.values(categoryCounts));

  const qualityEvents = events.filter((e) => {
    const details = (e.details ?? {}) as Record<string, unknown>;
    return typeof details.confidenceScore === 'number' && details.confidenceScore > 90;
  });
  let consecutiveHighQuality = 0;
  let maxConsecutiveHighQuality = 0;
  for (const event of [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    const details = (event.details ?? {}) as Record<string, unknown>;
    if (typeof details.confidenceScore === 'number' && details.confidenceScore > 90) {
      consecutiveHighQuality += 1;
      maxConsecutiveHighQuality = Math.max(maxConsecutiveHighQuality, consecutiveHighQuality);
    } else {
      consecutiveHighQuality = 0;
    }
  }

  const streakDays = computeContributionSummary(events).streakDays;

  const eveningEvents = events.filter((e) => {
    const hour = new Date(e.createdAt).getHours();
    return hour >= 18 && e.category === 'alcohol_outlet';
  });

  const rainySeasonEvents = events.filter((e) => {
    const month = new Date(e.createdAt).getMonth();
    return month >= 5 && month <= 9;
  });

  return [
    {
      id: 'first_steps',
      labelEn: 'First Steps',
      labelFr: 'Premiers pas',
      descriptionEn: 'Complete your first submission',
      descriptionFr: 'Completez votre premiere soumission',
      icon: Footprints,
      color: '#4c7c59',
      bgColor: '#eaf3ee',
      earned: totalSubmissions >= 1,
      progress: Math.min(totalSubmissions, 1),
      target: 1,
    },
    {
      id: 'explorer',
      labelEn: 'Explorer',
      labelFr: 'Explorateur',
      descriptionEn: 'Submit in 3 different verticals',
      descriptionFr: 'Soumettez dans 3 verticales differentes',
      icon: Compass,
      color: '#0f2b46',
      bgColor: '#e7eef4',
      earned: uniqueCategories.size >= 3,
      progress: Math.min(uniqueCategories.size, 3),
      target: 3,
    },
    {
      id: 'specialist',
      labelEn: 'Specialist',
      labelFr: 'Specialiste',
      descriptionEn: '50 submissions in one vertical',
      descriptionFr: '50 soumissions dans une verticale',
      icon: Star,
      color: '#c86b4a',
      bgColor: '#fff8f4',
      earned: maxInOneVertical >= 50,
      progress: Math.min(maxInOneVertical, 50),
      target: 50,
    },
    {
      id: 'quality_star',
      labelEn: 'Quality Star',
      labelFr: 'Etoile qualite',
      descriptionEn: '10 consecutive high-quality submissions',
      descriptionFr: '10 soumissions haute qualite consecutives',
      icon: Award,
      color: '#d69e2e',
      bgColor: '#fefcbf',
      earned: maxConsecutiveHighQuality >= 10,
      progress: Math.min(maxConsecutiveHighQuality, 10),
      target: 10,
    },
    {
      id: 'night_owl',
      labelEn: 'Night Owl',
      labelFr: 'Oiseau de nuit',
      descriptionEn: '10 submissions after 6pm (alcohol)',
      descriptionFr: '10 soumissions apres 18h (alcool)',
      icon: Moon,
      color: '#6b46c1',
      bgColor: '#f7f4ff',
      earned: eveningEvents.length >= 10,
      progress: Math.min(eveningEvents.length, 10),
      target: 10,
    },
    {
      id: 'rain_walker',
      labelEn: 'Rain Walker',
      labelFr: 'Marcheur de pluie',
      descriptionEn: 'Submit during rainy season (Jun-Oct)',
      descriptionFr: 'Soumettez pendant la saison des pluies',
      icon: CloudRain,
      color: '#2b6cb0',
      bgColor: '#ebf4ff',
      earned: rainySeasonEvents.length >= 10,
      progress: Math.min(rainySeasonEvents.length, 10),
      target: 10,
    },
    {
      id: 'streak_master',
      labelEn: 'Streak Master',
      labelFr: 'Maitre de la serie',
      descriptionEn: '14-day consecutive streak',
      descriptionFr: 'Serie de 14 jours consecutifs',
      icon: Flame,
      color: '#c53030',
      bgColor: '#fde8e8',
      earned: streakDays >= 14,
      progress: Math.min(streakDays, 14),
      target: 14,
    },
    {
      id: 'urban_validator',
      labelEn: 'Urban Validator',
      labelFr: 'Validateur urbain',
      descriptionEn: '100 total submissions',
      descriptionFr: '100 soumissions au total',
      icon: Building2,
      color: '#4a5568',
      bgColor: '#e2e8f0',
      earned: totalSubmissions >= 100,
      progress: Math.min(totalSubmissions, 100),
      target: 100,
    },
    {
      id: 'data_champion',
      labelEn: 'Data Champion',
      labelFr: 'Champion des donnees',
      descriptionEn: '500 total submissions',
      descriptionFr: '500 soumissions au total',
      icon: Trophy,
      color: '#c86b4a',
      bgColor: '#fff8f4',
      earned: totalSubmissions >= 500,
      progress: Math.min(totalSubmissions, 500),
      target: 500,
    },
    {
      id: 'trust_elite',
      labelEn: 'Trust Elite',
      labelFr: 'Elite de confiance',
      descriptionEn: 'Maintain 95%+ quality for 4 weeks',
      descriptionFr: 'Maintenez 95%+ de qualite pendant 4 semaines',
      icon: Shield,
      color: '#4c7c59',
      bgColor: '#eaf3ee',
      earned: qualityEvents.length >= 100,
      progress: Math.min(qualityEvents.length, 100),
      target: 100,
    },
  ];
}

interface BadgeGridProps {
  badges: Badge[];
  language: 'en' | 'fr';
}

const BadgeGrid: React.FC<BadgeGridProps> = ({ badges, language }) => {
  const earnedCount = badges.filter((b) => b.earned).length;
  const nextBadge = badges.find((b) => !b.earned);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {t('Badges', 'Badges')}
          </span>
          <span className="text-sm font-bold text-gray-900">
            {earnedCount}/{badges.length} {t('earned', 'obtenus')}
          </span>
        </div>
        {nextBadge && (
          <span className="text-[10px] font-bold text-[#0f2b46] uppercase tracking-widest">
            {t('Next', 'Suivant')}: {language === 'fr' ? nextBadge.labelFr : nextBadge.labelEn}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.id}
              className="flex flex-col items-center space-y-1"
              title={language === 'fr' ? badge.descriptionFr : badge.descriptionEn}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${badge.earned ? '' : 'opacity-30 grayscale'}`}
                style={{ backgroundColor: badge.bgColor, color: badge.color }}
              >
                <Icon size={18} />
              </div>
              <span className="text-[8px] font-bold text-gray-500 text-center leading-tight truncate w-full">
                {language === 'fr' ? badge.labelFr : badge.labelEn}
              </span>
              {!badge.earned && (
                <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gray-300"
                    style={{ width: `${Math.round((badge.progress / badge.target) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgeGrid;
