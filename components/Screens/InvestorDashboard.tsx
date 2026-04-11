import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Printer,
  ShieldCheck,
  Signal,
  TrendingUp,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import ScreenHeader from '../shared/ScreenHeader';
import KpiCard from '../investor/KpiCard';
import TrustGauge from '../investor/TrustGauge';
import { apiJson } from '../../lib/client/api';
import { categoryPluralLabel, VERTICAL_IDS, VERTICALS } from '../../shared/verticals';
import type { LeaderboardEntry } from '../../shared/types';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

// ---------- API response types ----------

interface KpiSummaryResponse {
  generatedAt: string;
  weeklyActiveContributors: number;
  verification: { totalPoints: number; verifiedPoints: number; verificationRatePct: number };
  freshness: { medianAgeDays: number; avgAgeDays: number };
  fraud: { eventsWithFraudCheck: number; mismatchEvents: number; fraudRatePct: number };
  reviewQueue: { pendingReview: number; highRiskEvents: number };
  enrichmentRatePct: number;
}

interface SnapshotRow {
  snapshot_date: string;
  vertical_id: string;
  total_points: number;
  completed_points: number;
  completion_rate: number;
  new_count: number;
  removed_count: number;
  changed_count: number;
  unchanged_count: number;
  week_over_week_growth: number | null;
  moving_avg_4w: number | null;
}

interface WeeklyRow {
  week_start: string;
  category: string;
  total_events: number;
  total_creates: number;
  total_enrichments: number;
  unique_users: number;
  unique_points: number;
}

// ---------- Helpers ----------

/** PostgreSQL NUMERIC/DECIMAL columns arrive as strings in JSON — coerce them. */
function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

function sanitizeSnapshot(row: SnapshotRow): SnapshotRow {
  return {
    ...row,
    total_points: num(row.total_points),
    completed_points: num(row.completed_points),
    completion_rate: num(row.completion_rate),
    new_count: num(row.new_count),
    removed_count: num(row.removed_count),
    changed_count: num(row.changed_count),
    unchanged_count: num(row.unchanged_count),
    week_over_week_growth: row.week_over_week_growth != null ? num(row.week_over_week_growth) : null,
    moving_avg_4w: row.moving_avg_4w != null ? num(row.moving_avg_4w) : null,
  };
}

function sanitizeWeekly(row: WeeklyRow): WeeklyRow {
  return {
    ...row,
    total_events: num(row.total_events),
    total_creates: num(row.total_creates),
    total_enrichments: num(row.total_enrichments),
    unique_users: num(row.unique_users),
    unique_points: num(row.unique_points),
  };
}

const CACHE_KEY = 'adl_investor_cache';

function loadCache(): { kpi: KpiSummaryResponse; snapshots: SnapshotRow[]; weekly: WeeklyRow[]; leaderboard: LeaderboardEntry[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(data: { kpi: KpiSummaryResponse; snapshots: SnapshotRow[]; weekly: WeeklyRow[]; leaderboard: LeaderboardEntry[] }) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota or private browsing */ }
}

// ---------- Component ----------

