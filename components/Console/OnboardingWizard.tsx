import React, { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle, Copy, MapPinned, Rocket, Smartphone, Users } from 'lucide-react';
import {
  initialWizardState,
  slugFromName,
  wizardRecordTypeDefinition,
  wizardReducer,
  wizardStepValid,
  type WizardState,
} from '../../lib/client/consoleState';
import {
  createInviteRequest,
  createOrganizationRequest,
  createProjectRequest,
  publishSchemaRequest,
  saveSchemaDraftRequest,
  PlatformApiError,
} from '../../lib/client/platformApi';
import { buildFieldLaunchHref } from '../../lib/client/fieldLaunch';
import type { PlatformProjectCoverageScope, PlatformRole } from '../../shared/platformTypes';
import ProjectCoverageFields from './ProjectCoverageFields';

export interface OnboardingWizardProps {
  language: 'en' | 'fr';
  onDone: (organizationId: string) => void;
}

const STEP_ORDER: WizardState['step'][] = ['org', 'project', 'record_type', 'invite'];

const INVITE_ROLES: Array<Exclude<PlatformRole, 'owner'>> = ['manager', 'reviewer', 'collector', 'viewer'];

const STARTER_RECORD_TYPES = [
  { key: 'business', labelEn: 'Business or outlet', labelFr: 'Commerce ou point de vente' },
  { key: 'infrastructure', labelEn: 'Infrastructure asset', labelFr: "Équipement d'infrastructure" },
  { key: 'inspection', labelEn: 'Site inspection', labelFr: 'Inspection de site' },
  { key: 'waste', labelEn: 'Waste point', labelFr: 'Point de déchets' },
] as const;

function inviteRoleLabel(role: Exclude<PlatformRole, 'owner'>, t: (en: string, fr: string) => string): string {
  switch (role) {
    case 'manager':
      return t('Manager', 'Gestionnaire');
    case 'reviewer':
      return t('Reviewer', 'Réviseur');
    case 'collector':
      return t('Collector', 'Collecteur');
    case 'viewer':
      return t('Viewer', 'Observateur');
    default:
      return role;
  }
}

/**
 * Maps a caught error to a user-facing bilingual message.
 *
 * Slug conflicts can surface as either a 409 (clean uniqueness check) or a
 * 500 (raw unique constraint violation bubbling up) depending on where the
 * request fails — but a slug only exists on the org step, so callers must
 * opt in via `slugConflictHint` rather than every step inheriting the copy.
 * For non-org steps, 5xx failures get a generic bilingual fallback while
 * 4xx failures keep the server's own `body.error` message.
 */
