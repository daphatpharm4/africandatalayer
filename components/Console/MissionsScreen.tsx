import React, { useCallback, useEffect, useState } from 'react';
import { listOrganizationMissionsRequest } from '../../lib/client/platformApi';
import type { PlatformMission, MissionState } from '../../shared/platformTypes';

interface MissionsScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
}

const stateClasses: Record<MissionState, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-800',
  completed: 'bg-green-50 text-green-800',
  expired: 'bg-red-50 text-red-700',
};

const stateLabels: Record<MissionState, { en: string; fr: string }> = {
  pending: { en: 'Pending', fr: 'À venir' },
  in_progress: { en: 'In progress', fr: 'En cours' },
  completed: { en: 'Completed', fr: 'Terminée' },
  expired: { en: 'Expired', fr: 'Expirée' },
};

const MissionsScreen: React.FC<MissionsScreenProps> = ({ organizationId, language }) => {
  const [missions, setMissions] = useState<PlatformMission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const load = useCallback(() => {
    let cancelled = false;
    setMissions(null);
    setError(null);
    void listOrganizationMissionsRequest(organizationId)
      .then((result) => {
        if (!cancelled) setMissions(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('Missions failed to load.', 'Échec du chargement des missions.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, reloadKey, language]);

  useEffect(load, [load]);

  return (
    <section aria-labelledby="missions-title" className="space-y-5">
      <header>
        <p className="micro-label text-terra">{t('Contribution momentum', 'Dynamique de contribution')}</p>
        <h1 id="missions-title" className="mt-1 text-2xl font-semibold text-ink">{t('Missions', 'Missions')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {t('Targets and verified progress for this company only.', 'Objectifs et progression vérifiée pour cette entreprise uniquement.')}
        </p>
      </header>

      {error ? (
        <div role="alert" className="card border border-red-200 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-secondary mt-4">
            {t('Try again', 'Réessayer')}
          </button>
        </div>
      ) : missions === null ? (
        <div className="card p-6 text-sm text-ink-muted" role="status">{t('Loading missions…', 'Chargement des missions…')}</div>
      ) : missions.length === 0 ? (
        <div className="card p-6">
          <h2 className="font-semibold text-ink">{t('No active missions', 'Aucune mission active')}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t('New company missions will appear here.', 'Les nouvelles missions de l’entreprise apparaîtront ici.')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {missions.map((mission) => {
            const progress = mission.quota > 0 ? Math.min(100, Math.round((mission.current / mission.quota) * 100)) : 0;
            return (
              <article key={mission.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="micro-label text-ink-muted">{mission.period === 'daily' ? t('Daily', 'Quotidienne') : t('Weekly', 'Hebdomadaire')}</p>
                    <h2 className="mt-1 text-lg font-semibold text-ink">{language === 'fr' ? mission.titleFr : mission.titleEn}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stateClasses[mission.state]}`}>
                    {stateLabels[mission.state][language]}
                  </span>
                </div>
                {(language === 'fr' ? mission.notesFr : mission.notesEn) && (
                  <p className="mt-3 text-sm leading-6 text-ink-muted">{language === 'fr' ? mission.notesFr : mission.notesEn}</p>
                )}
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl font-bold text-navy">{mission.current}<span className="text-base font-medium text-ink-muted"> / {mission.quota}</span></p>
                    <p className="mt-1 text-xs text-ink-muted">{t('verified records', 'enregistrements vérifiés')}</p>
                  </div>
                  <p className="text-sm font-semibold text-terra">+{mission.rewardXp} XP</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-wash" aria-label={`${progress}%`}>
                  <div className="h-full rounded-full bg-forest" style={{ width: `${progress}%` }} />
                </div>
                {mission.deadline && (
                  <p className="mt-3 text-xs text-ink-muted">{t('Due', 'Échéance')} {new Date(mission.deadline).toLocaleDateString(language)}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MissionsScreen;
