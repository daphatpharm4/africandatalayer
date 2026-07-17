import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Database,
  FolderKanban,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import {
  listAdminOrganizationsRequest,
  updateAdminOrganizationAccessRequest,
} from '../../lib/client/platformApi';
import type {
  PlatformAdminOrganizationSummary,
  PlatformOrganizationAccessStatus,
} from '../../shared/platformTypes';

interface Props {
  language: 'en' | 'fr';
}

type StatusFilter = 'all' | PlatformOrganizationAccessStatus;

function formatDate(value: string | null, language: 'en' | 'fr'): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const CompaniesAdminPanel: React.FC<Props> = ({ language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    organizationId: string;
    accessStatus: PlatformOrganizationAccessStatus;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadOrganizations = useCallback(async () => {
    setLoadError('');
    try {
      setOrganizations(await listAdminOrganizationsRequest());
    } catch (error) {
      setOrganizations([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : language === 'fr'
            ? 'Impossible de charger les entreprises.'
            : 'Unable to load companies.',
      );
    }
  }, [language]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  const filteredOrganizations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (organizations ?? []).filter((organization) => {
      if (statusFilter !== 'all' && organization.accessStatus !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [organization.name, organization.slug, ...organization.members.flatMap((member) => [
        member.name,
        member.email ?? '',
        member.phone ?? '',
        member.userId,
      ])].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [organizations, query, statusFilter]);

  const activeCount = organizations?.filter((organization) => organization.accessStatus === 'active').length ?? 0;
  const suspendedCount = organizations?.filter((organization) => organization.accessStatus === 'suspended').length ?? 0;
  const totalRecords = organizations?.reduce((sum, organization) => sum + organization.recordCount, 0) ?? 0;

  const beginAction = (organizationId: string, accessStatus: PlatformOrganizationAccessStatus) => {
    setPendingAction({ organizationId, accessStatus });
    setReason('');
    setActionError('');
  };

  const cancelAction = () => {
    if (isSaving) return;
    setPendingAction(null);
    setReason('');
    setActionError('');
  };

  const applyAccessChange = async () => {
    if (!pendingAction || isSaving) return;
    const normalizedReason = reason.trim();
    if (pendingAction.accessStatus === 'suspended' && normalizedReason.length < 3) return;

    setIsSaving(true);
    setActionError('');
    try {
      const updated = await updateAdminOrganizationAccessRequest({
        organizationId: pendingAction.organizationId,
        accessStatus: pendingAction.accessStatus,
        reason: pendingAction.accessStatus === 'suspended' ? normalizedReason : undefined,
      });
      setOrganizations((current) => (current ?? []).map((organization) => (
        organization.id === updated.id
          ? {
              ...organization,
              accessStatus: updated.accessStatus,
              suspensionReason: updated.suspensionReason,
              suspendedAt: updated.suspendedAt,
              suspendedBy: updated.suspendedBy,
            }
          : organization
      )));
      setPendingAction(null);
      setReason('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to change company access.', 'Impossible de modifier l’accès de l’entreprise.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="admin-companies-panel" aria-labelledby="admin-companies-title">
      <div className="card route-grid-soft p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="micro-label-wide text-navy">{t('Platform access', 'Accès plateforme')}</div>
            <h2 id="admin-companies-title" className="mt-1 text-xl font-bold text-ink-dark">
              {t('Companies', 'Entreprises')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              {t(
                'See every company, user role, project and data volume. Suspension preserves all data while stopping company access.',
                'Consultez chaque entreprise, rôle utilisateur, projet et volume de données. La suspension conserve toutes les données tout en bloquant l’accès.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOrganizations()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <RefreshCw size={17} aria-hidden="true" />
            {t('Refresh', 'Actualiser')}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [t('Companies', 'Entreprises'), organizations?.length ?? 0, Building2],
            [t('Active', 'Actives'), activeCount, CheckCircle2],
            [t('Suspended', 'Suspendues'), suspendedCount, ShieldAlert],
            [t('Company records', 'Données entreprises'), totalRecords, Database],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof Building2;
            return (
              <div key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-3">
                <MetricIcon size={18} className="text-navy" aria-hidden="true" />
                <div className="mt-2 text-xl font-bold text-ink-dark">{Number(value).toLocaleString()}</div>
                <div className="text-xs font-semibold text-gray-500">{String(label)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="relative block">
            <span className="sr-only">{t('Search companies or users', 'Rechercher une entreprise ou un utilisateur')}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search companies or users', 'Rechercher entreprises ou utilisateurs')}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-ink-dark focus:border-navy focus:outline-none"
            />
          </label>
          <label>
            <span className="sr-only">{t('Filter by access status', 'Filtrer par statut d’accès')}</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-ink-dark focus:border-navy focus:outline-none"
            >
              <option value="all">{t('All access states', 'Tous les statuts')}</option>
              <option value="active">{t('Active', 'Actives')}</option>
              <option value="suspended">{t('Suspended', 'Suspendues')}</option>
            </select>
          </label>
        </div>
      </div>

      {organizations === null && (
        <div className="card p-6 text-sm text-gray-600" role="status">
          {t('Loading companies…', 'Chargement des entreprises…')}
        </div>
      )}

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {loadError}
        </div>
      )}

      {organizations !== null && !loadError && filteredOrganizations.length === 0 && (
        <div className="card p-6 text-center text-sm text-gray-600">
          {t('No companies match these filters.', 'Aucune entreprise ne correspond à ces filtres.')}
        </div>
      )}

      <div className="space-y-3">
        {filteredOrganizations.map((organization) => {
          const isExpanded = expandedId === organization.id;
          const isSuspended = organization.accessStatus === 'suspended';
          const action = pendingAction?.organizationId === organization.id ? pendingAction : null;
          return (
            <article
              key={organization.id}
              className={`card overflow-hidden border ${isSuspended ? 'border-amber-300' : 'border-gray-100'}`}
              data-testid={`admin-company-${organization.id}`}
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-navy-wash text-lg font-bold text-navy">
                      {organization.logoUrl
                        ? <img src={organization.logoUrl} alt="" className="h-full w-full object-contain" />
                        : organization.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-bold text-ink-dark">{organization.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          isSuspended ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'
                        }`}>
                          {isSuspended ? t('Suspended', 'Suspendue') : t('Active', 'Active')}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-500">{organization.slug}</p>
                      {isSuspended && (
                        <p className="mt-2 text-sm font-medium text-amber-900">
                          {organization.suspensionReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : organization.id)}
                      aria-expanded={isExpanded}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      {t('Access and data', 'Accès et données')}
                      <ChevronDown size={17} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => beginAction(organization.id, isSuspended ? 'active' : 'suspended')}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
                        isSuspended ? 'bg-forest text-white' : 'border border-amber-300 bg-amber-50 text-amber-950'
                      }`}
                    >
                      <Power size={17} aria-hidden="true" />
                      {isSuspended ? t('Reactivate', 'Réactiver') : t('Suspend', 'Suspendre')}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    [Users, organization.memberCount, t('Users', 'Utilisateurs')],
                    [FolderKanban, organization.projectCount, t('Projects', 'Projets')],
                    [Database, organization.recordCount, t('Records', 'Données')],
                    [AlertTriangle, organization.pendingReviewCount, t('Pending review', 'À réviser')],
                  ].map(([Icon, value, label]) => {
                    const SummaryIcon = Icon as typeof Users;
                    return (
                      <div key={String(label)} className="rounded-xl bg-page p-3">
                        <SummaryIcon size={16} className="text-gray-500" aria-hidden="true" />
                        <div className="mt-1 text-lg font-bold text-ink-dark">{Number(value).toLocaleString()}</div>
                        <div className="text-[11px] font-semibold text-gray-500">{String(label)}</div>
                      </div>
                    );
                  })}
                </div>

                {action && (
                  <div className={`mt-4 rounded-2xl border p-4 ${action.accessStatus === 'suspended' ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-ink-dark">
                          {action.accessStatus === 'suspended'
                            ? t('Suspend company access?', 'Suspendre l’accès de l’entreprise ?')
                            : t('Reactivate company access?', 'Réactiver l’accès de l’entreprise ?')}
                        </h4>
                        <p className="mt-1 text-sm text-gray-700">
                          {action.accessStatus === 'suspended'
                            ? t('Users will immediately lose company access. Projects and data will remain stored.', 'Les utilisateurs perdront immédiatement l’accès. Les projets et données resteront conservés.')
                            : t('Company users will regain access to their authorized projects and data.', 'Les utilisateurs retrouveront l’accès à leurs projets et données autorisés.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={cancelAction}
                        aria-label={t('Cancel access change', 'Annuler la modification d’accès')}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                      >
                        <X size={19} aria-hidden="true" />
                      </button>
                    </div>

                    {action.accessStatus === 'suspended' && (
                      <label className="mt-4 block">
                        <span className="text-xs font-bold text-gray-700">{t('Suspension reason', 'Motif de suspension')}</span>
                        <textarea
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          maxLength={500}
                          rows={3}
                          placeholder={t('Example: Subscription payment overdue', 'Exemple : paiement de l’abonnement en retard')}
                          className="mt-2 w-full rounded-2xl border border-amber-300 bg-white p-3 text-sm text-ink-dark focus:border-navy focus:outline-none"
                        />
                      </label>
                    )}

                    {actionError && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{actionError}</p>}
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={cancelAction}
                        disabled={isSaving}
                        className="min-h-12 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 disabled:opacity-50"
                      >
                        {t('Cancel', 'Annuler')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyAccessChange()}
                        disabled={isSaving || (action.accessStatus === 'suspended' && reason.trim().length < 3)}
                        className={`min-h-12 rounded-2xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                          action.accessStatus === 'suspended' ? 'bg-amber-800' : 'bg-forest'
                        }`}
                      >
                        {isSaving
                          ? t('Saving…', 'Enregistrement…')
                          : action.accessStatus === 'suspended'
                            ? t('Confirm suspension', 'Confirmer la suspension')
                            : t('Confirm reactivation', 'Confirmer la réactivation')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-page p-4 sm:p-5">
                  {isSuspended && (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <div className="font-bold">{t('Access suspended', 'Accès suspendu')}</div>
                      <div className="mt-1">{t('Since', 'Depuis')} {formatDate(organization.suspendedAt, language)} · {t('By', 'Par')} {organization.suspendedBy ?? '—'}</div>
                    </div>
                  )}

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-ink-dark">
                        <Users size={17} aria-hidden="true" />
                        {t('Users and access', 'Utilisateurs et accès')}
                      </h4>
                      <div className="mt-3 space-y-2">
                        {organization.members.length === 0 && <p className="text-sm text-gray-500">{t('No users.', 'Aucun utilisateur.')}</p>}
                        {organization.members.map((member) => {
                          const userSuspended = member.suspendedUntil ? new Date(member.suspendedUntil).getTime() > Date.now() : false;
                          return (
                            <div key={member.userId} className="rounded-2xl border border-gray-100 bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-ink-dark">{member.name || member.userId}</div>
                                  <div className="mt-0.5 break-all text-xs text-gray-500">{member.email ?? member.phone ?? member.userId}</div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="rounded-full bg-navy-wash px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-navy">{member.role}</span>
                                  {userSuspended && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-800">{t('User suspended', 'Utilisateur suspendu')}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-ink-dark">
                        <FolderKanban size={17} aria-hidden="true" />
                        {t('Projects and data', 'Projets et données')}
                      </h4>
                      <div className="mt-3 space-y-2">
                        {organization.projects.length === 0 && <p className="text-sm text-gray-500">{t('No projects.', 'Aucun projet.')}</p>}
                        {organization.projects.map((project) => (
                          <div key={project.id} className="rounded-2xl border border-gray-100 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold text-ink-dark">{project.name}</div>
                                <div className="mt-0.5 text-xs text-gray-500">
                                  {project.coverageScope === 'worldwide'
                                    ? t('Worldwide', 'Monde entier')
                                    : project.coverageLabel ?? project.coverageScope}
                                </div>
                              </div>
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">{project.status}</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {[
                                [t('Total', 'Total'), project.recordCount],
                                [t('Pending', 'En attente'), project.pendingReviewCount],
                                [t('Approved', 'Approuvées'), project.approvedCount],
                                [t('Rejected', 'Rejetées'), project.rejectedCount],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="rounded-xl bg-page p-2">
                                  <dt className="text-[10px] font-semibold text-gray-500">{String(label)}</dt>
                                  <dd className="mt-0.5 text-sm font-bold text-ink-dark">{Number(value).toLocaleString()}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CompaniesAdminPanel;