function describeError(
  error: unknown,
  t: (en: string, fr: string) => string,
  options: { slugConflictHint?: boolean } = {},
): string {
  if (error instanceof PlatformApiError) {
    if (options.slugConflictHint && (error.status === 409 || error.status === 500)) {
      return t('This workspace URL is taken', "Cette URL d'espace est déjà prise");
    }
    if (error.status >= 500) {
      return t('Something went wrong. Please try again.', 'Une erreur est survenue. Veuillez réessayer.');
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : t('Something went wrong. Please try again.', "Une erreur s'est produite. Veuillez réessayer.");
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ language, onDone }) => {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const doneCalledRef = useRef(false);

  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  // Hand off to the parent exactly once, from an effect (never during
  // render) — the parent's org list reload is async, so this component may
  // stay mounted with step === 'done' across several re-renders while it
  // catches up; the ref guard keeps that from re-firing onDone each time.
  useEffect(() => {
    if (state.step === 'done' && state.organizationId && !doneCalledRef.current) {
      doneCalledRef.current = true;
      onDone(state.organizationId);
    }
  }, [state.step, state.organizationId, onDone]);

  const stepIndex = state.step === 'launch' || state.step === 'done'
    ? STEP_ORDER.length
    : STEP_ORDER.indexOf(state.step);
  const isValid = wizardStepValid(state);
  const recordTypeKey = wizardRecordTypeDefinition(state).recordTypes[0]?.key ?? 'record_type_1';
  const fieldLaunchHref = state.organizationId && state.projectId
    ? buildFieldLaunchHref({
        organizationId: state.organizationId,
        projectId: state.projectId,
        recordTypeKey,
      })
    : '/';

  const setField = (field: 'orgName' | 'orgSlug' | 'projectName' | 'projectCoverageScope' | 'projectCoverageLabel' | 'recordTypeLabelEn' | 'recordTypeLabelFr' | 'inviteEmail' | 'inviteRole', value: string) => {
    dispatch({ type: 'SET_FIELD', field, value });
  };

  const handleCreateOrg = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const organization = await createOrganizationRequest({ name: state.orgName.trim(), slug: state.orgSlug });
      dispatch({ type: 'ORG_CREATED', organizationId: organization.id });
    } catch (err) {
      setError(describeError(err, t, { slugConflictHint: true }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateProject = async () => {
    if (!state.organizationId) return;
    setError(null);
    setIsBusy(true);
    try {
      const project = await createProjectRequest({
        organizationId: state.organizationId,
        name: state.projectName.trim(),
        coverageScope: state.projectCoverageScope,
        coverageLabel: state.projectCoverageScope === 'worldwide' ? undefined : state.projectCoverageLabel.trim(),
      });
      dispatch({ type: 'PROJECT_CREATED', projectId: project.id });
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveRecordType = async () => {
    if (!state.projectId) return;
    setError(null);
    setIsBusy(true);
    try {
      const definition = wizardRecordTypeDefinition(state);
      await saveSchemaDraftRequest({ projectId: state.projectId, definition });
      await publishSchemaRequest(state.projectId);
      dispatch({ type: 'RECORD_TYPE_SAVED' });
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendInvite = async () => {
    if (!state.organizationId) return;
    setError(null);
    setIsBusy(true);
    try {
      if (state.inviteEmail.trim().length > 0) {
        await createInviteRequest({
          organizationId: state.organizationId,
          email: state.inviteEmail.trim(),
          role: state.inviteRole,
        });
      }
      dispatch({ type: 'INVITE_SENT_OR_SKIPPED', invited: state.inviteEmail.trim().length > 0 });
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSkipInvite = () => {
    setError(null);
    dispatch({ type: 'INVITE_SENT_OR_SKIPPED', invited: false });
  };

  const handleCopyFieldLink = async () => {
    try {
      const absoluteHref = new URL(fieldLaunchHref, window.location.origin).href;
      await navigator.clipboard.writeText(absoluteHref);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  };

  // "done" is a transient state — the handoff to the parent happens in the
  // effect above; render nothing while that plays out.
  if (state.step === 'done') {
    return null;
  }

  const steps: Array<{ key: WizardState['step']; en: string; fr: string }> = [
    { key: 'org', en: 'Organization', fr: 'Organisation' },
    { key: 'project', en: 'Project', fr: 'Projet' },
    { key: 'record_type', en: 'Record type', fr: 'Type d’enregistrement' },
    { key: 'invite', en: 'Team', fr: 'Équipe' },
  ];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          {t('Set up your workspace', 'Configurez votre espace de travail')}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t(
            'A few steps to get your data operation running.',
            'Quelques étapes pour lancer votre opération de données.',
          )}
        </p>
      </div>

      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isComplete = index < stepIndex;
          const isCurrent = index === stepIndex;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isComplete
                    ? 'bg-forest text-white'
                    : isCurrent
                      ? 'bg-navy text-white'
                      : 'bg-navy-wash text-ink-muted'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete ? <Check size={16} /> : index + 1}
              </div>
              <span
                className={`micro-label truncate ${isCurrent ? 'text-navy' : 'text-ink-muted'}`}
              >
                {t(step.en, step.fr)}
              </span>
              {index < steps.length - 1 && <div className="h-px flex-1 bg-navy-border" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {state.step === 'launch' && (
        <section className="overflow-hidden rounded-3xl border border-forest/20 bg-white shadow-sm" aria-labelledby="launch-title">
          <div className="bg-forest px-6 py-7 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Rocket size={24} aria-hidden="true" />
            </div>
            <p className="micro-label mt-5 text-white/70">{t('Ready for the field', 'Prêt pour le terrain')}</p>
            <h2 id="launch-title" className="mt-2 text-2xl font-semibold">
              {t(`${state.projectName} is ready`, `${state.projectName} est prêt`)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              {t(
                'You created a real, published collection operation. Test the field experience before your team starts.',
                "Vous avez créé une opération de collecte réelle et publiée. Testez l'expérience terrain avant le démarrage de l'équipe.",
              )}
            </p>
          </div>

          <div className="space-y-5 p-6">
            <ul className="space-y-3">
              {[
                { icon: <MapPinned size={18} />, text: `${state.projectName} · ${state.projectCoverageScope === 'worldwide' ? t('Worldwide', 'Monde entier') : state.projectCoverageLabel}` },
                { icon: <CheckCircle size={18} />, text: t(`${state.recordTypeLabelEn} form published`, `Formulaire ${state.recordTypeLabelFr} publié`) },
                { icon: <Users size={18} />, text: state.inviteSent ? t(`Invitation sent to ${state.inviteEmail}`, `Invitation envoyée à ${state.inviteEmail}`) : t('Team invitation can be added later', "L'invitation de l'équipe peut être ajoutée plus tard") },
              ].map((item) => (
                <li key={item.text} className="flex min-h-12 items-center gap-3 rounded-2xl bg-page px-4 py-3 text-sm font-medium text-ink">
                  <span className="text-forest" aria-hidden="true">{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl border border-navy-border bg-navy-wash p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 shrink-0 text-navy" size={20} aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-navy">{t('Field handoff', 'Passage au terrain')}</h3>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    {t(
                      'This secure link opens the published form after ADL confirms the signed-in user has access.',
                      "Ce lien ouvre le formulaire publié après vérification par ADL de l'accès de l'utilisateur connecté.",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyFieldLink()}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 text-sm font-semibold text-navy"
              >
                <Copy size={16} aria-hidden="true" />
                {linkCopied ? t('Link copied', 'Lien copié') : t('Copy field link', 'Copier le lien terrain')}
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {linkCopied ? t('Field link copied to clipboard', 'Lien terrain copié dans le presse-papiers') : ''}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'COMPLETE' })}
                className="btn-ghost flex min-h-12 items-center justify-center"
              >
                {t('Go to workspace', "Accéder à l'espace")}
              </button>
              <a
                href={fieldLaunchHref}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex min-h-12 items-center justify-center gap-2 text-center"
              >
                {t('Run a test capture', 'Tester une collecte')}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      )}

      {state.step === 'org' && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink">
            {t('Name your organization', 'Nommez votre organisation')}
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-org-name">
                {t('Organization name', "Nom de l'organisation")}
              </label>
              <input
                id="wizard-org-name"
                type="text"
                value={state.orgName}
                onChange={(event) => setField('orgName', event.target.value)}
                disabled={isBusy}
                placeholder={t('e.g. Acme Field Ops', 'p. ex. Acme Field Ops')}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-org-slug">
                {t('Workspace URL', "URL de l'espace de travail")}
              </label>
              <div className="group relative flex h-14 items-center rounded-2xl border border-gray-100 bg-white pl-4 pr-4 shadow-sm transition-all focus-within:border-navy">
                <span className="shrink-0 text-sm text-gray-400">adl.app/</span>
                <input
                  id="wizard-org-slug"
                  type="text"
                  value={state.orgSlug}
                  onChange={(event) => setField('orgSlug', slugFromName(event.target.value))}
                  disabled={isBusy}
                  className="h-full w-full bg-transparent text-base text-gray-900 focus:outline-none disabled:bg-transparent"
                />
              </div>
            </div>
          </div>
          {error && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleCreateOrg()}
            disabled={!isValid || isBusy}
            className="btn-primary mt-6 flex w-full items-center justify-center disabled:opacity-50"
          >
            {isBusy ? t('Creating…', 'Création…') : t('Continue', 'Continuer')}
          </button>
        </div>
      )}

      {state.step === 'project' && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink">
            {t('Create your first project', 'Créez votre premier projet')}
          </h2>
          <div className="mt-4 space-y-2">
            <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-project-name">
              {t('Project name', 'Nom du projet')}
            </label>
            <input
              id="wizard-project-name"
              type="text"
              value={state.projectName}
              onChange={(event) => setField('projectName', event.target.value)}
              disabled={isBusy}
              placeholder={t('e.g. Douala Pilot', 'p. ex. Pilote Douala')}
              className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
            />
          </div>
          <div className="mt-5">
            <ProjectCoverageFields
              scope={state.projectCoverageScope}
              label={state.projectCoverageLabel}
              onScopeChange={(scope: PlatformProjectCoverageScope) => {
                setField('projectCoverageScope', scope);
                if (scope === 'worldwide') setField('projectCoverageLabel', '');
              }}
              onLabelChange={(label) => setField('projectCoverageLabel', label)}
              language={language}
              disabled={isBusy}
              idPrefix="wizard-project"
            />
          </div>
          {error && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleCreateProject()}
            disabled={!isValid || isBusy}
            className="btn-primary mt-6 flex w-full items-center justify-center disabled:opacity-50"
          >
            {isBusy ? t('Creating…', 'Création…') : t('Continue', 'Continuer')}
          </button>
        </div>
      )}

      {state.step === 'record_type' && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink">
            {t('Define your first record type', 'Définissez votre premier type d’enregistrement')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t(
              'What will your team record in the field? You can refine fields later.',
              'Que va enregistrer votre équipe sur le terrain ? Vous pourrez affiner les champs plus tard.',
            )}
          </p>
          <fieldset className="mt-4">
            <legend className="px-1 text-xs font-semibold text-gray-500">
              {t('Choose a useful starting point', 'Choisissez un point de départ utile')}
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTER_RECORD_TYPES.map((template) => {
                const active = state.recordTypeLabelEn === template.labelEn && state.recordTypeLabelFr === template.labelFr;
                return (
                  <button
                    key={template.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setField('recordTypeLabelEn', template.labelEn);
                      setField('recordTypeLabelFr', template.labelFr);
                    }}
                    disabled={isBusy}
                    className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${active ? 'border-navy bg-navy text-white' : 'border-navy-border bg-white text-ink hover:bg-navy-wash'}`}
                  >
                    {t(template.labelEn, template.labelFr)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-record-type-en">
                {t('Label (English)', 'Libellé (anglais)')}
              </label>
              <input
                id="wizard-record-type-en"
                type="text"
                value={state.recordTypeLabelEn}
                onChange={(event) => setField('recordTypeLabelEn', event.target.value)}
                disabled={isBusy}
                placeholder={t('e.g. Pharmacy', 'p. ex. Pharmacy')}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-record-type-fr">
                {t('Label (French)', 'Libellé (français)')}
              </label>
              <input
                id="wizard-record-type-fr"
                type="text"
                value={state.recordTypeLabelFr}
                onChange={(event) => setField('recordTypeLabelFr', event.target.value)}
                disabled={isBusy}
                placeholder={t('e.g. Pharmacie', 'p. ex. Pharmacie')}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
              />
            </div>
          </div>
          {error && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSaveRecordType()}
            disabled={!isValid || isBusy}
            className="btn-primary mt-6 flex w-full items-center justify-center disabled:opacity-50"
          >
            {isBusy ? t('Saving…', 'Enregistrement…') : t('Continue', 'Continuer')}
          </button>
        </div>
      )}

      {state.step === 'invite' && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink">
            {t('Invite your team', 'Invitez votre équipe')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t(
              'Optional — you can always invite people later from Members.',
              'Facultatif — vous pourrez toujours inviter des personnes plus tard depuis Membres.',
            )}
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-invite-email">
                {t('Email', 'Email')}
              </label>
              <input
                id="wizard-invite-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={state.inviteEmail}
                onChange={(event) => setField('inviteEmail', event.target.value)}
                disabled={isBusy}
                placeholder={t('teammate@example.com', 'collegue@exemple.com')}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="wizard-invite-role">
                {t('Role', 'Rôle')}
              </label>
              <select
                id="wizard-invite-role"
                value={state.inviteRole}
                onChange={(event) => setField('inviteRole', event.target.value)}
                disabled={isBusy}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all focus:border-navy focus:outline-none disabled:bg-gray-50"
              >
                {INVITE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {inviteRoleLabel(role, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleSkipInvite}
              disabled={isBusy}
              className="btn-ghost flex flex-1 items-center justify-center disabled:opacity-50"
            >
              {t('Skip for now', 'Ignorer pour le moment')}
            </button>
            <button
              type="button"
              onClick={() => void handleSendInvite()}
              disabled={isBusy}
              className="btn-primary flex flex-1 items-center justify-center disabled:opacity-50"
            >
              {isBusy ? t('Sending…', 'Envoi…') : t('Send invite', "Envoyer l'invitation")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingWizard;
