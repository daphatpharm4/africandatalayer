import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  askOrganizationAnalyticsAssistantRequest,
  getOrganizationAnalyticsSnapshotRequest,
  listOrganizationAnalyticsAgentsRequest,
  listOrganizationAnalyticsCategoriesRequest,
  listOrganizationAnalyticsTrendsRequest,
} from '../../lib/client/platformApi';
import type {
  PlatformAnalyticsAgent,
  PlatformAnalyticsAssistantResponse,
  PlatformAnalyticsCategory,
  PlatformAnalyticsSnapshot,
  PlatformAnalyticsTrend,
  PlatformRole,
} from '../../shared/platformTypes';

interface AnalyticsScreenProps {
  organizationId: string;
  role: PlatformRole;
  language: 'en' | 'fr';
}

interface AnalyticsData {
  organizationId: string;
  snapshot: PlatformAnalyticsSnapshot;
  trends: PlatformAnalyticsTrend[];
  categories: PlatformAnalyticsCategory[];
  agents: PlatformAnalyticsAgent[];
}

type OwnerView = 'delta' | 'investor' | 'categories' | 'agents' | 'assistant';
type Translate = (en: string, fr: string) => string;

const ownerViews: Array<{ id: OwnerView; en: string; fr: string }> = [
  { id: 'delta', en: 'Delta dashboard', fr: 'Tableau des écarts' },
  { id: 'investor', en: 'Investor dashboard', fr: 'Tableau investisseur' },
  { id: 'categories', en: 'Categories', fr: 'Catégories' },
  { id: 'agents', en: 'Agent performance', fr: 'Performance agents' },
  { id: 'assistant', en: 'Assistant', fr: 'Assistant' },
];

function sumTrend(points: PlatformAnalyticsTrend[]): number {
  return points.reduce((sum, point) => sum + point.value, 0);
}

function MetricCard({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <article className="card p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
      {detail && <p className="mt-1 text-xs leading-5 text-ink-muted">{detail}</p>}
    </article>
  );
}

