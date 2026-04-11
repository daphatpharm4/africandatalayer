import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, TrendingUp, Users, WalletCards } from 'lucide-react';
import ScreenHeader from '../shared/ScreenHeader';
import { apiJson } from '../../lib/client/api';
import type { AdminSubmissionEvent, CollectionAssignment } from '../../shared/types';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

interface KpiSummary {
  activeContributors?: number;
  eventsWithFraudCheck?: number;
  mismatchEvents?: number;
  fraudRatePct?: number;
  pendingReview?: number;
  highRiskEvents?: number;
}

type AgentRow = {
  id: string;
  name: string;
  submissions: number;
  averageQuality: number;
  flagged: number;
  pendingAssignments: number;
  lastSubmissionAt: string | null;
};

function numericDetail(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const AgentPerformance: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [events, setEvents] = useState<AdminSubmissionEvent[]>([]);
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [kpis, setKpis] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [eventData, assignmentData, kpiData] = await Promise.all([
          apiJson<AdminSubmissionEvent[]>('/api/submissions?view=admin_events&scope=global'),
          apiJson<CollectionAssignment[]>('/api/user?view=assignments&scope=all'),
          apiJson<KpiSummary>('/api/analytics?view=kpi_summary'),
        ]);
        if (cancelled) return;
        setEvents(Array.isArray(eventData) ? eventData : []);
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        setKpis(kpiData ?? null);
      } catch {
        if (cancelled) return;
        setEvents([]);
        setAssignments([]);
        setKpis(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentRows = useMemo<AgentRow[]>(() => {
    const rows = new Map<string, AgentRow>();
    for (const item of events) {
      const details = (item.event.details ?? {}) as Record<string, unknown>;
      const quality = numericDetail(details.confidenceScore);
      const riskScore = numericDetail(details.riskScore);
      const current = rows.get(item.user.id) ?? {
        id: item.user.id,
        name: item.user.name || item.user.email || item.user.id,
        submissions: 0,
        averageQuality: 0,
        flagged: 0,
        pendingAssignments: 0,
        lastSubmissionAt: null,
      };
      current.submissions += 1;
      current.averageQuality += quality;
      if (riskScore >= 60) current.flagged += 1;
      if (!current.lastSubmissionAt || new Date(item.event.createdAt).getTime() > new Date(current.lastSubmissionAt).getTime()) {
        current.lastSubmissionAt = item.event.createdAt;
      }
      rows.set(item.user.id, current);
    }

    for (const assignment of assignments) {
      const row = rows.get(assignment.agentUserId) ?? {
        id: assignment.agentUserId,
        name: assignment.agentUserId,
        submissions: 0,
        averageQuality: 0,
        flagged: 0,
        pendingAssignments: 0,
        lastSubmissionAt: null,
      };
      if (assignment.status === 'pending' || assignment.status === 'in_progress') {
        row.pendingAssignments += 1;
      }
      rows.set(assignment.agentUserId, row);
    }

    return [...rows.values()]
      .map((row) => ({
        ...row,
        averageQuality: row.submissions > 0 ? Math.round(row.averageQuality / row.submissions) : 0,
      }))
      .sort((a, b) => {
        if (b.submissions !== a.submissions) return b.submissions - a.submissions;
        return b.averageQuality - a.averageQuality;
      });
  }, [assignments, events]);

  const activeAgents = agentRows.filter((row) => row.submissions > 0).length;
  const avgQuality = agentRows.length > 0 ? Math.round(agentRows.reduce((sum, row) => sum + row.averageQuality, 0) / agentRows.length) : 0;

  return (
    <div className="screen-shell">
      <ScreenHeader title={t('Agent Performance', 'Performance agents')} onBack={onBack} language={language} />

      <div className="p-4 pb-24 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="inline-flex items-center gap-2 micro-label text-gray-400">
              <Users size={12} />
              {t('Active Agents', 'Agents actifs')}
            </div>
            <div className="mt-3 text-3xl font-bold text-navy">{loading ? '--' : activeAgents}</div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="inline-flex items-center gap-2 micro-label text-gray-400">
              <TrendingUp size={12} />
              {t('Avg Quality', 'Qualité moyenne')}
            </div>
            <div className="mt-3 text-3xl font-bold text-forest">{loading ? '--' : `${avgQuality}%`}</div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="inline-flex items-center gap-2 micro-label text-gray-400">
              <ShieldCheck size={12} />
              {t('Fraud Rate', 'Taux fraude')}
            </div>
            <div className="mt-3 text-3xl font-bold text-terra">
              {loading ? '--' : `${Math.round(kpis?.fraudRatePct ?? 0)}%`}
            </div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="inline-flex items-center gap-2 micro-label text-gray-400">
              <WalletCards size={12} />
              {t('Pending Review', 'En attente')}
            </div>
            <div className="mt-3 text-3xl font-bold text-gray-900">{loading ? '--' : Math.round(kpis?.pendingReview ?? 0)}</div>
          </div>
        </div>

        <div className="card-pill p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="micro-label-wide text-gray-400">
                {t('Team Table', 'Table équipe')}
              </div>
              <h4 className="mt-1 text-lg font-bold text-gray-900">
                {t('Review capture quality by agent', 'Examiner la qualité par agent')}
              </h4>
            </div>
            <span className="micro-label text-gray-400">
              {agentRows.length} {t('rows', 'lignes')}
            </span>
          </div>

          <div className="space-y-3">
            {loading && (
              <div className="rounded-2xl border border-gray-100 bg-page p-4 text-xs text-gray-500">
                {t('Loading agent metrics...', 'Chargement des métriques agents...')}
              </div>
            )}
            {!loading && agentRows.length === 0 && (
              <div className="rounded-2xl border border-gray-100 bg-page p-4 text-xs text-gray-500">
                {t('No agent performance data yet.', 'Pas encore de données de performance agents.')}
              </div>
            )}
            {!loading &&
              agentRows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-gray-100 bg-page p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{row.name}</div>
                      <div className="micro-label text-gray-400">{row.id}</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 micro-label text-navy">
                      {row.pendingAssignments} {t('active assignment(s)', 'affectation(s) active(s)')}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <div className="micro-label text-gray-400">{t('Submissions', 'Soumissions')}</div>
                      <div className="mt-1 text-xl font-bold text-gray-900">{row.submissions}</div>
                    </div>
                    <div>
                      <div className="micro-label text-gray-400">{t('Quality', 'Qualité')}</div>
                      <div className="mt-1 text-xl font-bold text-forest">{row.averageQuality}%</div>
                    </div>
                    <div>
                      <div className="micro-label text-gray-400">{t('Flags', 'Drapeaux')}</div>
                      <div className="mt-1 text-xl font-bold text-terra">{row.flagged}</div>
                    </div>
                    <div>
                      <div className="micro-label text-gray-400">{t('Last Seen', 'Dernière activité')}</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {row.lastSubmissionAt
                          ? new Date(row.lastSubmissionAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : t('No submissions', 'Aucune soumission')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPerformance;
