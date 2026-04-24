import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type Tone = 'navy' | 'terra' | 'forest' | 'streak' | 'amber' | 'gold';

interface Props {
  label: string;
  value: string | number;
  delta?: number;
  tone?: Tone;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const toneMap: Record<Tone, { bg: string; text: string }> = {
  navy: { bg: 'bg-navy-wash', text: 'text-navy' },
  terra: { bg: 'bg-terra-wash', text: 'text-terra' },
  forest: { bg: 'bg-forest-wash', text: 'text-forest-dark' },
  streak: { bg: 'bg-streak-wash', text: 'text-streak' },
  amber: { bg: 'bg-amber-wash', text: 'text-amber' },
  gold: { bg: 'bg-gold-wash', text: 'text-amber' },
};

const KpiTile: React.FC<Props> = ({ label, value, delta, tone = 'navy', icon, onClick }) => {
  const t = toneMap[tone];
  const isPos = (delta ?? 0) >= 0;
  const display = typeof value === 'number' ? value.toLocaleString() : value;
  const className = `${t.bg} stat-tile motion-pressable w-full text-left`;
  const content = (
    <>
      {(icon || typeof delta === 'number') && (
        <div className="mb-2 flex items-center justify-between">
          {icon ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70">{icon}</div>
          ) : (
            <span />
          )}
          {typeof delta === 'number' && (
            <span className={`flex items-center gap-0.5 text-[11px] font-bold ${isPos ? 'text-forest-dark' : 'text-danger'}`}>
              {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {isPos ? '+' : ''}
              {delta}
            </span>
          )}
        </div>
      )}
      <div className={`text-[22px] font-extrabold leading-none ${t.text}`}>{display}</div>
      <div className={`micro-label-wide mt-1 ${t.text} opacity-70`}>{label}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
};

export default React.memo(KpiTile);
