import React from 'react';
import { ChevronRight, Download, TrendingUp } from 'lucide-react';
import ScreenHeader from '../shared/ScreenHeader';
import VerticalIcon from '../shared/VerticalIcon';
import { VERTICALS } from '../../shared/verticals';
import type { SubmissionCategory } from '../../shared/types';

interface InsightCard {
  id: string;
  vertical: SubmissionCategory;
  label: string;
  title: string;
  subtitle: string;
}

interface Props {
  language: 'en' | 'fr';
  monthLabel: string;
  totalPoints: number;
  weeklyDelta: number;
  headline: string;
  body: string;
  insights: InsightCard[];
  onExport: () => void;
  onBack: () => void;
  onSelectInsight?: (card: InsightCard) => void;
}

const ClientInsights: React.FC<Props> = ({
  language,
  monthLabel,
  totalPoints,
  weeklyDelta,
  headline,
  body,
  insights,
  onExport,
  onBack,
  onSelectInsight,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  return (
    <div data-testid="screen-client-insights" className="screen-shell flex h-full flex-col bg-page">
      <ScreenHeader
        title={t('Insights', 'Analyses')}
        language={language}
        onBack={onBack}
        trailing={
          <span className="micro-label rounded-full bg-navy-wash px-2.5 py-0.5 text-navy">
            {monthLabel}
          </span>
        }
        routeGrid
      />
      <div className="no-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
        {/* Hero story */}
        <article className="route-grid relative overflow-hidden rounded-[20px] bg-navy p-4 text-white">
          <div className="micro-label mb-1.5 text-white/45">
            {t('Headline · This week', 'Une · Cette semaine')}
          </div>
          <h2 className="mb-1.5 text-lg font-bold leading-tight">{headline}</h2>
          <p className="text-xs leading-relaxed text-white/60">{body}</p>
          <div className="mt-3 flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-bold text-gold">
              <TrendingUp size={10} />
              +{weeklyDelta} {t('points this week', 'points cette semaine')}
            </div>
          </div>
        </article>

        {/* Story cards */}
        {insights.map((ins) => {
          const vertical = VERTICALS[ins.vertical];
          return (
            <button
              key={ins.id}
              type="button"
              onClick={() => onSelectInsight?.(ins)}
              className="card-soft motion-pressable flex w-full items-start gap-3 p-4 text-left"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: vertical?.bgColor }}
              >
                <VerticalIcon name={ins.vertical} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5">
                  <span
                    className="micro-label rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{ background: vertical?.bgColor, color: vertical?.color }}
                  >
                    {ins.label}
                  </span>
                </div>
                <div className="mb-0.5 text-[13px] font-semibold text-ink-dark">{ins.title}</div>
                <div className="text-[11px] leading-relaxed text-gray-500">{ins.subtitle}</div>
              </div>
              <ChevronRight size={14} className="shrink-0 text-gray-400" />
            </button>
          );
        })}

        {/* Export CTA */}
        <button
          type="button"
          onClick={onExport}
          className="motion-pressable flex w-full items-center gap-3 rounded-2xl bg-navy-wash p-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy">
            <Download size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-navy">
              {t("Export this week's data", 'Exporter les données de la semaine')}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {t('CSV · JSON · GeoJSON available', 'CSV · JSON · GeoJSON disponibles')}
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default ClientInsights;
