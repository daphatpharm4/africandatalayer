import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'navy' | 'forest' | 'terra' | 'gold' | 'danger';
}

const colorMap: Record<string, string> = {
  navy: 'text-navy',
  forest: 'text-forest',
  terra: 'text-terra',
  gold: 'text-gold',
  danger: 'text-danger',
};

const KpiCard: React.FC<Props> = ({ label, value, subtitle, trend, color = 'navy' }) => (
  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
    <span className="micro-label text-gray-400 block">{label}</span>
    <div className="mt-1 flex items-baseline gap-1.5">
      <span className={`text-2xl font-extrabold ${colorMap[color] ?? 'text-gray-900'}`}>{value}</span>
      {trend && (
        <span className="flex items-center">
          {trend === 'up' && <TrendingUp size={14} className="text-forest" />}
          {trend === 'down' && <TrendingDown size={14} className="text-danger" />}
          {trend === 'neutral' && <Minus size={14} className="text-gray-400" />}
        </span>
      )}
    </div>
    {subtitle && <span className="text-[11px] text-gray-500 mt-0.5 block">{subtitle}</span>}
  </div>
);

export default KpiCard;
