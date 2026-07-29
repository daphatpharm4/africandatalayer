import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getOrganizationAnalyticsSnapshotRequest,
  listOrganizationAnalyticsAgentsRequest,
  listOrganizationAnalyticsCategoriesRequest,
  listOrganizationAnalyticsTrendsRequest,
} from '../../lib/client/platformApi';
import type {
  PlatformAnalyticsAgent,
  PlatformAnalyticsCategory,
  PlatformAnalyticsSnapshot,
  PlatformAnalyticsTrend,
} from '../../shared/platformTypes';

interface AnalyticsScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
}

interface AnalyticsData {
  snapshot: PlatformAnalyticsSnapshot;
  trends: PlatformAnalyticsTrend[];
  categories: PlatformAnalyticsCategory[];
  agents: PlatformAnalyticsAgent[];
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ organizationId, language }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const load = useCallback(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void Promise.all([
      getOrganizationAnalyticsSnapshotRequest(organizationId),
      listOrganizationAnalyticsTrendsRequest(organizationId, 12),
      listOrganizationAnalyticsCategoriesRequest(organizationId),
      listOrganizationAnalyticsAgentsRequest(organizationId),
    ])
      .then(([snapshot, trends, categories, agents]) => {
        if (!cancelled) setData({ snapshot, trends, categories, agents });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('Analytics failed to load.', 'Échec du chargement des analyses.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, reloadKey, language]);

  useEffect(load, [load]);

  const maxTrend = useMemo(() => Math.max(1, ...(data?.trends.map((point) => point.value) ?? [])), [data]);

  return (
    <section aria-labelledby="analytics-title" className="space-y-6">
      <header>
        <p className="micro-label text-terra">{t('Company intelligence', 'Intelligence entreprise')}</p>
        <h1 id="analytics-title" className="mt-1 text-2xl font-semibold text-ink">{t('Analytics', 'Analyses')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {t('Operational metrics calculated only from this company’s records.', 'Indicateurs opérationnels calculés uniquement à partir des données de cette entreprise.')}
        </p>
      </header>

      {error ? (
        <div role="alert" className="card border border-red-200 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-secondary mt-4">{t('Try again', 'Réessayer')}</button>
        </div>
      ) : data === null ? (
        <div className="card p-6 text-sm text-ink-muted" role="status">{t('Loading analytics…', 'Chargement des analyses…')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t('Total records', 'Total données'), data.snapshot.verification.totalPoints],
              [t('Verified', 'Vérifiées'), `${data.snapshot.verification.verificationRatePct}%`],
              [t('Active contributors', 'Contributeurs actifs'), data.snapshot.weeklyActiveContributors],
              [t('Pending review', 'En révision'), data.snapshot.reviewQueue.pendingReview],
            ].map(([label, value]) => (
              <article key={String(label)} className="card p-4">
                <p className="text-xs font-medium text-ink-muted">{label}</p>
                <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
              </article>
            ))}
          </div>

          <article className="card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="micro-label text-ink-muted">{t('12-week activity', 'Activité sur 12 semaines')}</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">{t('Verified collection trend', 'Tendance de collecte vérifiée')}</h2>
              </div>
              <p className="text-sm text-ink-muted">{data.trends.reduce((sum, point) => sum + point.value, 0)} {t('records', 'données')}</p>
            </div>
            <div className="mt-5 flex h-40 items-end gap-2" aria-label={t('Weekly record chart', 'Graphique hebdomadaire')}>
              {data.trends.length === 0 ? (
                <p className="self-center text-sm text-ink-muted">{t('No recent activity.', 'Aucune activité récente.')}</p>
              ) : data.trends.map((point) => (
                <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-semibold text-ink-muted">{point.value}</span>
                  <div className="w-full max-w-10 rounded-t-md bg-forest" style={{ height: `${Math.max(6, (point.value / maxTrend) * 110)}px` }} />
                  <span className="hidden text-xs text-ink-muted sm:block">{point.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="card p-5">
              <h2 className="text-lg font-semibold text-ink">{t('Data categories', 'Catégories de données')}</h2>
              <div className="mt-4 space-y-4">
                {data.categories.length === 0 ? <p className="text-sm text-ink-muted">{t('No category data.', 'Aucune donnée de catégorie.')}</p> : data.categories.map((category) => (
                  <div key={category.category}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium text-ink">{category.category.replaceAll('_', ' ')}</span>
                      <span className="text-ink-muted">{category.count} · {category.percentage}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-wash">
                      <div className="h-full rounded-full bg-terra" style={{ width: `${Math.min(100, category.percentage)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card overflow-hidden p-0">
              <div className="p-5 pb-3">
                <h2 className="text-lg font-semibold text-ink">{t('Contributor quality', 'Qualité des contributeurs')}</h2>
              </div>
              <div className="divide-y divide-navy-border">
                {data.agents.length === 0 ? <p className="p-5 text-sm text-ink-muted">{t('No contributor data.', 'Aucune donnée de contributeur.')}</p> : data.agents.slice(0, 10).map((agent) => (
                  <div key={agent.userId} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{agent.displayName}</p>
                      <p className="text-xs text-ink-muted">{agent.submissions} {t('submissions', 'soumissions')}</p>
                    </div>
                    <p className="text-sm font-semibold text-forest">{Math.round(agent.approvalRate * 100)}%</p>
                    <p className={`text-sm font-semibold ${agent.flags > 0 ? 'text-red-700' : 'text-ink-muted'}`}>{agent.flags} {t('flags', 'alertes')}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
};

export default AnalyticsScreen;
