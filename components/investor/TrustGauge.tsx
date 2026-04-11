import React from 'react';

interface Props {
  value: number;
  label: string;
  thresholds?: { green: number; yellow: number };
  unit?: string;
  invertColor?: boolean;
}

const TrustGauge: React.FC<Props> = ({
  value,
  label,
  thresholds = { green: 7, yellow: 14 },
  unit = 'days',
  invertColor = false,
}) => {
  const isGreen = invertColor ? value > thresholds.yellow : value <= thresholds.green;
  const isYellow = invertColor
    ? value > thresholds.green && value <= thresholds.yellow
    : value > thresholds.green && value <= thresholds.yellow;

  const bgColor = isGreen ? 'bg-forest-wash' : isYellow ? 'bg-gold-wash' : 'bg-red-50';
  const textColor = isGreen ? 'text-forest' : isYellow ? 'text-gold' : 'text-danger';
  const barColor = isGreen ? 'bg-forest' : isYellow ? 'bg-gold' : 'bg-danger';

  const maxForBar = thresholds.yellow * 2;
  const pct = Math.min(100, Math.max(5, (value / maxForBar) * 100));

  return (
    <div className={`rounded-2xl ${bgColor} p-4`}>
      <span className="micro-label text-gray-500 block">{label}</span>
      <div className={`mt-1 text-xl font-extrabold ${textColor}`}>
        {value} <span className="text-xs font-bold">{unit}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/60 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default TrustGauge;
