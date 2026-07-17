import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Trash2, UserPlus } from 'lucide-react';
import {
  createInviteRequest,
  listOrgMembersRequest,
  removeMemberRequest,
  updateMemberRequest,
  PlatformApiError,
} from '../../lib/client/platformApi';
import type { PlatformInvite, PlatformMembership, PlatformRole } from '../../shared/platformTypes';

export interface MembersScreenProps {
  organizationId: string;
  viewerRole: PlatformRole;
  viewerUserId: string | null;
  language: 'en' | 'fr';
}

const ALL_ROLES: PlatformRole[] = ['owner', 'manager', 'reviewer', 'collector', 'viewer'];
const INVITE_ROLES: Array<Exclude<PlatformRole, 'owner'>> = ['manager', 'reviewer', 'collector', 'viewer'];

function roleLabel(role: PlatformRole, t: (en: string, fr: string) => string): string {
  switch (role) {
    case 'owner':
      return t('Owner', 'Propriétaire');
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
 * Same error-copy convention as ProjectsScreen/OnboardingWizard (Tasks 13-14):
 * server body.error (via PlatformApiError.message) for 4xx, generic bilingual
 * fallback for 5xx. member_update/member_remove surface a 409 "last_owner"
 * code that gets its own copy rather than the raw server message.
 */
function describeError(
  error: unknown,
  t: (en: string, fr: string) => string,
  options: { lastOwnerHint?: boolean } = {},
): string {
  if (error instanceof PlatformApiError) {
    if (options.lastOwnerHint && error.status === 409) {
      return t(
        'An organization needs at least one owner',
        'Une organisation doit avoir au moins un propriétaire',
      );
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

function formatDate(iso: string, language: 'en' | 'fr'): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium' });
}

const MembersScreen: React.FC<MembersScreenProps> = ({ organizationId, viewerRole, viewerUserId, language }) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);
  const isOwner = viewerRole === 'owner';

  const [members, setMembers] = useState<PlatformMembership[] | null>(null);
  const [invites, setInvites] = useState<PlatformInvite[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [rowBusyUserId, setRowBusyUserId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<PlatformRole, 'owner'>>('collector');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMembers(null);
    setInvites(null);
    setLoadError(null);
    void listOrgMembersRequest(organizationId)
      .then((result) => {
        if (cancelled) return;
        setMembers(result.members);
        setInvites(result.invites);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(describeError(error, t));
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadKey, t]);

  const handleRoleChange = async (userId: string, role: PlatformRole) => {
    setRowError(null);
    setRowBusyUserId(userId);
    try {
      await updateMemberRequest({ organizationId, userId, role });
      setMembers((current) => (current ? current.map((m) => (m.userId === userId ? { ...m, role } : m)) : current));
    } catch (error) {
      setRowError(describeError(error, t, { lastOwnerHint: true }));
    } finally {
      setRowBusyUserId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    const confirmed = window.confirm(
      t('Remove this member from the organization?', 'Retirer ce membre de l’organisation ?'),
    );
    if (!confirmed) return;
    setRowError(null);
    setRowBusyUserId(userId);
    try {
      await removeMemberRequest({ organizationId, userId });
      setMembers((current) => (current ? current.filter((m) => m.userId !== userId) : current));
    } catch (error) {
      setRowError(describeError(error, t, { lastOwnerHint: true }));
    } finally {
      setRowBusyUserId(null);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (email.length === 0) return;
    setInviteError(null);
    setIsInviting(true);
    try {
      const invite = await createInviteRequest({ organizationId, email, role: inviteRole });
      setInvites((current) => (current ? [invite, ...current] : [invite]));
      setInviteEmail('');
    } catch (error) {
      setInviteError(describeError(error, t));
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('Members', 'Membres')}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t(
            'Manage who has access to this organization and what they can do.',
            'Gérez qui a accès à cette organisation et ce que chacun peut faire.',
          )}
        </p>
      </div>

      {members === null && !loadError && (
        <p className="micro-label text-ink-muted">{t('Loading members…', 'Chargement des membres…')}</p>
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

      {members !== null && (
        <div className="flex flex-col gap-3">
          {members.map((member) => {
            const isSelf = viewerUserId !== null && member.userId === viewerUserId;
            const isRowBusy = rowBusyUserId === member.userId;
            return (
              <div key={member.userId} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{member.userId}</p>
                  <p className="micro-label mt-1 text-ink-muted">
                    {t('Member since', 'Membre depuis')} {formatDate(member.createdAt, language)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {isOwner ? (
                    <select
                      aria-label={t('Role', 'Rôle')}
                      value={member.role}
                      disabled={isSelf || isRowBusy}
                      onChange={(event) => void handleRoleChange(member.userId, event.target.value as PlatformRole)}
                      className="h-10 rounded-xl border border-navy-border bg-white px-3 text-sm text-ink disabled:opacity-50"
                    >
                      {ALL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role, t)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="micro-label rounded-full bg-navy-wash px-2.5 py-1 text-[10px] text-navy">
                      {roleLabel(member.role, t)}
                    </span>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(member.userId)}
                      disabled={isRowBusy}
                      aria-label={t('Remove member', 'Retirer le membre')}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-navy-border text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-sm text-ink-muted">{t('No members yet.', 'Aucun membre pour le moment.')}</p>
            </div>
          )}
          {rowError && (
            <p className="text-xs text-danger" role="alert">
              {rowError}
            </p>
          )}
        </div>
      )}

      {invites !== null && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">{t('Pending invites', 'Invitations en attente')}</h2>
          {invites.length === 0 && (
            <p className="text-sm text-ink-muted">{t('No pending invites.', 'Aucune invitation en attente.')}</p>
          )}
          {invites.map((invite) => {
            const accepted = invite.acceptedAt !== null;
            return (
              <div key={invite.id} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{invite.email}</p>
                  <p className="micro-label mt-1 text-ink-muted">
                    {roleLabel(invite.role, t)}
                    {' · '}
                    {accepted
                      ? `${t('Accepted', 'Acceptée')} ${formatDate(invite.acceptedAt as string, language)}`
                      : `${t('Expires', 'Expire le')} ${formatDate(invite.expiresAt, language)}`}
                  </p>
                </div>
                <span
                  className={`micro-label shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                    accepted ? 'bg-forest-wash text-forest-dark' : 'bg-navy-wash text-navy'
                  }`}
                >
                  {accepted ? t('Accepted', 'Acceptée') : t('Pending', 'En attente')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isOwner && (
        <div className="card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UserPlus size={16} />
            {t('Invite someone', 'Inviter quelqu’un')}
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="invite-email">
                {t('Email', 'Email')}
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  disabled={isInviting}
                  placeholder={t('teammate@example.com', 'collegue@exemple.com')}
                  className="h-14 w-full rounded-2xl border border-gray-100 bg-white pl-11 pr-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="px-1 text-xs font-semibold text-gray-500" htmlFor="invite-role">
                {t('Role', 'Rôle')}
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Exclude<PlatformRole, 'owner'>)}
                disabled={isInviting}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all focus:border-navy focus:outline-none disabled:bg-gray-50"
              >
                {INVITE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {inviteError && (
            <p className="mt-4 text-xs text-danger" role="alert">
              {inviteError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleInvite()}
            disabled={isInviting || inviteEmail.trim().length === 0}
            className="btn-cta mt-4 flex w-full items-center justify-center disabled:opacity-50"
          >
            {isInviting ? t('Sending…', 'Envoi…') : t('Send invite', "Envoyer l'invitation")}
          </button>
        </div>
      )}
    </div>
  );
};

export default MembersScreen;
