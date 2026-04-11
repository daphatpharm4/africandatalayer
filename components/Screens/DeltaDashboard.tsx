import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Minus, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { MapContainer, Popup, Rectangle, TileLayer, useMap } from 'react-leaflet';
import ScreenHeader from '../shared/ScreenHeader';
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
import { BONAMOUSSADI_CENTER, bonamoussadiLeafletBounds } from '../../shared/geofence';
import type {
  TrendDataPoint,
  AnomalyFlag,
  SpatialIntelligenceCell,
  SpatialIntelligenceResponse,
  SpatialIntelligenceSort,
} from '../../shared/types';
import { decodeGeohashBounds } from '../../lib/shared/pointId';

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

const SPATIAL_SORT_OPTIONS: Array<{
  id: SpatialIntelligenceSort;
  label: { en: string; fr: string };
}> = [
  { id: 'opportunity_score', label: { en: 'Opportunity', fr: 'Opportunité' } },
  { id: 'coverage_gap_score', label: { en: 'Coverage Gap', fr: 'Manque de couverture' } },
  { id: 'change_signal_score', label: { en: 'Change Signal', fr: 'Signal de changement' } },
];

const BONAMOUSSADI_MAP_BOUNDS = bonamoussadiLeafletBounds();

const scoreValueForCell = (sort: SpatialIntelligenceSort, cell: SpatialIntelligenceCell) => {
  if (sort === 'coverage_gap_score') return cell.coverageGapScore;
  if (sort === 'change_signal_score') return cell.changeSignalScore;
  return cell.opportunityScore;
};

const scoreFillColor = (sort: SpatialIntelligenceSort, cell: SpatialIntelligenceCell) => {
  const score = scoreValueForCell(sort, cell);
  if (sort === 'coverage_gap_score') {
    if (score >= 75) return '#c86b4a';
    if (score >= 50) return '#e4a62a';
    return '#0f2b46';
  }
  if (score >= 75) return '#0f2b46';
  if (score >= 50) return '#2f855a';
  return '#c86b4a';
};

const SpatialMapViewport: React.FC<{ bounds: [[number, number], [number, number]] }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [18, 18], animate: false });
  }, [bounds, map]);

  return null;
};

