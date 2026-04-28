import React, { useEffect, useMemo, useState } from 'react';
import ScreenHeader from '../shared/ScreenHeader';
import KpiTile from '../shared/KpiTile';
import TrustBadge from '../shared/TrustBadge';
import { apiJson } from '../../lib/client/api';
import type { AdminSubmissionEvent, CollectionAssignment } from '../../shared/types';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [eventData, assignmentData] = await Promise.all([
          apiJson<AdminSubmissionEvent[]>('/api/submissions?view=admin_events&scope=global'),
          apiJson<CollectionAssignment[]>('/api/user?view=assignments&scope=all'),
        ]);
        if (cancelled) return;
        setEvents(Array.isArray(eventData) ? eventData : []);
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      } catch {
        if (cancelled) return;
        setEvents([]);
        setAssignments([]);
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
  const totalSubs = agentRows.reduce((sum, row) => sum + row.submissions, 0);

  return (
    <div data-testid="screen-agent-performance" className="screen-shell">
      <ScreenHeader title={t('Agent Performance', 'Performance agents')} onBack={onBack} language={language} />

      <div className="p-4 pb-24 space-y-4">
        <div className="mb-0.5 grid grid-cols-3 gap-2">
          <KpiTile label={t('Active', 'Actifs')} value={loading ? '--' : activeAgents} tone="navy" />
          <KpiTile label={t('Total Subs', 'Soumissions')} value={loading ? '--' : totalSubs} tone="forest" />
          <KpiTile label={t('Avg Quality', 'Qualité moy.')} value={loading ? '--' : `${avgQuality}%`} tone="amber" />
        </div>

        <div className="micro-label mb-2 text-gray-400">
          {t('Agent rankings', 'Classement des agents')}
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="rounded-2xl border border-gray-100 bg-page p-4 text-xs text-gray-500">
              {t('Loading agent metrics...', 'Chargement des métriques agents...')}
            </div>
          )}
          {!loading && agentRows.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-page px-4 py-5">
              <p className="text-[13px] font-semibold text-gray-700">
                {t('No agent data yet.', 'Aucune donnée agent pour l\'instant.')}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                {t(
                  'Rankings populate after submissions are approved in the review queue.',
                  'Les classements se remplissent après approbation des soumissions dans la file de revue.',
                )}
              </p>
            </div>
          )}
          {!loading &&
            agentRows.map((row, i) => {
              const tier: 'gold' | 'silver' | 'bronze' =
                row.averageQuality >= 85 ? 'gold' : row.averageQuality >= 70 ? 'silver' : 'bronze';
              const tierGradient =
                tier === 'gold'
                  ? 'linear-gradient(135deg,#f4c317,#d97706)'
                  : tier === 'silver'
                    ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
                    : 'linear-gradient(135deg,#c86b4a,#9b2c2c)';
              const barColor =
                row.averageQuality >= 90 ? 'bg-forest-dark' : row.averageQuality >= 70 ? 'bg-amber' : 'bg-red-800';
              const initial = (row.name[0] ?? '?').toUpperCase();
              return (
                <div key={row.id} className="card-soft flex items-center gap-3 p-3">
                  <div className="w-5 text-center text-[13px] font-bold text-gray-300">#{i + 1}</div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                    style={{ background: tierGradient }}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-ink-dark">{row.name}</span>
                      <TrustBadge tier={tier} language={language} />
                    </div>
                    <div className="flex gap-2.5 text-[11px]">
                      <span className="text-gray-500">{row.submissions} {t('subs', 'soum.')}</span>
                      <span className="font-semibold text-forest-dark">{row.averageQuality}% {t('quality', 'qualité')}</span>
                      <span className="font-semibold text-terra">{row.flagged} {t('flags', 'signalés')}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${row.averageQuality}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default AgentPerformance;
