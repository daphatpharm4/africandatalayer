import React, { useReducer, useState } from 'react';
import { Check } from 'lucide-react';
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
import type { PlatformRole } from '../../shared/platformTypes';

export interface OnboardingWizardProps {
  language: 'en' | 'fr';
  onDone: (organizationId: string) => void;
}

const STEP_ORDER: WizardState['step'][] = ['org', 'project', 'record_type', 'invite'];

const INVITE_ROLES: Array<Exclude<PlatformRole, 'owner'>> = ['manager', 'reviewer', 'collector', 'viewer'];

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
 * Maps a caught error to a user-facing bilingual message. Slug conflicts can
 * surface as either a 409 (clean uniqueness check) or a 500 (raw unique
 * constraint violation bubbling up) depending on where the request fails.
 */
function describeError(error: unknown, t: (en: string, fr: string) => string): string {
  if (error instanceof PlatformApiError) {
    if (error.status === 409 || error.status === 500) {
      return t('This workspace URL is taken', "Cette URL d'espace est déjà prise");
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

  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const stepIndex = STEP_ORDER.indexOf(state.step);
  const isValid = wizardStepValid(state);

  const setField = (field: 'orgName' | 'orgSlug' | 'projectName' | 'recordTypeLabelEn' | 'recordTypeLabelFr' | 'inviteEmail' | 'inviteRole', value: string) => {
    dispatch({ type: 'SET_FIELD', field, value });
  };

  const handleCreateOrg = async () => {
    setError(null);
    setIsBusy(true);
    try {
      const organization = await createOrganizationRequest({ name: state.orgName.trim(), slug: state.orgSlug });
      dispatch({ type: 'ORG_CREATED', organizationId: organization.id });
    } catch (err) {
      setError(describeError(err, t));
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
      dispatch({ type: 'INVITE_SENT_OR_SKIPPED' });
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSkipInvite = () => {
    setError(null);
    dispatch({ type: 'INVITE_SENT_OR_SKIPPED' });
  };

  // "done" is a transient state — as soon as it's reached, hand off to the
  // parent and never render a "done" screen of our own.
  if (state.step === 'done') {
    if (state.organizationId) onDone(state.organizationId);
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