const InvestorDashboard: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const [kpi, setKpi] = useState<KpiSummaryResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // Try cache first for instant render
      const cached = loadCache();
      if (cached) {
        setKpi(cached.kpi);
        setSnapshots(cached.snapshots.map(sanitizeSnapshot));
        setWeekly(cached.weekly.map(sanitizeWeekly));
        setLeaderboard(cached.leaderboard);
        setFromCache(true);
        setLoading(false);
      }

      try {
        const [kpiData, snapshotData, weeklyData, leaderboardData] = await Promise.all([
          apiJson<KpiSummaryResponse>('/api/analytics?view=kpi_summary'),
          apiJson<SnapshotRow[]>('/api/analytics?view=snapshots&limit=52'),
          apiJson<WeeklyRow[]>('/api/analytics?view=kpi_weekly'),
          apiJson<LeaderboardEntry[]>('/api/leaderboard'),
        ]);
        if (cancelled) return;
        const safeSnapshots = (Array.isArray(snapshotData) ? snapshotData : []).map(sanitizeSnapshot);
        const safeWeekly = (Array.isArray(weeklyData) ? weeklyData : []).map(sanitizeWeekly);
        const safeLeaderboard = Array.isArray(leaderboardData) ? leaderboardData : [];
        setKpi(kpiData);
        setSnapshots(safeSnapshots);
        setWeekly(safeWeekly);
        setLeaderboard(safeLeaderboard);
        setFromCache(false);
        saveCache({ kpi: kpiData, snapshots: safeSnapshots, weekly: safeWeekly, leaderboard: safeLeaderboard });
      } catch {
        // If fetch fails and we had no cache, leave loading state
        if (!cached && !cancelled) {
          setLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  // ---------- Derived data ----------

  const latestDate = snapshots.length > 0 ? snapshots[0].snapshot_date : null;

  // Aggregate totals from latest snapshot
  const latestByVertical = useMemo(
    () => snapshots.filter((s) => s.snapshot_date === latestDate),
    [snapshots, latestDate],
  );

  const totalPoints = latestByVertical.reduce((sum, s) => sum + s.total_points, 0);
  const avgCompletionRate = latestByVertical.length > 0
    ? Math.round(latestByVertical.reduce((sum, s) => sum + s.completion_rate, 0) / latestByVertical.length)
    : 0;

  // WoW growth (average across verticals with data)
  const wowEntries = latestByVertical.filter((s) => s.week_over_week_growth !== null);
  const avgWoW = wowEntries.length > 0
    ? Math.round(wowEntries.reduce((sum, s) => sum + (s.week_over_week_growth ?? 0), 0) / wowEntries.length * 10) / 10
    : null;

  // Points by vertical for horizontal bar chart
  const verticalData = useMemo(
    () =>
      VERTICAL_IDS
        .map((id) => {
          const row = latestByVertical.find((s) => s.vertical_id === id);
          return {
            name: categoryPluralLabel(id, language),
            value: row?.total_points ?? 0,
            color: VERTICALS[id].color,
          };
        })
        .filter((d) => d.value > 0),
    [latestByVertical, language],
  );

  // Growth trend line: aggregate total_points per snapshot date
  const growthTrend = useMemo(() => {
    const byDate = new Map<string, { date: string; total: number; ma: number | null }>();
    for (const s of snapshots) {
      const existing = byDate.get(s.snapshot_date);
      if (existing) {
        existing.total += s.total_points;
      } else {
        byDate.set(s.snapshot_date, { date: s.snapshot_date, total: s.total_points, ma: null });
      }
    }
    const sorted = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
    // Compute 4-week moving average
    for (let i = 0; i < sorted.length; i++) {
      if (i >= 3) {
        sorted[i].ma = Math.round(
          (sorted[i].total + sorted[i - 1].total + sorted[i - 2].total + sorted[i - 3].total) / 4,
        );
      }
    }
    return sorted;
  }, [snapshots]);

  // Submission velocity from weekly data
  const velocityTrend = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const w of weekly) {
      byWeek.set(w.week_start, (byWeek.get(w.week_start) ?? 0) + w.total_events);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([week, events]) => ({ week, events }));
  }, [weekly]);

  // Quality distribution from leaderboard
  const qualityDistribution = useMemo(() => {
    const buckets = [
      { name: t('Excellent', 'Excellent'), range: '80-100', value: 0, color: '#4c7c59' },
      { name: t('High', 'Haut'), range: '60-80', value: 0, color: '#0f2b46' },
      { name: t('Medium', 'Moyen'), range: '40-60', value: 0, color: '#c86b4a' },
      { name: t('Low', 'Bas'), range: '0-40', value: 0, color: '#d69e2e' },
    ];
    for (const entry of leaderboard) {
      const q = entry.averageQualityScore;
      if (q >= 80) buckets[0].value += 1;
      else if (q >= 60) buckets[1].value += 1;
      else if (q >= 40) buckets[2].value += 1;
      else buckets[3].value += 1;
    }
    return buckets.filter((b) => b.value > 0);
  }, [leaderboard, language]);

  // Trust tier distribution from leaderboard quality scores
  const trustTierData = useMemo(() => {
    const tiers = [
      { name: t('Elite', 'Elite'), value: 0, color: '#4c7c59' },
      { name: t('Trusted', 'Confiance'), value: 0, color: '#0f2b46' },
      { name: t('Standard', 'Standard'), value: 0, color: '#c86b4a' },
      { name: t('New', 'Nouveau'), value: 0, color: '#d5e1eb' },
    ];
    for (const entry of leaderboard) {
      const q = entry.averageQualityScore;
      if (q >= 75) tiers[0].value += 1;
      else if (q >= 50) tiers[1].value += 1;
      else if (q >= 30) tiers[2].value += 1;
      else tiers[3].value += 1;
    }
    return tiers.filter((t) => t.value > 0);
  }, [leaderboard, language]);

  // Verification donut
  const verificationDonut = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: t('Verified', 'Vérifié'), value: kpi.verification.verifiedPoints, color: '#4c7c59' },
      { name: t('Unverified', 'Non vérifié'), value: Math.max(0, kpi.verification.totalPoints - kpi.verification.verifiedPoints), color: '#d5e1eb' },
    ];
  }, [kpi, language]);

  // Export-ready composite
  const isExportReady = kpi
    ? kpi.verification.verificationRatePct > 20 && kpi.fraud.fraudRatePct < 10 && kpi.freshness.medianAgeDays < 14
    : false;

  // Active verticals count
  const activeVerticals = new Set(latestByVertical.map((s) => s.vertical_id)).size;

  const formattedDate = latestDate
    ? new Date(latestDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '--';

  // ---------- Render ----------

  if (loading && !kpi) {
    return (
      <div data-testid="screen-investor-dashboard" className="screen-shell">
        <ScreenHeader title={t('Investor Dashboard', 'Tableau investisseur')} onBack={onBack} language={language} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="micro-label text-gray-400">{t('Loading metrics...', 'Chargement des métriques...')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="screen-investor-dashboard" className="screen-shell">
      <ScreenHeader
        title={t('Investor Dashboard', 'Tableau investisseur')}
        onBack={onBack}
        language={language}
        trailing={
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 text-navy print:hidden"
            aria-label={t('Print dashboard', 'Imprimer le tableau')}
          >
            <Printer size={18} />
          </button>
        }
      />

      <div className="p-4 pb-24 space-y-4 print:p-8 print:pb-4">
        {/* ---------- HERO BANNER ---------- */}
        <div className="rounded-[32px] bg-gradient-to-br from-navy via-navy-mid to-navy-mid text-white p-6 shadow-sm print:rounded-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="micro-label-wide text-white/60">{t('Africa Forward Summit', 'Africa Forward Summit')} — Nairobi 2026</div>
              <h2 className="mt-2 text-2xl font-extrabold lg:text-3xl">African Data Layer</h2>
              <p className="mt-1 text-sm text-white/80 max-w-lg">
                {t(
                  'Decision-grade, fraud-verified street-level infrastructure intelligence for African cities.',
                  'Intelligence d\'infrastructure de terrain, vérifiée anti-fraude, pour les villes africaines.',
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="rounded-3xl bg-white/15 px-4 py-3 text-right">
                <div className="micro-label text-white/60">{t('Pilot Zone', 'Zone pilote')}</div>
                <div className="text-sm font-bold">Bonamoussadi, Douala</div>
              </div>
              {fromCache && (
                <span className="text-[10px] text-white/40 print:hidden">{t('Showing cached data', 'Données en cache')}</span>
              )}
            </div>
          </div>
        </div>

        {/* ---------- KPI RIBBON ---------- */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label={t('Verified Points', 'Points vérifiés')}
            value={kpi?.verification.verifiedPoints ?? '--'}
            subtitle={`/ ${kpi?.verification.totalPoints ?? '--'} ${t('total', 'total')}`}
            color="navy"
          />
          <KpiCard
            label={t('Verification Rate', 'Taux de vérification')}
            value={kpi ? `${kpi.verification.verificationRatePct}%` : '--'}
            color="forest"
            trend={kpi && kpi.verification.verificationRatePct > 20 ? 'up' : 'neutral'}
          />
          <KpiCard
            label={t('Fraud Rate', 'Taux de fraude')}
            value={kpi ? `${kpi.fraud.fraudRatePct}%` : '--'}
            subtitle={kpi ? `${kpi.fraud.eventsWithFraudCheck} ${t('checked', 'vérifiés')}` : undefined}
            color={kpi && kpi.fraud.fraudRatePct < 5 ? 'forest' : kpi && kpi.fraud.fraudRatePct < 15 ? 'gold' : 'danger'}
          />
          <KpiCard
            label={t('Freshness', 'Fraîcheur')}
            value={kpi ? `${kpi.freshness.medianAgeDays}d` : '--'}
            subtitle={t('median age', 'âge médian')}
            color={kpi && kpi.freshness.medianAgeDays <= 7 ? 'forest' : kpi && kpi.freshness.medianAgeDays <= 14 ? 'gold' : 'danger'}
          />
          <KpiCard
            label={t('Active Agents', 'Agents actifs')}
            value={kpi?.weeklyActiveContributors ?? '--'}
            subtitle={t('7-day window', 'fenêtre 7j')}
            color="navy"
          />
          <KpiCard
            label={t('Enrichment', 'Enrichissement')}
            value={kpi ? `${kpi.enrichmentRatePct}%` : '--'}
            subtitle={t('points with depth', 'points enrichis')}
            color="terra"
          />
        </div>

        {/* ---------- QUADRANT GRID ---------- */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Q1: OPERATIONAL HEALTH */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-navy" />
              <span className="micro-label text-gray-900">{t('Operational Health', 'Santé opérationnelle')}</span>
            </div>

            {/* Submission Velocity Line Chart */}
            {velocityTrend.length > 1 ? (
              <div>
                <span className="text-[11px] text-gray-500">{t('Submission velocity (12 weeks)', 'Vélocité de soumission (12 sem.)')}</span>
                <div className="h-44 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={velocityTrend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="week" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={35} />
                      <Tooltip labelFormatter={(d: string) => d} />
                      <Line type="monotone" dataKey="events" stroke="var(--chart-navy)" strokeWidth={2} dot={{ r: 3 }} name={t('Events', 'Événements')} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-page rounded-2xl p-4 text-center">
                <span className="micro-label text-gray-400">{t('Velocity data loading...', 'Chargement des données de vélocité...')}</span>
              </div>
            )}

            {/* Offline Resilience Badge */}
            <div className="flex items-center gap-3 bg-navy-wash rounded-2xl p-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-navy text-white">
                <Wifi size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900">{t('Offline-First Architecture', 'Architecture hors-ligne')}</span>
                <span className="text-[11px] text-gray-500 block">
                  {t('75-item queue, 72h TTL, 6 retries, works on 2G + low-end Android', '75 éléments, 72h TTL, 6 essais, fonctionne en 2G')}
                </span>
              </div>
            </div>
          </div>

          {/* Q2: DATA TRUST & QUALITY */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-forest" />
              <span className="micro-label text-gray-900">{t('Data Trust & Quality', 'Confiance & qualité des données')}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Verification Donut */}
              <div>
                <span className="text-[11px] text-gray-500">{t('Verification', 'Vérification')}</span>
                {verificationDonut.length > 0 ? (
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={verificationDonut} dataKey="value" outerRadius={55} innerRadius={30}>
                          {verificationDonut.map((entry, i) => (
                            <Cell key={`v-${i}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center text-gray-400 micro-label">--</div>
                )}
              </div>

              {/* Trust Tier Donut */}
              <div>
                <span className="text-[11px] text-gray-500">{t('Trust Tiers', 'Niveaux de confiance')}</span>
                {trustTierData.length > 0 ? (
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={trustTierData} dataKey="value" outerRadius={55} innerRadius={30}>
                          {trustTierData.map((entry, i) => (
                            <Cell key={`t-${i}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center text-gray-400 micro-label">--</div>
                )}
              </div>
            </div>

            {/* Fraud rate indicator */}
            <div className={`rounded-2xl p-3 flex items-center gap-3 ${
              kpi && kpi.fraud.fraudRatePct < 5 ? 'bg-forest-wash' : kpi && kpi.fraud.fraudRatePct < 15 ? 'bg-gold-wash' : 'bg-red-50'
            }`}>
              <Signal size={16} className={kpi && kpi.fraud.fraudRatePct < 5 ? 'text-forest' : kpi && kpi.fraud.fraudRatePct < 15 ? 'text-gold' : 'text-danger'} />
              <div>
                <span className="text-xs font-bold text-gray-900">
                  {kpi ? `${kpi.fraud.fraudRatePct}%` : '--'} {t('fraud rate', 'taux de fraude')}
                </span>
                <span className="text-[11px] text-gray-500 block">
                  {t('5-layer detection: EXIF, GPS velocity, device, behavioral, trust', 'Détection 5 couches : EXIF, GPS, appareil, comportement, confiance')}
                </span>
              </div>
            </div>

            {/* Quality Distribution */}
            {qualityDistribution.length > 0 && (
              <div>
                <span className="text-[11px] text-gray-500">{t('Quality Distribution', 'Distribution qualité')}</span>
                <div className="h-28 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={qualityDistribution} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                        {qualityDistribution.map((entry, i) => (
                          <Cell key={`q-${i}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Q3: COVERAGE & GROWTH */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-terra" />
              <span className="micro-label text-gray-900">{t('Coverage & Growth', 'Couverture & croissance')}</span>
            </div>

            {/* Key stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-page rounded-xl p-3 text-center">
                <span className="micro-label text-gray-400 block">{t('Total Points', 'Total points')}</span>
                <span className="text-lg font-extrabold text-navy">{totalPoints}</span>
              </div>
              <div className="bg-page rounded-xl p-3 text-center">
                <span className="micro-label text-gray-400 block">{t('WoW Growth', 'Croissance')}</span>
                <span className={`text-lg font-extrabold ${avgWoW !== null && avgWoW > 0 ? 'text-forest' : avgWoW !== null && avgWoW < 0 ? 'text-danger' : 'text-gray-500'}`}>
                  {avgWoW !== null ? `${avgWoW > 0 ? '+' : ''}${avgWoW}%` : '--'}
                </span>
              </div>
              <div className="bg-page rounded-xl p-3 text-center">
                <span className="micro-label text-gray-400 block">{t('Verticals', 'Secteurs')}</span>
                <span className="text-lg font-extrabold text-terra">{activeVerticals}/7</span>
              </div>
            </div>

            {/* Points by Vertical */}
            {verticalData.length > 0 ? (
              <div>
                <span className="text-[11px] text-gray-500">{t('Points by Category', 'Points par catégorie')}</span>
                <div className="h-44 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={verticalData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                        {verticalData.map((entry, i) => (
                          <Cell key={`vc-${i}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-page rounded-2xl p-4 text-center">
                <span className="micro-label text-gray-400">{t('No snapshot data yet', 'Pas encore de données')}</span>
              </div>
            )}

            {/* Growth Trend Line */}
            {growthTrend.length > 1 && (
              <div>
                <span className="text-[11px] text-gray-500">{t('Growth Trend', 'Tendance de croissance')}</span>
                <div className="h-40 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthTrend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} width={35} />
                      <Tooltip labelFormatter={(d: string) => d} />
                      <Line type="monotone" dataKey="total" stroke="var(--chart-navy)" strokeWidth={2} dot={{ r: 3 }} name={t('Total', 'Total')} />
                      <Line type="monotone" dataKey="ma" stroke="var(--chart-forest)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name={t('4w Avg', 'Moy. 4s')} connectNulls={false} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Q4: COMMERCIAL READINESS */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-gold" />
              <span className="micro-label text-gray-900">{t('Commercial Readiness', 'Maturité commerciale')}</span>
            </div>

            {/* Enrichment Progress */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{t('Enrichment Depth', 'Profondeur d\'enrichissement')}</span>
                <span className="text-xs font-bold text-terra">{kpi?.enrichmentRatePct ?? 0}%</span>
              </div>
              <div className="mt-1.5 h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-terra transition-all"
                  style={{ width: `${kpi?.enrichmentRatePct ?? 0}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                {t('Points enriched beyond initial capture', 'Points enrichis au-delà de la capture initiale')}
              </span>
            </div>

            {/* Freshness Gauge */}
            <TrustGauge
              value={kpi?.freshness.medianAgeDays ?? 0}
              label={t('Median Data Freshness', 'Fraîcheur médiane des données')}
              thresholds={{ green: 7, yellow: 14 }}
              unit={t('days', 'jours')}
            />

            {/* Completion Rate */}
            <div className="bg-page rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="micro-label text-gray-400 block">{t('Completion Rate', 'Taux de complétion')}</span>
                <span className="text-xl font-extrabold text-navy">{avgCompletionRate}%</span>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-navy flex items-center justify-center">
                <span className="text-[11px] font-bold text-navy">{avgCompletionRate}</span>
              </div>
            </div>

            {/* Export Ready Badge */}
            <div className={`rounded-2xl p-4 flex items-center gap-3 ${
              isExportReady ? 'bg-forest-wash border border-forest/20' : 'bg-gold-wash border border-gold/20'
            }`}>
              <CheckCircle2
                size={20}
                className={isExportReady ? 'text-forest' : 'text-gold'}
              />
              <div>
                <span className={`text-xs font-bold ${isExportReady ? 'text-forest-dark' : 'text-amber-700'}`}>
                  {isExportReady
                    ? t('Export Ready', 'Prêt pour l\'export')
                    : t('Building Confidence', 'En cours de maturation')}
                </span>
                <span className="text-[11px] text-gray-500 block">
                  {isExportReady
                    ? t('Verification >20%, Fraud <10%, Fresh <14d', 'Vérification >20%, Fraude <10%, Fraîcheur <14j')
                    : t('Improving verification, freshness, and fraud metrics', 'Amélioration des métriques en cours')}
                </span>
              </div>
            </div>

            {/* 30+ fields badge */}
            <div className="flex items-center gap-3 bg-navy-wash rounded-2xl p-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-navy text-white text-xs font-bold">30+</div>
              <div>
                <span className="text-xs font-bold text-gray-900">{t('Enrichable Fields per Point', 'Champs enrichissables par point')}</span>
                <span className="text-[11px] text-gray-500 block">
                  {t('Opening hours, prices, availability, infrastructure details', 'Horaires, prix, disponibilité, détails infrastructure')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- FOOTER ---------- */}
        <div className="text-center space-y-2 pt-4 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary px-6"
          >
            <Printer size={16} className="mr-2 inline-block" />
            {t('Export as PDF', 'Exporter en PDF')}
          </button>
          <p className="text-[10px] text-gray-400">
            {t('Last updated', 'Dernière mise à jour')}: {formattedDate}
          </p>
        </div>

        <div className="h-20 print:hidden" />
      </div>
    </div>
  );
};

export default InvestorDashboard;