const DeltaDashboard: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'geojson' | 'pdf'>('csv');
  const [selectedSpatialSort, setSelectedSpatialSort] = useState<SpatialIntelligenceSort>('opportunity_score');
  const [stats, setStats] = useState<StatsRow[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [recentDeltas, setRecentDeltas] = useState<DeltaRow[]>([]);
  const [spatialData, setSpatialData] = useState<SpatialIntelligenceResponse | null>(null);
  const [spatialLoading, setSpatialLoading] = useState(false);
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);
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
        setSpatialData(null);
        setSpatialLoading(false);
        setFocusedCellId(null);
        return;
      }
      try {
        setSpatialLoading(true);
        const [trend, deltasResp, spatialResp] = await Promise.all([
          apiJson<{ data: TrendDataPoint[] }>(`/api/analytics?view=trends&vertical=${selectedVertical}&metric=total_points&weeks=12`),
          apiJson<{ deltas: DeltaRow[] }>(`/api/analytics?view=deltas&vertical=${selectedVertical}&publishable=true&limit=20`),
          apiJson<SpatialIntelligenceResponse>(
            `/api/analytics?view=spatial_intelligence&vertical=${selectedVertical}&sort=${selectedSpatialSort}&limit=8`,
          ),
        ]);
        setTrendData(Array.isArray(trend?.data) ? trend.data : []);
        setRecentDeltas(Array.isArray(deltasResp?.deltas) ? deltasResp.deltas : []);
        setSpatialData(spatialResp ?? null);
        setFocusedCellId(spatialResp?.cells?.[0]?.cellId ?? null);
      } catch {
        setTrendData([]);
        setRecentDeltas([]);
        setSpatialData(null);
        setFocusedCellId(null);
      } finally {
        setSpatialLoading(false);
      }
    };
    void loadVerticalData();
  }, [selectedSpatialSort, selectedVertical]);

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
  const selectedVerticalLabel = selectedVertical === 'all' ? t('All Categories', 'Toutes les catégories') : categoryLabel(selectedVertical, language);

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
    if (!latestDate) return t('No data yet', 'Aucune donnée');
    return new Date(latestDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [language, latestDate]);

  const apiPreview = useMemo(() => {
    const params = new URLSearchParams(
      selectedVertical !== 'all' && spatialData?.cells?.length
        ? {
            view: 'spatial_intelligence',
            vertical: selectedVertical,
            sort: selectedSpatialSort,
            limit: String(spatialData.cells.length),
          }
        : { view: 'deltas', publishable: 'true', limit: '20' },
    );
    if (selectedVertical !== 'all' && !params.has('vertical')) params.set('vertical', selectedVertical);
    return buildUrl(`/api/analytics?${params.toString()}`);
  }, [selectedSpatialSort, selectedVertical, spatialData]);

  const exportRows = useMemo(() => {
    if (selectedVertical !== 'all' && spatialData?.cells?.length) {
      return spatialData.cells.map((cell) => ({
        snapshot_date: cell.snapshotDate,
        vertical_id: cell.verticalId,
        cell_id: cell.cellId,
        center_latitude: cell.center.latitude,
        center_longitude: cell.center.longitude,
        total_points: cell.totalPoints,
        completed_points: cell.completedPoints,
        completion_rate: cell.completionRate,
        avg_confidence_score: cell.avgConfidenceScore,
        publishable_change_count: cell.publishableChangeCount,
        opportunity_score: cell.opportunityScore,
        coverage_gap_score: cell.coverageGapScore,
        change_signal_score: cell.changeSignalScore,
        summary: cell.summary,
        caveats: cell.caveats.join(' | '),
      }));
    }

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
      ? t('No data is available to export yet.', 'Aucune donnée n\'est encore disponible pour l\'export.')
      : t('This category is supported, but it has no data history to export yet.', 'Cette catégorie est prise en charge, mais elle n\'a pas encore d\'historique à exporter.')
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
        geometry:
          typeof row.center_latitude === 'number' && typeof row.center_longitude === 'number'
            ? {
                type: 'Point',
                coordinates: [row.center_longitude, row.center_latitude],
              }
            : null,
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
      case 'removed': return t('REMOVED', 'SUPPRIMÉ');
      case 'changed': return t('CHANGED', 'MODIFIÉ');
      default: return t('UNCHANGED', 'INCHANGÉ');
    }
  };

  const scoreLabel = (sort: SpatialIntelligenceSort) => {
    switch (sort) {
      case 'coverage_gap_score':
        return t('Coverage Gap', 'Manque de couverture');
      case 'change_signal_score':
        return t('Change Signal', 'Signal de changement');
      default:
        return t('Opportunity', 'Opportunité');
    }
  };

  const topSpatialCell = spatialData?.cells?.[0] ?? null;
  const focusedSpatialCell = spatialData?.cells?.find((cell) => cell.cellId === focusedCellId) ?? topSpatialCell;
  const focusedCellBounds = focusedSpatialCell
    ? decodeGeohashBounds(focusedSpatialCell.cellId)
    : null;
  const focusedMapBounds: [[number, number], [number, number]] = focusedCellBounds
    ? [
        [focusedCellBounds.south, focusedCellBounds.west],
        [focusedCellBounds.north, focusedCellBounds.east],
      ]
    : BONAMOUSSADI_MAP_BOUNDS;
  const renderSpatialDriver = (driver: SpatialIntelligenceCell['drivers'][number]) => (
    <span
      key={`${driver.label}-${driver.impact}`}
      className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
        driver.impact === 'negative'
          ? 'bg-red-50 text-red-700'
          : driver.impact === 'neutral'
            ? 'bg-gray-100 text-gray-600'
            : 'bg-forest/10 text-forest'
      }`}
    >
      {driver.label}
    </span>
  );

  return (
    <div className="screen-shell">
      <ScreenHeader
        title={t('Delta Intelligence', 'Intelligence Delta')}
        onBack={onBack}
        language={language}
        trailing={
          <button
            type="button"
            onClick={() => handleExport(selectedFormat)}
            className="p-2 text-navy"
            aria-label={t('Export current view', 'Exporter la vue')}
          >
            <Download size={18} />
          </button>
        }
      />

      <div className="p-4 pb-24 space-y-4">
        <div className="rounded-[32px] bg-gradient-to-br from-navy via-navy-mid to-navy-mid text-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="micro-label-wide text-white/70">
                {t('Client Dashboard', 'Tableau client')}
              </div>
              <h2 className="mt-2 text-2xl font-extrabold">
                {selectedVertical === 'all'
                  ? t('What changed across the monitored network', 'Ce qui a changé sur le réseau suivi')
                  : `${t('Change story for', 'Récit de changement pour')} ${selectedVerticalLabel}`}
              </h2>
              <p className="mt-2 text-sm text-white/80">
                {t('Exports inherit the exact current filter state.', 'Les exports reprennent exactement l\'état courant des filtres.')}
              </p>
            </div>
            <div className="rounded-3xl bg-white/15 px-4 py-3">
              <div className="micro-label text-white/70">{t('Latest Report', 'Dernier rapport')}</div>
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
                {filteredAnomalies.length} {t('Anomalies Detected', 'Anomalies détectées')}
              </p>
              <div className="mt-1 space-y-1">
                {filteredAnomalies.slice(0, 3).map((a, i) => (
                  <p key={i} className="text-[11px] text-red-600">
                    {categoryLabel(a.vertical_id, language)}: {a.anomaly_flags.map((f) => `${f.metric} z=${f.zScore}`).join(', ')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="card p-3 text-center">
            <span className="micro-label text-gray-400 block">{t('Points', 'Points')}</span>
            <span className="text-lg font-bold text-gray-900">{summaryTotalPoints}</span>
          </div>
          <div className="card p-3 text-center">
            <span className="micro-label text-gray-400 block">{t('WoW', 'WoW')}</span>
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
          <div className="card p-3 text-center">
            <span className="micro-label text-gray-400 block">{t('Complete', 'Complet')}</span>
            <span className="text-sm font-bold text-gray-900">{summaryCompletion}%</span>
          </div>
          <div className="card p-3 text-center">
            <span className="micro-label text-gray-400 block">{t('Alerts', 'Alertes')}</span>
            <span className={`text-sm font-bold ${filteredAnomalies.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{filteredAnomalies.length}</span>
          </div>
        </div>

        {/* Vertical Tabs */}
        <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1">
          <button
            onClick={() => setSelectedVertical('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl micro-label transition-colors ${
              selectedVertical === 'all' ? 'bg-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t('All', 'Tout')}
          </button>
          {VERTICAL_IDS.map((vid) => (
            <button
              key={vid}
              onClick={() => setSelectedVertical(vid)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl micro-label transition-colors ${
                selectedVertical === vid ? 'bg-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
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
          <div className="card p-8 text-center">
            <p className="micro-label text-gray-400">
              {t('Loading data...', 'Chargement des données...')}
            </p>
          </div>
        ) : stats.length === 0 ? (
          <div className="card p-8 text-center space-y-2">
            <p className="text-xs font-bold text-gray-600">
              {t('No data yet', 'Pas encore de données')}
            </p>
            <p className="text-[11px] text-gray-400">
              {t('Data is collected weekly. Check back after the first run.', 'Les données sont collectées chaque semaine.')}
            </p>
          </div>
        ) : !hasSelectedVerticalData ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-xs font-bold text-gray-700">
              {selectedVerticalLabel}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {t('No weekly data for this category yet. It will appear once collection starts.', 'Pas encore de données hebdomadaires pour cette catégorie. Elles apparaîtront dès que la collecte commencera.')}
            </p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">
              {t(
                'This category is available in ADL, but no weekly data has been generated for it yet. Once coverage starts, charts and exports will appear here.',
                'Cette catégorie est disponible dans ADL, mais aucune donnée hebdomadaire n\'a encore été générée pour elle. Dès que la couverture démarre, les graphiques et exports apparaîtront ici.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Point Count Trend */}
            {selectedVertical !== 'all' && trendData.length > 1 && (
              <div className="card p-4 space-y-3">
                <span className="micro-label text-gray-900">
                  {t('Point Count Trend', 'Tendance des points')}
                </span>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={35} />
                      <Tooltip labelFormatter={(d: string) => d} />
                      <Line type="monotone" dataKey="value" stroke="var(--chart-navy)" strokeWidth={2} dot={{ r: 3 }} name={t('Actual', 'Réel')} />
                      <Line type="monotone" dataKey="movingAvg" stroke="var(--chart-forest)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name={t('4w Avg', 'Moy. 4s')} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Delta Breakdown */}
            {deltaBreakdown.length > 0 && (
              <div className="card p-4 space-y-3">
                <span className="micro-label text-gray-900">
                  {t('Delta Breakdown', 'Répartition des changements')}
                </span>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deltaBreakdown} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={35} />
                      <Tooltip />
                      <Bar dataKey="new" stackId="delta" fill="var(--chart-green)" name={t('New', 'Nouveau')} />
                      <Bar dataKey="removed" stackId="delta" fill="var(--chart-red)" name={t('Removed', 'Supprimé')} />
                      <Bar dataKey="changed" stackId="delta" fill="var(--chart-yellow)" name={t('Changed', 'Modifié')} />
                      <Bar dataKey="unchanged" stackId="delta" fill="var(--chart-gray)" name={t('Unchanged', 'Inchangé')} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Price Trend (fuel only) */}
            {showPriceTrend && priceTrend.length > 1 && (
              <div className="card p-4 space-y-3">
                <span className="micro-label text-gray-900">
                  {t('Average Fuel Price', 'Prix moyen du carburant')}
                </span>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceTrend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={45} />
                      <Tooltip labelFormatter={(d: string) => d} formatter={(v: number) => [`${v} XAF`, t('Price', 'Prix')]} />
                      <Line type="monotone" dataKey="price" stroke="var(--chart-terra)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {selectedVertical !== 'all' && (
              <div className="card-pill p-5 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="micro-label-wide text-gray-400">
                      {t('Spatial Intelligence', 'Intelligence spatiale')}
                    </div>
                    <h4 className="mt-1 text-lg font-bold text-gray-900">
                      {t('Why this vertical clusters where it does', 'Pourquoi cette verticale se concentre à ces endroits')}
                    </h4>
                    <p className="mt-2 text-[11px] text-gray-500 max-w-2xl">
                      {spatialData?.narrative ?? t(
                        'Select a category with weekly data to generate ranked map cells, strongest drivers, and evidence gaps.',
                        'Sélectionnez une catégorie avec des données hebdomadaires pour générer des cellules classées, les principaux facteurs et les manques de preuve.'
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[260px]">
                    {SPATIAL_SORT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedSpatialSort(option.id)}
                        className={`rounded-2xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                          selectedSpatialSort === option.id
                            ? 'bg-navy text-white'
                            : 'bg-page text-gray-600 border border-gray-100'
                        }`}
                      >
                        {language === 'fr' ? option.label.fr : option.label.en}
                      </button>
                    ))}
                  </div>
                </div>

                {spatialLoading ? (
                  <div className="rounded-3xl bg-page px-4 py-6 text-center text-[11px] text-gray-500">
                    {t('Building ranked intelligence cells...', 'Construction des cellules d\'intelligence...')}
                  </div>
                ) : spatialData?.cells?.length ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <div className="rounded-3xl bg-page px-4 py-3">
                        <div className="micro-label text-gray-400">{t('Cells', 'Cellules')}</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{spatialData.totalCells}</div>
                      </div>
                      <div className="rounded-3xl bg-page px-4 py-3">
                        <div className="micro-label text-gray-400">{t('Mapped Points', 'Points cartographiés')}</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{spatialData.totalPoints}</div>
                      </div>
                      <div className="rounded-3xl bg-page px-4 py-3">
                        <div className="micro-label text-gray-400">{scoreLabel(selectedSpatialSort)}</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">
                          {topSpatialCell ? `${selectedSpatialSort === 'coverage_gap_score'
                            ? topSpatialCell.coverageGapScore
                            : selectedSpatialSort === 'change_signal_score'
                              ? topSpatialCell.changeSignalScore
                              : topSpatialCell.opportunityScore}/100` : '--'}
                        </div>
                      </div>
                      <div className="rounded-3xl bg-page px-4 py-3">
                        <div className="micro-label text-gray-400">{t('Top Cell', 'Cellule clé')}</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{topSpatialCell?.cellId ?? '--'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="micro-label text-gray-400">{t('Cluster map', 'Carte des clusters')}</div>
                            <div className="mt-1 text-sm font-bold text-gray-900">
                              {focusedSpatialCell
                                ? `${t('Focused cell', 'Cellule ciblée')} ${focusedSpatialCell.cellId}`
                                : t('Ranked cells in Bonamoussadi', 'Cellules classées à Bonamoussadi')}
                            </div>
                          </div>
                          {focusedSpatialCell && (
                            <div className="rounded-2xl bg-page px-3 py-2 text-right">
                              <div className="micro-label text-gray-400">{t('Center', 'Centre')}</div>
                              <div className="mt-1 text-[11px] font-bold text-gray-900">
                                {focusedSpatialCell.center.latitude.toFixed(4)}, {focusedSpatialCell.center.longitude.toFixed(4)}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="h-[320px] overflow-hidden rounded-[28px] border border-gray-100">
                          <MapContainer
                            center={[BONAMOUSSADI_CENTER.latitude, BONAMOUSSADI_CENTER.longitude]}
                            zoom={15}
                            minZoom={14}
                            maxZoom={18}
                            maxBounds={BONAMOUSSADI_MAP_BOUNDS}
                            maxBoundsViscosity={1.0}
                            scrollWheelZoom
                            className="h-full w-full"
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                              subdomains="abcd"
                              maxZoom={20}
                            />
                            <SpatialMapViewport bounds={focusedMapBounds} />
                            {spatialData.cells.map((cell) => {
                              const bounds = decodeGeohashBounds(cell.cellId);
                              const isFocused = cell.cellId === focusedSpatialCell?.cellId;
                              const fillColor = scoreFillColor(selectedSpatialSort, cell);
                              const score = scoreValueForCell(selectedSpatialSort, cell);

                              return (
                                <Rectangle
                                  key={cell.cellId}
                                  bounds={[
                                    [bounds.south, bounds.west],
                                    [bounds.north, bounds.east],
                                  ]}
                                  pathOptions={{
                                    color: isFocused ? '#c86b4a' : fillColor,
                                    fillColor,
                                    fillOpacity: isFocused ? 0.34 : 0.18,
                                    weight: isFocused ? 3 : 2,
                                  }}
                                  eventHandlers={{
                                    click: () => setFocusedCellId(cell.cellId),
                                  }}
                                >
                                  <Popup>
                                    <div className="space-y-1 text-[11px]">
                                      <div className="font-bold text-gray-900">{cell.cellId}</div>
                                      <div className="text-gray-700">{cell.summary}</div>
                                      <div className="text-gray-500">
                                        {scoreLabel(selectedSpatialSort)}: {score}/100
                                      </div>
                                      <div className="text-gray-500">
                                        {t('Center', 'Centre')}: {cell.center.latitude.toFixed(4)}, {cell.center.longitude.toFixed(4)}
                                      </div>
                                    </div>
                                  </Popup>
                                </Rectangle>
                              );
                            })}
                          </MapContainer>
                        </div>

                        <p className="text-[11px] text-gray-500">
                          {t(
                            'Each rectangle is the geohash cell footprint behind a ranked cluster. Click one to see where the top cell sits inside Bonamoussadi.',
                            'Chaque rectangle représente l’empreinte de la cellule geohash derrière un cluster classé. Cliquez dessus pour voir où se situe la cellule clé dans Bonamoussadi.'
                          )}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="micro-label text-gray-400">{t('Cell selector', 'Sélecteur de cellule')}</div>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {spatialData.cells.map((cell) => {
                            const score = scoreValueForCell(selectedSpatialSort, cell);
                            const isFocused = cell.cellId === focusedSpatialCell?.cellId;
                            return (
                              <button
                                key={cell.cellId}
                                type="button"
                                onClick={() => setFocusedCellId(cell.cellId)}
                                className={`w-full rounded-[24px] border px-4 py-3 text-left transition-colors ${
                                  isFocused
                                    ? 'border-navy bg-navy-wash'
                                    : 'border-gray-100 bg-white hover:bg-page'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
                                      {cell.cellId}
                                    </div>
                                    <p className="mt-1 text-[11px] text-gray-700">
                                      {cell.center.latitude.toFixed(4)}, {cell.center.longitude.toFixed(4)}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-page px-3 py-2">
                                    <div className="micro-label text-gray-400">{scoreLabel(selectedSpatialSort)}</div>
                                    <div className="mt-1 text-sm font-bold text-gray-900">{score}/100</div>
                                  </div>
                                </div>
                                <p className="mt-2 text-[11px] text-gray-700 line-clamp-2">{cell.summary}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {spatialData.cells.map((cell) => {
                        const activeScore = selectedSpatialSort === 'coverage_gap_score'
                          ? cell.coverageGapScore
                          : selectedSpatialSort === 'change_signal_score'
                            ? cell.changeSignalScore
                            : cell.opportunityScore;

                        return (
                          <div
                            key={cell.cellId}
                            onClick={() => setFocusedCellId(cell.cellId)}
                            className={`rounded-[28px] border bg-white p-4 shadow-sm space-y-3 cursor-pointer transition-colors ${
                              cell.cellId === focusedSpatialCell?.cellId
                                ? 'border-navy/30 ring-1 ring-navy/15'
                                : 'border-gray-100'
                            }`}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-navy-wash px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-navy">
                                  {cell.cellId}
                                  <span className="text-gray-400">•</span>
                                  {selectedVerticalLabel}
                                </div>
                                <p className="mt-2 text-sm font-semibold text-gray-900">{cell.summary}</p>
                              </div>
                              <div className="rounded-3xl bg-page px-4 py-3 min-w-[140px]">
                                <div className="micro-label text-gray-400">{scoreLabel(selectedSpatialSort)}</div>
                                <div className="mt-1 text-xl font-extrabold text-gray-900">{activeScore}/100</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                              <div className="rounded-2xl bg-page px-3 py-2">
                                <div className="micro-label text-gray-400">{t('Points', 'Points')}</div>
                                <div className="mt-1 text-sm font-bold text-gray-900">{cell.totalPoints}</div>
                              </div>
                              <div className="rounded-2xl bg-page px-3 py-2">
                                <div className="micro-label text-gray-400">{t('Publishable Changes', 'Changements publiables')}</div>
                                <div className="mt-1 text-sm font-bold text-gray-900">{cell.publishableChangeCount}</div>
                              </div>
                              <div className="rounded-2xl bg-page px-3 py-2">
                                <div className="micro-label text-gray-400">{t('Confidence', 'Confiance')}</div>
                                <div className="mt-1 text-sm font-bold text-gray-900">{cell.avgConfidenceScore}/100</div>
                              </div>
                              <div className="rounded-2xl bg-page px-3 py-2">
                                <div className="micro-label text-gray-400">{t('Freshness', 'Fraîcheur')}</div>
                                <div className="mt-1 text-sm font-bold text-gray-900">{cell.medianFreshnessDays}{t('d', 'j')}</div>
                              </div>
                              <div className="rounded-2xl bg-page px-3 py-2">
                                <div className="micro-label text-gray-400">{t('Operators', 'Opérateurs')}</div>
                                <div className="mt-1 text-sm font-bold text-gray-900">{cell.operatorDiversity}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                              <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-navy">
                                  <ShieldCheck size={14} />
                                  {t('Strongest drivers', 'Principaux facteurs')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {cell.drivers.length > 0
                                    ? cell.drivers.slice(0, 5).map(renderSpatialDriver)
                                    : (
                                      <span className="text-[11px] text-gray-500">
                                        {t('No dominant drivers surfaced for this cell yet.', 'Aucun facteur dominant n\'a encore émergé pour cette cellule.')}
                                      </span>
                                    )}
                                </div>
                              </div>

                              <div className="space-y-2 rounded-3xl bg-page px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
                                  {t('Caveats', 'Réserves')}
                                </div>
                                {cell.caveats.length > 0 ? (
                                  <div className="space-y-1">
                                    {cell.caveats.slice(0, 3).map((caveat) => (
                                      <p key={caveat} className="text-[11px] text-gray-600">
                                        {caveat}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-gray-600">
                                    {t('No major evidence caveats flagged in this cell.', 'Aucune réserve majeure de preuve signalée dans cette cellule.')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-3xl border border-gray-100 bg-page px-4 py-5 text-[11px] text-gray-500">
                    {t(
                      'Spatial intelligence appears once a vertical has snapshots and ranked map cells can be generated.',
                      'L\'intelligence spatiale apparaît lorsqu\'une verticale a des snapshots et que des cellules cartographiques peuvent être classées.'
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recent Deltas */}
            {selectedVertical !== 'all' && recentDeltas.length > 0 && (
              <div className="card p-4 space-y-3">
                <span className="micro-label text-gray-900">
                  {t('Recent Changes', 'Changements récents')}
                </span>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentDeltas.filter((d) => d.delta_type !== 'unchanged').slice(0, 15).map((delta) => (
                    <div key={delta.id} className="flex items-start space-x-2 p-2 bg-page rounded-xl">
                      <span className={`micro-label px-1.5 py-0.5 rounded ${deltaTypeColor(delta.delta_type)}`}>
                        {deltaTypeLabel(delta.delta_type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-700 truncate">
                          {delta.delta_summary ?? `${delta.point_id.slice(0, 8)}...`}
                        </p>
                        {delta.delta_magnitude !== null && (
                          <p className="text-[11px] text-gray-400">
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