function TrendChart({ trends, t }: { trends: PlatformAnalyticsTrend[]; t: Translate }) {
  const maxTrend = Math.max(1, ...trends.map((point) => point.value));
  return (
    <div className="mt-5 flex h-44 items-end gap-2" aria-label={t('Weekly company record chart', 'Graphique hebdomadaire des données entreprise')}>
      {trends.length === 0 ? (
        <p className="self-center text-sm text-ink-muted">{t('No recent activity.', 'Aucune activité récente.')}</p>
      ) : trends.map((point) => (
        <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-semibold text-ink-muted">{point.value}</span>
          <div
            className="w-full max-w-10 rounded-t-md bg-forest"
            style={{ height: `${Math.max(6, (point.value / maxTrend) * 120)}px` }}
          />
          <span className="hidden text-xs text-ink-muted sm:block">{point.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DeltaDashboard({ data, t }: { data: AnalyticsData; t: Translate }) {
  const recent = sumTrend(data.trends.slice(-4));
  const previous = sumTrend(data.trends.slice(-8, -4));
  const change = recent - previous;
  const changePct = previous > 0 ? Math.round((change / previous) * 100) : null;
  const directionClass = change > 0 ? 'text-forest' : change < 0 ? 'text-red-700' : 'text-ink-muted';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t('Current 4 weeks', '4 semaines actuelles')} value={recent} detail={t('company records', 'données entreprise')} />
        <MetricCard label={t('Previous 4 weeks', '4 semaines précédentes')} value={previous} detail={t('company records', 'données entreprise')} />
        <MetricCard
          label={t('Collection delta', 'Écart de collecte')}
          value={<span className={directionClass}>{change > 0 ? '+' : ''}{change}</span>}
          detail={changePct === null ? t('No prior baseline', 'Aucune base antérieure') : `${changePct > 0 ? '+' : ''}${changePct}%`}
        />
        <MetricCard
          label={t('Review delta', 'Écart de revue')}
          value={data.snapshot.reviewQueue.pendingReview}
          detail={t('records awaiting a decision', 'données en attente de décision')}
        />
      </div>

      <article className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="micro-label text-ink-muted">{t('12-week company delta', 'Écart entreprise sur 12 semaines')}</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{t('Verified collection momentum', 'Dynamique de collecte vérifiée')}</h2>
          </div>
          <p className={`text-sm font-semibold ${directionClass}`}>
            {change === 0
              ? t('Stable against prior period', 'Stable par rapport à la période précédente')
              : `${change > 0 ? '↑' : '↓'} ${Math.abs(change)} ${t('records', 'données')}`}
          </p>
        </div>
        <TrendChart trends={data.trends} t={t} />
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label={t('Verified records', 'Données vérifiées')} value={data.snapshot.verification.verifiedPoints} />
        <MetricCard label={t('Verification rate', 'Taux de vérification')} value={`${data.snapshot.verification.verificationRatePct}%`} />
        <MetricCard label={t('High-risk queue', 'File à haut risque')} value={data.snapshot.reviewQueue.highRiskEvents} />
      </div>
    </div>
  );
}

function InvestorDashboard({ data, t }: { data: AnalyticsData; t: Translate }) {
  const { snapshot } = data;
  const isExportReady = snapshot.verification.verificationRatePct >= 80
    && snapshot.fraud.fraudRatePct < 10
    && snapshot.freshness.medianAgeDays <= 14;
  const latestFourWeeks = sumTrend(data.trends.slice(-4));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t('Data assets', 'Actifs de données')} value={snapshot.verification.totalPoints} />
        <MetricCard label={t('Active contributors', 'Contributeurs actifs')} value={snapshot.weeklyActiveContributors} />
        <MetricCard label={t('Verification', 'Vérification')} value={`${snapshot.verification.verificationRatePct}%`} />
        <MetricCard label={t('Recent velocity', 'Vélocité récente')} value={latestFourWeeks} detail={t('last four weeks', 'quatre dernières semaines')} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="card p-5">
          <p className="micro-label text-terra">{t('Trust and defensibility', 'Confiance et défendabilité')}</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{t('Data quality position', 'Position de qualité des données')}</h2>
          <div className="mt-5 space-y-5">
            {[
              [t('Verified coverage', 'Couverture vérifiée'), snapshot.verification.verificationRatePct, 'bg-forest'],
              [t('Enrichment depth', 'Profondeur d’enrichissement'), snapshot.enrichmentRatePct, 'bg-terra'],
              [t('Clean fraud checks', 'Contrôles fraude conformes'), Math.max(0, 100 - snapshot.fraud.fraudRatePct), 'bg-navy'],
            ].map(([label, value, color]) => (
              <div key={String(label)}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{label}</span>
                  <span className="font-semibold text-ink-muted">{value}%</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy-wash">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Number(value))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-5">
          <p className="micro-label text-terra">{t('Commercial readiness', 'Maturité commerciale')}</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {isExportReady ? t('Investor-ready evidence', 'Preuves prêtes pour investisseurs') : t('Building investor confidence', 'Confiance investisseur en construction')}
          </h2>
          <div className={`mt-5 rounded-2xl border p-4 ${isExportReady ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`font-semibold ${isExportReady ? 'text-green-800' : 'text-amber-900'}`}>
              {isExportReady ? t('Ready for external reporting', 'Prêt pour le reporting externe') : t('Validation work remains', 'Des validations restent nécessaires')}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {t('Readiness combines verification, fraud integrity, and data freshness.', 'La maturité combine vérification, intégrité fraude et fraîcheur des données.')}
            </p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-page p-4">
              <dt className="text-xs text-ink-muted">{t('Median freshness', 'Fraîcheur médiane')}</dt>
              <dd className="mt-1 text-xl font-bold text-navy">{snapshot.freshness.medianAgeDays} {t('days', 'jours')}</dd>
            </div>
            <div className="rounded-2xl bg-page p-4">
              <dt className="text-xs text-ink-muted">{t('Fraud mismatch', 'Écart fraude')}</dt>
              <dd className="mt-1 text-xl font-bold text-navy">{snapshot.fraud.fraudRatePct}%</dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  );
}

function CategoryBreakdown({ categories, t }: { categories: PlatformAnalyticsCategory[]; t: Translate }) {
  return (
    <article className="card p-5">
      <p className="micro-label text-terra">{t('Portfolio composition', 'Composition du portefeuille')}</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">{t('Category breakdown', 'Répartition par catégorie')}</h2>
      <div className="mt-5 space-y-5">
        {categories.length === 0 ? <p className="text-sm text-ink-muted">{t('No category data.', 'Aucune donnée de catégorie.')}</p> : categories.map((category) => (
          <div key={category.category}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium capitalize text-ink">{category.category.replaceAll('_', ' ')}</span>
              <span className="text-ink-muted">{category.count} · {category.percentage}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy-wash">
              <div className="h-full rounded-full bg-terra" style={{ width: `${Math.min(100, category.percentage)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function AgentPerformance({ agents, t }: { agents: PlatformAnalyticsAgent[]; t: Translate }) {
  const totalSubmissions = agents.reduce((sum, agent) => sum + agent.submissions, 0);
  const averageApproval = agents.length > 0
    ? Math.round((agents.reduce((sum, agent) => sum + agent.approvalRate, 0) / agents.length) * 100)
    : 0;
  const totalFlags = agents.reduce((sum, agent) => sum + agent.flags, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label={t('Contributors', 'Contributeurs')} value={agents.length} />
        <MetricCard label={t('Submissions', 'Soumissions')} value={totalSubmissions} />
        <MetricCard label={t('Average approval', 'Approbation moyenne')} value={`${averageApproval}%`} detail={`${totalFlags} ${t('flags', 'alertes')}`} />
      </div>
      <article className="card overflow-hidden p-0">
        <div className="border-b border-navy-border p-5">
          <p className="micro-label text-terra">{t('Verified quality', 'Qualité vérifiée')}</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{t('Agent performance', 'Performance des agents')}</h2>
        </div>
        {agents.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">{t('No contributor data.', 'Aucune donnée de contributeur.')}</p>
        ) : (
          <div className="divide-y divide-navy-border">
            {agents.map((agent, index) => (
              <div key={agent.userId} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[48px_1fr_120px_120px_100px] sm:px-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-wash text-sm font-bold text-navy">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{agent.displayName}</p>
                  <p className="text-xs text-ink-muted">{agent.submissions} {t('submissions', 'soumissions')}</p>
                </div>
                <p className="text-right text-sm font-semibold text-forest sm:hidden">{Math.round(agent.approvalRate * 100)}%</p>
                <p className="hidden text-sm font-semibold text-ink sm:block">{agent.submissions} {t('records', 'données')}</p>
                <p className="hidden text-sm font-semibold text-forest sm:block">{Math.round(agent.approvalRate * 100)}% {t('approved', 'approuvées')}</p>
                <p className={`hidden text-sm font-semibold sm:block ${agent.flags > 0 ? 'text-red-700' : 'text-ink-muted'}`}>{agent.flags} {t('flags', 'alertes')}</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function CompanyAssistant({ organizationId, language, t }: { organizationId: string; language: 'en' | 'fr'; t: Translate }) {
  const prompts = language === 'fr'
    ? ['Qu’est-ce qui a changé ce mois-ci ?', 'Quels risques dois-je traiter ?', 'Résumez la maturité investisseur.']
    : ['What changed this month?', 'Which risks need attention?', 'Summarize investor readiness.'];
  const [question, setQuestion] = useState(prompts[0]);
  const [answer, setAnswer] = useState<PlatformAnalyticsAssistantResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const trimmed = question.trim();
    if (trimmed.length < 3 || pending) return;
    setPending(true);
    setError(null);
    try {
      setAnswer(await askOrganizationAnalyticsAssistantRequest(organizationId, trimmed));
    } catch (reason) {
      setAnswer(null);
      setError(reason instanceof Error ? reason.message : t('Assistant unavailable.', 'Assistant indisponible.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <article className="card p-5">
        <p className="micro-label text-terra">{t('Company-data assistant', 'Assistant données entreprise')}</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">{t('Ask about this company', 'Interroger cette entreprise')}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {t('Answers are built server-side from this company’s aggregates only.', 'Les réponses sont construites côté serveur uniquement à partir des agrégats de cette entreprise.')}
        </p>
        <label htmlFor="company-analytics-question" className="mt-5 block text-sm font-semibold text-ink">{t('Question', 'Question')}</label>
        <textarea
          id="company-analytics-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          maxLength={500}
          className="mt-2 w-full rounded-2xl border border-navy-border bg-white px-4 py-3 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="min-h-12 rounded-full border border-navy-border px-4 text-sm font-medium text-navy">
              {prompt}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void ask()} disabled={pending || question.trim().length < 3} className="btn-primary mt-4 min-h-12 disabled:opacity-60">
          {pending ? t('Analyzing company data…', 'Analyse des données entreprise…') : t('Ask assistant', 'Interroger l’assistant')}
        </button>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </article>

      <article className="card p-5" aria-live="polite">
        <p className="micro-label text-ink-muted">{t('Evidence-backed answer', 'Réponse fondée sur les preuves')}</p>
        {answer ? (
          <div className="mt-3 space-y-4">
            <p className="text-sm leading-6 text-ink">{answer.answer}</p>
            <div>
              <h3 className="text-sm font-semibold text-ink">{t('Company facts used', 'Faits entreprise utilisés')}</h3>
              <ul className="mt-2 space-y-2">
                {answer.facts.slice(0, 8).map((fact) => (
                  <li key={`${fact.source}-${fact.label}`} className="rounded-xl bg-page px-3 py-2 text-sm text-ink">
                    <span className="font-medium">{fact.label}:</span> {fact.value}
                  </li>
                ))}
              </ul>
            </div>
            {answer.caveats.length > 0 && (
              <p className="text-xs leading-5 text-ink-muted">{t('Caveat', 'Réserve')}: {answer.caveats.join(' ')}</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            {t('Ask a question to receive an answer with the company facts used to support it.', 'Posez une question pour recevoir une réponse accompagnée des faits entreprise utilisés.')}
          </p>
        )}
      </article>
    </div>
  );
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ organizationId, role, language }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeView, setActiveView] = useState<OwnerView>(role === 'owner' ? 'delta' : 'categories');
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);

  useEffect(() => {
    setActiveView(role === 'owner' ? 'delta' : 'categories');
  }, [organizationId, role]);

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
        if (!cancelled) setData({ organizationId, snapshot, trends, categories, agents });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('Analytics failed to load.', 'Échec du chargement des analyses.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, reloadKey, t]);

  useEffect(load, [load]);

  const visibleViews = useMemo(
    () => role === 'owner' ? ownerViews : ownerViews.filter((view) => view.id === 'categories' || view.id === 'agents'),
    [role],
  );
  const selectedView = visibleViews.some((view) => view.id === activeView) ? activeView : visibleViews[0].id;
  const visibleData = data?.organizationId === organizationId ? data : null;

  return (
    <section aria-labelledby="analytics-title" className="space-y-5">
      <header>
        <p className="micro-label text-terra">{role === 'owner' ? t('Owner intelligence', 'Intelligence propriétaire') : t('Company intelligence', 'Intelligence entreprise')}</p>
        <h1 id="analytics-title" className="mt-1 text-2xl font-semibold text-ink">{t('Analytics', 'Analyses')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {t('Every dashboard and answer is calculated only from the selected company’s records.', 'Chaque tableau et chaque réponse sont calculés uniquement à partir des données de l’entreprise sélectionnée.')}
        </p>
      </header>

      <nav aria-label={t('Analytics views', 'Vues d’analyse')} className="flex gap-2 overflow-x-auto pb-1">
        {visibleViews.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={selectedView === view.id}
            onClick={() => setActiveView(view.id)}
            className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
              selectedView === view.id ? 'bg-navy text-white' : 'border border-navy-border bg-white text-navy hover:bg-navy-wash'
            }`}
          >
            {language === 'fr' ? view.fr : view.en}
          </button>
        ))}
      </nav>

      {error ? (
        <div role="alert" className="card border border-red-200 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-secondary mt-4 h-11">{t('Try again', 'Réessayer')}</button>
        </div>
      ) : visibleData === null ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label={t('Loading analytics', 'Chargement des analyses')}>
          {[0, 1, 2, 3].map((item) => <div key={item} className="card h-28 animate-pulse bg-navy-wash" />)}
        </div>
      ) : selectedView === 'delta' ? (
        <DeltaDashboard data={visibleData} t={t} />
      ) : selectedView === 'investor' ? (
        <InvestorDashboard data={visibleData} t={t} />
      ) : selectedView === 'categories' ? (
        <CategoryBreakdown categories={visibleData.categories} t={t} />
      ) : selectedView === 'agents' ? (
        <AgentPerformance agents={visibleData.agents} t={t} />
      ) : (
        <CompanyAssistant key={organizationId} organizationId={organizationId} language={language} t={t} />
      )}
    </section>
  );
};

export default AnalyticsScreen;
