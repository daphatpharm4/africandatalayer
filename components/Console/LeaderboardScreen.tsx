import React, { useCallback, useEffect, useState } from 'react';
import { listOrganizationLeaderboardRequest } from '../../lib/client/platformApi';
import type { PlatformLeaderboardEntry } from '../../shared/platformTypes';

interface LeaderboardScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ organizationId, language }) => {
  const [entries, setEntries] = useState<PlatformLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const load = useCallback(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    void listOrganizationLeaderboardRequest(organizationId)
      .then((result) => { if (!cancelled) setEntries(result); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('Leaderboard failed to load.', 'Échec du chargement du classement.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, reloadKey, language]);

  useEffect(load, [load]);

  return (
    <section aria-labelledby="leaderboard-title" className="space-y-5">
      <header>
        <p className="micro-label text-terra">{t('Verified quality', 'Qualité vérifiée')}</p>
        <h1 id="leaderboard-title" className="mt-1 text-2xl font-semibold text-ink">{t('Company leaderboard', 'Classement de l’entreprise')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {t('Ranks contributors using records from this company only.', 'Classe les contributeurs uniquement à partir des données de cette entreprise.')}
        </p>
      </header>

      {error ? (
        <div role="alert" className="card border border-red-200 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-secondary mt-4 h-11">{t('Try again', 'Réessayer')}</button>
        </div>
      ) : entries === null ? (
        <div className="card p-6 text-sm text-ink-muted" role="status">{t('Loading leaderboard…', 'Chargement du classement…')}</div>
      ) : entries.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">{t('No verified contributor activity yet.', 'Aucune activité de contributeur vérifiée pour le moment.')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy-border bg-white">
          <div className="hidden grid-cols-[72px_1fr_120px_120px_120px] gap-3 border-b border-navy-border bg-navy-wash px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted md:grid">
            <span>{t('Rank', 'Rang')}</span><span>{t('Contributor', 'Contributeur')}</span><span>{t('Records', 'Données')}</span><span>{t('Quality', 'Qualité')}</span><span>XP</span>
          </div>
          {entries.map((entry) => (
            <article key={`${entry.rank}-${entry.userId}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-navy-border px-4 py-4 last:border-b-0 md:grid-cols-[72px_1fr_120px_120px_120px] md:px-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-wash text-sm font-bold text-navy">{entry.rank}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{entry.name}</p>
                <p className="mt-1 truncate text-xs text-ink-muted">{entry.lastLocation}</p>
              </div>
              <p className="text-right text-sm font-semibold text-terra md:hidden">{entry.rankingScore} pts</p>
              <p className="hidden text-sm font-semibold text-ink md:block">{entry.contributions}</p>
              <p className="hidden text-sm font-semibold text-forest md:block">{entry.averageQualityScore}%</p>
              <p className="hidden text-sm font-semibold text-terra md:block">{entry.xp}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default LeaderboardScreen;
