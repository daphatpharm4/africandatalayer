import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { createProjectRequest, listProjectsRequest, PlatformApiError } from '../../lib/client/platformApi';
import type { PlatformProject } from '../../shared/platformTypes';
import type { ConsoleRoute } from '../../lib/client/consoleState';
import ProjectCoverageFields from './ProjectCoverageFields';

export interface ProjectsScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
  onNavigate: (route: ConsoleRoute) => void;
}

/**
 * Same error-copy convention as OnboardingWizard/Task 13: server body.error
 * (via PlatformApiError.message) for 4xx, generic bilingual fallback for 5xx.
 */
function describeError(error: unknown, t: (en: string, fr: string) => string): string {
  if (error instanceof PlatformApiError) {
    if (error.status >= 500) {
      return t('Something went wrong. Please try again.', 'Une erreur est survenue. Veuillez réessayer.');
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : t('Something went wrong. Please try again.', "Une erreur s'est produite. Veuillez réessayer.");
}

function statusLabel(status: PlatformProject['status'], t: (en: string, fr: string) => string): string {
  switch (status) {
    case 'active':
      return t('Active', 'Actif');
    case 'archived':
      return t('Archived', 'Archivé');
    case 'draft':
    default:
      return t('Draft', 'Brouillon');
  }
}

function statusPillClass(status: PlatformProject['status']): string {
  switch (status) {
    case 'active':
      return 'bg-forest-wash text-forest-dark';
    case 'archived':
      return 'bg-navy-light text-ink-muted';
    case 'draft':
    default:
      return 'bg-navy-wash text-navy';
  }
}

function formatDate(iso: string, language: 'en' | 'fr'): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium' });
}

const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ organizationId, language, onNavigate }) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);

  const [projects, setProjects] = useState<PlatformProject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [coverageScope, setCoverageScope] = useState<PlatformProject['coverageScope']>('town');
  const [coverageLabel, setCoverageLabel] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProjects(null);
    setLoadError(null);
    void listProjectsRequest(organizationId)
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(describeError(error, t));
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadKey, t]);

  const handleCreate = async () => {
    const name = newName.trim();
    const normalizedCoverageLabel = coverageLabel.trim();
    if (name.length === 0 || (coverageScope !== 'worldwide' && normalizedCoverageLabel.length < 2)) return;
    setCreateError(null);
    setIsBusy(true);
    try {
      const project = await createProjectRequest({
        organizationId,
        name,
        coverageScope,
        coverageLabel: coverageScope === 'worldwide' ? undefined : normalizedCoverageLabel,
      });
      setProjects((current) => (current ? [project, ...current] : [project]));
      setIsCreating(false);
      setNewName('');
      setCoverageScope('town');
      setCoverageLabel('');
    } catch (error) {
      setCreateError(describeError(error, t));
    } finally {
      setIsBusy(false);
    }
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setNewName('');
    setCoverageScope('town');
    setCoverageLabel('');
    setCreateError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('Projects', 'Projets')}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t(
              'Each project has its own record schema and data.',
              'Chaque projet possède son propre schéma d’enregistrement et ses propres données.',
            )}
          </p>
        </div>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="btn-primary flex shrink-0 items-center justify-center gap-2 px-5"
          >
            <Plus size={18} />
            {t('New project', 'Nouveau projet')}
          </button>
        )}
      </div>

      {isCreating && (
        <div className="card p-5">
          <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="new-project-name">
            {t('Project name', 'Nom du projet')}
          </label>
          <input
            id="new-project-name"
            type="text"
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={isBusy}
            placeholder={t('e.g. Douala Pilot', 'p. ex. Pilote Douala')}
            className="mt-2 h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
          />
          <div className="mt-5">
            <ProjectCoverageFields
              scope={coverageScope}
              label={coverageLabel}
              onScopeChange={(scope) => {
                setCoverageScope(scope);
                if (scope === 'worldwide') setCoverageLabel('');
              }}
              onLabelChange={setCoverageLabel}
              language={language}
              disabled={isBusy}
              idPrefix="new-project"
            />
          </div>
          {createError && (
            <p className="mt-3 text-xs text-danger" role="alert">
              {createError}
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={cancelCreate}
              disabled={isBusy}
              className="btn-ghost flex flex-1 items-center justify-center disabled:opacity-50"
            >
              {t('Cancel', 'Annuler')}
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isBusy || newName.trim().length === 0 || (coverageScope !== 'worldwide' && coverageLabel.trim().length < 2)}
              className="btn-primary flex flex-1 items-center justify-center disabled:opacity-50"
            >
              {isBusy ? t('Creating…', 'Création…') : t('Create', 'Créer')}
            </button>
          </div>
        </div>
      )}

      {projects === null && !loadError && (
        <p className="micro-label text-ink-muted">{t('Loading projects…', 'Chargement des projets…')}</p>
      )}

      {loadError && (
        <div className="card p-6 text-center">
          <p className="text-sm text-danger" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="btn-ghost mt-4 flex w-full items-center justify-center"
          >
            {t('Try again', 'Réessayer')}
          </button>
        </div>
      )}

      {projects !== null && projects.length === 0 && !loadError && (
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-muted">
            {t('No projects yet. Create your first one to define a record schema.', 'Aucun projet pour le moment. Créez le premier pour définir un schéma d’enregistrement.')}
          </p>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <div className="flex flex-col gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onNavigate({ screen: 'SCHEMA_BUILDER', projectId: project.id })}
              className="card flex items-center justify-between gap-4 p-4 text-left transition-colors hover:border-navy"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
                <p className="micro-label mt-1 text-ink-muted">
                  {t('Created', 'Créé le')} {formatDate(project.createdAt, language)}
                </p>
                <p className="micro-label mt-1 text-navy">
                  {(project.coverageScope ?? 'worldwide') === 'worldwide'
                    ? t('Worldwide coverage', 'Couverture mondiale')
                    : project.coverageLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`micro-label rounded-full px-2.5 py-1 text-[10px] ${statusPillClass(project.status)}`}>
                  {statusLabel(project.status, t)}
                </span>
                <ChevronRight size={18} className="text-ink-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsScreen;
