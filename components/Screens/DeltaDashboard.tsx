import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiJson, buildUrl } from '../../lib/client/api';
import ExportPanel from '../ExportPanel';
import { categoryLabel, VERTICAL_IDS } from '../../shared/verticals';
import type { TrendDataPoint, AnomalyFlag } from '../../shared/types';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

interface StatsRow {
  id: string;
  snapshot_date: string;
  vertical_id: string;
  total_points: number;
  completed_points: number;
  completion_rate: number;
  new_count: number;
  removed_count: number;
  changed_count: number;
  unchanged_count: number;
  avg_price: number | null;
  week_over_week_growth: number | null;
  moving_avg_4w: number | null;
  anomaly_flags: AnomalyFlag[];
}

interface DeltaRow {
  id: string;
  snapshot_date: string;
  vertical_id: string;
  point_id: string;
  delta_type: string;
  delta_field: string | null;
  delta_summary: string | null;
  delta_magnitude: number | null;
  delta_direction: string | null;
  significance?: string;
  is_publishable?: boolean;
  is_from_partial_snapshot?: boolean;
}

interface AnomalyRow {
  snapshot_date: string;
  vertical_id: string;
  total_points: number;
  anomaly_flags: AnomalyFlag[];
}

const DeltaDashboard: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'geojson' | 'pdf'>('csv');
  const [stats, setStats] = useState<StatsRow[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [recentDeltas, setRecentDeltas] = useState<DeltaRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load stats and anomalies on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [statsData, anomalyData] = await Promise.all([
          apiJson<StatsRow[]>('/api/analytics?view=snapshots&limit=52'),
          apiJson<AnomalyRow[]>('/api/analytics?view=anomalies'),
        ]);
        setStats(Array.isArray(statsData) ? statsData : []);
        setAnomalies(Array.isArray(anomalyData) ? anomalyData : []);
      } catch {
        setStats([]);
        setAnomalies([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Load trends and deltas when vertical changes
  useEffect(() => {
    const loadVerticalData = async () => {
      if (selectedVertical === 'all') {
        setTrendData([]);
        setRecentDeltas([]);
        return;
      }
      try {
        const [trend, deltasResp] = await Promise.all([
          apiJson<{ data: TrendDataPoint[] }>(`/api/analytics?view=trends&vertical=${selectedVertical}&metric=total_points&weeks=12`),
          apiJson<{ deltas: DeltaRow[] }>(`/api/analytics?view=deltas&vertical=${selectedVertical}&publishable=true&limit=20`),
        ]);
        setTrendData(Array.isArray(trend?.data) ? trend.data : []);
        setRecentDeltas(Array.isArray(deltasResp?.deltas) ? deltasResp.deltas : []);
      } catch {
        setTrendData([]);
        setRecentDeltas([]);
      }
    };
    void loadVerticalData();
  }, [selectedVertical]);

  // Derived data
  const filteredStats = selectedVertical === 'all'
    ? stats
    : stats.filter((s) => s.vertical_id === selectedVertical);
  const activeVerticalSet = useMemo(() => new Set(stats.map((s) => s.vertical_id)), [stats]);
  const filteredAnomalies = selectedVertical === 'all'
    ? anomalies
    : anomalies.filter((entry) => entry.vertical_id === selectedVertical);
  const hasSelectedVerticalData = selectedVertical === 'all' || activeVerticalSet.has(selectedVertical);

  const latestStats = filteredStats.length > 0 ? filteredStats[0] : null;
  const selectedVerticalLabel = selectedVertical === 'all' ? t('All Verticals', 'Toutes les verticales') : categoryLabel(selectedVertical, language);

  const latestDate = stats.length > 0 ? stats[0].snapshot_date : null;

  // Aggregate summary for "all" view
  const summaryTotalPoints = selectedVertical === 'all'
    ? stats.filter((s) => s.snapshot_date === latestDate).reduce((sum, s) => sum + s.total_points, 0)
    : latestStats?.total_points ?? 0;

  const summaryWoW = latestStats?.week_over_week_growth ?? null;
  const summaryCompletion = latestStats?.completion_rate ?? 0;

  // Delta breakdown for stacked bar chart
  const deltaBreakdown = (() => {
    if (selectedVertical === 'all') {
      // Aggregate per date
      const byDate = new Map<string, { date: string; new: number; removed: number; changed: number; unchanged: number }>();
      for (const s of stats) {
        const existing = byDate.get(s.snapshot_date) ?? { date: s.snapshot_date, new: 0, removed: 0, changed: 0, unchanged: 0 };
        existing.new += s.new_count;
        existing.removed += s.removed_count;
        existing.changed += s.changed_count;
        existing.unchanged += s.unchanged_count;
        byDate.set(s.snapshot_date, existing);
      }
      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
    }
    return filteredStats
      .map((s) => ({
        date: s.snapshot_date,
        new: s.new_count,
        removed: s.removed_count,
        changed: s.changed_count,
        unchanged: s.unchanged_count,
      }))
      .reverse()
      .slice(-12);
  })();

  // Price trend (fuel only)
  const showPriceTrend = selectedVertical === 'fuel_station';
  const priceTrend = showPriceTrend
    ? filteredStats
        .filter((s) => s.avg_price !== null)
        .map((s) => ({ date: s.snapshot_date, price: s.avg_price! }))
        .reverse()
        .slice(-12)
    : [];

  const latestUpdatedLabel = useMemo(() => {
    if (!latestDate) return t('No snapshots yet', 'Aucun snapshot');
    return new Date(latestDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [language, latestDate]);

  const apiPreview = useMemo(() => {
    const params = new URLSearchParams({ view: 'deltas', publishable: 'true', limit: '20' });
    if (selectedVertical !== 'all') params.set('vertical', selectedVertical);
    return buildUrl(`/api/analytics?${params.toString()}`);
  }, [selectedVertical]);

  const exportRows = useMemo(() => {
    if (selectedVertical === 'all') {
      return stats
        .filter((row) => row.snapshot_date === latestDate)
        .map((row) => ({
          snapshot_date: row.snapshot_date,
          vertical_id: row.vertical_id,
          total_points: row.total_points,
          completion_rate: row.completion_rate,
          new_count: row.new_count,
          removed_count: row.removed_count,
          changed_count: row.changed_count,
          anomalies: row.anomaly_flags.length,
        }));
    }
    return recentDeltas.map((row) => ({
      snapshot_date: row.snapshot_date,
      vertical_id: row.vertical_id,
      point_id: row.point_id,
      delta_type: row.delta_type,
      delta_field: row.delta_field ?? '',
      delta_summary: row.delta_summary ?? '',
      significance: row.significance ?? '',
    }));
  }, [latestDate, recentDeltas, selectedVertical, stats]);
  const canExport = exportRows.length > 0;
  const exportDisabledReason = !canExport
    ? selectedVertical === 'all'
      ? t('No snapshot data is available to export yet.', 'Aucune donnee snapshot n est encore disponible pour l export.')
      : t('This vertical is supported, but it has no snapshot history to export yet.', 'Cette verticale est prise en charge, mais elle n a pas encore d historique snapshot a exporter.')
    : null;

  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (exportRows.length === 0) return;
    const headers = Object.keys(exportRows[0]);
    const rows = exportRows.map((row) => headers.map((header) => JSON.stringify(row[header as keyof typeof row] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadBlob(`adl-${selectedVertical}-delta.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  };

  const exportGeoJson = () => {
    const featureCollection = {
      type: 'FeatureCollection',
      features: exportRows.map((row) => ({
        type: 'Feature',
        geometry: null,
        properties: row,
      })),
    };
    downloadBlob(
      `adl-${selectedVertical}-delta.geojson`,
      new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' }),
    );
  };

  const handleExport = (format: 'csv' | 'geojson' | 'pdf') => {
    if (!canExport) return;
    if (format === 'csv') {
      exportCsv();
      return;
    }
    if (format === 'geojson') {
      exportGeoJson();
      return;
    }
    window.print();
  };

  const handleCopyApi = async () => {
    try {
      await navigator.clipboard.writeText(apiPreview);
    } catch {
      // Ignore clipboard failures; the preview is still visible.
    }
  };

  const deltaTypeColor = (type: string) => {
    switch (type) {
      case 'new': return 'text-green-600 bg-green-50';
      case 'removed': return 'text-red-600 bg-red-50';
      case 'changed': return 'text-amber-600 bg-amber-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const deltaTypeLabel = (type: string) => {
    switch (type) {
      case 'new': return t('NEW', 'NOUVEAU');
      case 'removed': return t('REMOVED', 'SUPPRIME');
      case 'changed': return t('CHANGED', 'MODIFIE');
      default: return t('UNCHANGED', 'INCHANGE');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">{t('Delta Intelligence', 'Intelligence Delta')}</h3>
        <button
          type="button"
          onClick={() => handleExport(selectedFormat)}
          className="absolute right-2 p-2 text-[#0f2b46]"
          aria-label={t('Export current view', 'Exporter la vue')}
        >
          <Download size={18} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-[32px] bg-gradient-to-br from-[#0f2b46] via-[#1d4565] to-[#345d7d] text-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                {t('Client Dashboard', 'Tableau client')}
              </div>
              <h2 className="mt-2 text-2xl font-extrabold">
                {selectedVertical === 'all'
                  ? t('What changed across the monitored network', 'Ce qui a change sur le reseau suivi')
                  : `${t('Change story for', 'Recit de changement pour')} ${selectedVerticalLabel}`}
              </h2>
              <p className="mt-2 text-sm text-white/80">
                {t('Exports inherit the exact current filter state.', 'Les exports reprennent exactement l etat courant des filtres.')}
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">{t('Latest Snapshot', 'Dernier snapshot')}</div>
              <div className="mt-1 text-lg font-bold">{latestUpdatedLabel}</div>
            </div>
          </div>
        </div>

        {/* Anomaly Banner */}
        {filteredAnomalies.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-700">
                {filteredAnomalies.length} {t('Anomalies Detected', 'Anomalies detectees')}
              </p>
              <div className="mt-1 space-y-1">
                {filteredAnomalies.slice(0, 3).map((a, i) => (
                  <p key={i} className="text-[10px] text-red-600">
                    {categoryLabel(a.vertical_id, language)}: {a.anomaly_flags.map((f) => `${f.metric} z=${f.zScore}`).join(', ')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">{t('Points', 'Points')}</span>
            <span className="text-lg font-bold text-gray-900">{summaryTotalPoints}</span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">{t('WoW', 'WoW')}</span>
            <div className="flex items-center justify-center space-x-0.5">
              {summaryWoW !== null ? (
                <>
                  {summaryWoW > 0 ? <TrendingUp size={12} className="text-green-500" /> : summaryWoW < 0 ? <TrendingDown size={12} className="text-red-500" /> : <Minus size={12} className="text-gray-400" />}
                  <span className={`text-sm font-bold ${summaryWoW > 0 ? 'text-green-600' : summaryWoW < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {summaryWoW > 0 ? '+' : ''}{summaryWoW}%
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-400">--</span>
              )}
            </div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">{t('Complete', 'Complet')}</span>
            <span className="text-sm font-bold text-gray-900">{summaryCompletion}%</span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">{t('Alerts', 'Alertes')}</span>
            <span className={`text-sm font-bold ${filteredAnomalies.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{filteredAnomalies.length}</span>
          </div>
        </div>

        {/* Vertical Tabs */}
        <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1">
          <button
            onClick={() => setSelectedVertical('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
              selectedVertical === 'all' ? 'bg-[#0f2b46] text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t('All', 'Tout')}
          </button>
          {VERTICAL_IDS.map((vid) => (
            <button
              key={vid}
              onClick={() => setSelectedVertical(vid)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
                selectedVertical === vid ? 'bg-[#0f2b46] text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {categoryLabel(vid, language)}
            </button>
          ))}
        </div>

        <ExportPanel
          language={language}
          apiPreview={apiPreview}
          selectedFormat={selectedFormat}
          canExport={canExport}
          exportDisabledReason={exportDisabledReason}
          onSelectFormat={setSelectedFormat}
          onExport={handleExport}
          onCopyApi={handleCopyApi}
        />

        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {t('Loading snapshot data...', 'Chargement des donnees...')}
            </p>
          </div>
        ) : stats.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center space-y-2">
            <p className="text-xs font-bold text-gray-600">
              {t('No snapshot data yet', 'Pas encore de donnees')}
            </p>
            <p className="text-[10px] text-gray-400">
              {t('Snapshots are taken weekly. Check back after the first run.', 'Les snapshots sont pris chaque semaine.')}
            </p>
          </div>
        ) : !hasSelectedVerticalData ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center space-y-3">
            <p className="text-xs font-bold text-gray-700">
              {selectedVerticalLabel}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {t('No snapshot history for this vertical yet', 'Pas encore d historique snapshot pour cette verticale')}
            </p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">
              {t(
                'This vertical is available in ADL, but no weekly snapshot rows have been generated for it yet. Once coverage starts, charts and exports will appear here.',
                'Cette verticale est disponible dans ADL, mais aucune ligne de snapshot hebdomadaire n a encore ete generee pour elle. Des que la couverture demarre, les graphiques et exports apparaitront ici.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Point Count Trend */}
            {selectedVertical !== 'all' && trendData.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                  {t('Point Count Trend', 'Tendance des points')}
                </span>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={35} />
                      <Tooltip labelFormatter={(d: string) => d} />
                      <Line type="monotone" dataKey="value" stroke="#0f2b46" strokeWidth={2} dot={{ r: 3 }} name={t('Actual', 'Reel')} />
                      <Line type="monotone" dataKey="movingAvg" stroke="#4c7c59" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name={t('4w Avg', 'Moy. 4s')} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Delta Breakdown */}
            {deltaBreakdown.length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                  {t('Delta Breakdown', 'Repartition des deltas')}
                </span>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deltaBreakdown} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={35} />
                      <Tooltip />
                      <Bar dataKey="new" stackId="delta" fill="#22c55e" name={t('New', 'Nouveau')} />
                      <Bar dataKey="removed" stackId="delta" fill="#ef4444" name={t('Removed', 'Supprime')} />
                      <Bar dataKey="changed" stackId="delta" fill="#eab308" name={t('Changed', 'Modifie')} />
                      <Bar dataKey="unchanged" stackId="delta" fill="#d1d5db" name={t('Unchanged', 'Inchange')} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Price Trend (fuel only) */}
            {showPriceTrend && priceTrend.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                  {t('Average Fuel Price', 'Prix moyen du carburant')}
                </span>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceTrend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={45} />
                      <Tooltip labelFormatter={(d: string) => d} formatter={(v: number) => [`${v} XAF`, t('Price', 'Prix')]} />
                      <Line type="monotone" dataKey="price" stroke="#c86b4a" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent Deltas */}
            {selectedVertical !== 'all' && recentDeltas.length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                  {t('Recent Changes', 'Changements recents')}
                </span>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentDeltas.filter((d) => d.delta_type !== 'unchanged').slice(0, 15).map((delta) => (
                    <div key={delta.id} className="flex items-start space-x-2 p-2 bg-[#f9fafb] rounded-xl">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${deltaTypeColor(delta.delta_type)}`}>
                        {deltaTypeLabel(delta.delta_type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-700 truncate">
                          {delta.delta_summary ?? `${delta.point_id.slice(0, 8)}...`}
                        </p>
                        {delta.delta_magnitude !== null && (
                          <p className="text-[10px] text-gray-400">
                            {delta.delta_direction === 'increase' ? '+' : ''}{delta.delta_magnitude}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="h-24" />
      </div>
    </div>
  );
};

export default DeltaDashboard;
