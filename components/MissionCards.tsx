import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronUp } from 'lucide-react';
import type { SnapPoint } from './shared/BottomSheet';
import type { CollectionAssignment } from '../shared/types';
import { categoryLabel as getCategoryLabel } from '../shared/verticals';

export interface MissionCard {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  meta: string;
  tone: string;
  action: () => void;
  xpReward?: string;
}

interface MissionCardsProps {
  cards: MissionCard[];
  sheetSnap: SnapPoint;
  activeAssignment?: CollectionAssignment | null;
  showAgentWidgets?: boolean;
  language?: 'en' | 'fr';
}

const MissionCards: React.FC<MissionCardsProps> = ({
  cards,
  sheetSnap,
  activeAssignment,
  showAgentWidgets = false,
  language = 'en',
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const primaryCard = cards[0];

  if (sheetSnap === 'peek') {
    if (!primaryCard) return null;
    const Icon = primaryCard.icon;

    return (
      <button
        type="button"
        onClick={primaryCard.action}
        data-testid="mission-peek-primary"
        className="motion-pressable route-grid w-full cursor-pointer rounded-2xl bg-navy p-3.5 text-left text-white shadow-[0_10px_28px_rgba(15,43,70,0.24)]"
      >
        <div className="flex min-h-[76px] items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/18 text-white">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="micro-label mb-1 text-white/85">
              {primaryCard.label}
            </div>
            <div className="truncate text-sm font-bold leading-tight text-white">
              {primaryCard.title}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[11px] font-medium leading-4 text-white/82">
              {primaryCard.meta}
            </div>
            {primaryCard.xpReward && (
              <div className="mt-1.5">
                <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-navy">
                  {primaryCard.xpReward}
                </span>
              </div>
            )}
          </div>
          <ChevronUp size={16} className="shrink-0 text-white/70" />
        </div>
      </button>
    );
  }

  // Half/Full mode — vertical card stack
  return (
    <div className="space-y-3">
      {/* Active assignment card */}
      {showAgentWidgets && activeAssignment && (
        <div className="mission-card surface-reveal rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="micro-label-wide text-gray-400">
                {t('Active Assignment', 'Affectation active')}
              </div>
              <h4 className="mt-1 text-base font-bold text-gray-900">{activeAssignment.zoneLabel}</h4>
              <p className="mt-1 text-xs text-gray-500">
                {activeAssignment.assignedVerticals.map((v) => getCategoryLabel(v, language)).join(', ')}
              </p>
            </div>
            <div className="rounded-full bg-navy-wash px-3 py-1 micro-label text-navy">
              {activeAssignment.status}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between micro-label text-gray-400">
              <span>{t('Progress', 'Progression')}</span>
              <span>{activeAssignment.pointsSubmitted}/{activeAssignment.pointsExpected}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden shimmer-line">
              <div className="h-full rounded-full bg-navy" style={{ width: `${Math.min(100, activeAssignment.completionRate)}%` }} />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t('Due', 'Echeance')}: {activeAssignment.dueDate}
          </div>
        </div>
      )}

      {/* Mission cards — vertical stack */}
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={card.action}
            className={`motion-pressable mission-card w-full rounded-2xl px-5 py-4 text-left border-l-[4px] ${card.tone} ${
              card.id === 'primary' ? 'border-l-gold' : card.id === 'nearby' ? 'border-l-terra' : 'border-l-forest'
            }`}
            style={{
              animationDelay: `${90 + index * 60}ms`,
              boxShadow: '0 4px 20px rgba(15,43,70,0.15), 0 1px 4px rgba(15,43,70,0.1)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`micro-label-wide ${
                      card.tone.includes('text-white')
                        ? 'text-white/75'
                        : card.tone.includes('forest')
                          ? 'text-forest/70'
                          : card.tone.includes('terra')
                            ? 'text-terra/70'
                            : 'text-navy/60'
                    }`}
                  >
                    {card.label}
                  </div>
                  {card.xpReward && (
                    <span className="micro-label rounded-full bg-gold px-2 py-0.5 text-navy font-bold">
                      {card.xpReward}
                    </span>
                  )}
                </div>
                <div
                  className={`mt-2 text-[15px] font-bold leading-snug ${
                    card.tone.includes('text-white') ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {card.title}
                </div>
                <div
                  className={`mt-1.5 text-xs leading-relaxed ${
                    card.tone.includes('text-white') ? 'text-white/80' : 'text-gray-600'
                  }`}
                >
                  {card.meta}
                </div>
              </div>
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  card.tone.includes('text-white')
                    ? 'bg-white/15 text-white'
                    : card.tone.includes('forest')
                      ? 'bg-forest/10 text-forest'
                      : card.tone.includes('terra')
                        ? 'bg-terra/10 text-terra'
                        : 'bg-navy/10 text-navy'
                }`}
              >
                <Icon size={20} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default MissionCards;
