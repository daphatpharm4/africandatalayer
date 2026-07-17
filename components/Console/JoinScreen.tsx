import React, { useCallback, useEffect, useRef, useState } from 'react';
import { acceptInviteRequest, PlatformApiError } from '../../lib/client/platformApi';
import {
  clearConsoleInviteReturn,
  saveConsoleInviteReturn,
} from '../../lib/client/inviteReturn';

export interface JoinScreenProps {
  token: string | undefined;
  hasSession: boolean;
  language: 'en' | 'fr';
  onJoined: (organizationId: string) => void;
  onSignOut: () => void;
  signOutPending: boolean;
  signOutError: string | null;
}

type AcceptStatus = 'loading' | 'expired' | 'invalid' | 'mismatch' | 'already-member' | 'error';

const JoinScreen: React.FC<JoinScreenProps> = ({
  token,
  hasSession,
  language,
  onJoined,
  onSignOut,
  signOutPending,
  signOutError,
}) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);

  const [status, setStatus] = useState<AcceptStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // StrictMode double-fires effects in dev — this ref makes the accept call
  // one-shot regardless of how many times the effect below runs.
  const acceptCalledRef = useRef(false);

  const runAccept = useCallback(
    (inviteToken: string) => {
      setStatus('loading');
      setErrorMessage(null);
      void acceptInviteRequest(inviteToken)
        .then(({ organizationId }) => {
          clearConsoleInviteReturn();
          onJoined(organizationId);
        })
        .catch((error) => {
          if (error instanceof PlatformApiError) {
            if (error.status === 410) {
              setStatus('expired');
              return;
            }
            if (error.status === 404) {
              setStatus('invalid');
              return;
            }
            if (error.code === 'platform_invite_email_mismatch') {
              setStatus('mismatch');
              return;
            }
            if (error.code === 'platform_invite_already_member') {
              setStatus('already-member');
              return;
            }
          }
          setStatus('error');
          setErrorMessage(
            error instanceof PlatformApiError && error.status < 500
              ? error.message
              : t('Something went wrong. Please try again.', "Une erreur s'est produite. Veuillez réessayer."),
          );
        });
    },
    [onJoined, t],
  );

  useEffect(() => {
    if (!hasSession || !token) return;
    if (acceptCalledRef.current) return;
    acceptCalledRef.current = true;
    runAccept(token);
  }, [hasSession, token, runAccept]);

  const handleRetry = () => {
    if (!token) return;
    runAccept(token);
  };

  const handleAuthenticate = () => {
    if (!token || !saveConsoleInviteReturn(token)) return;
    try {
      const hasAuthenticated = localStorage.getItem('adl_has_authenticated') === 'true';
      sessionStorage.setItem('adl_auth_initial_mode', hasAuthenticated ? 'signin' : 'signup');
    } catch {
      // The invite return itself was saved; use the default auth mode.
    }
    window.location.assign('/');
  };

  if (!hasSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">{t('Sign in required', 'Connexion requise')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'Sign in or create the invited account. We will return you here automatically and connect you to the organization.',
              "Connectez-vous ou créez le compte invité. Vous reviendrez ici automatiquement pour rejoindre l'organisation.",
            )}
          </p>
          <button type="button" onClick={handleAuthenticate} className="btn-primary mt-5 flex w-full items-center justify-center">
            {t('Continue with invited account', 'Continuer avec le compte invité')}
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">{t('Invalid invite link', "Lien d'invitation invalide")}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'This invite link is missing or malformed. Ask your organization admin to send a new one.',
              "Ce lien d'invitation est manquant ou incorrect. Demandez à l'administrateur de votre organisation d'en envoyer un nouveau.",
            )}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="micro-label text-ink-muted">{t('Joining organization…', "Adhésion à l'organisation…")}</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">{t('Invite expired', 'Invitation expirée')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t('This invitation has expired', 'Cette invitation a expiré')}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">{t('Invalid invite link', "Lien d'invitation invalide")}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'This invite link is no longer valid. Ask your organization admin to send a new one.',
              "Ce lien d'invitation n'est plus valide. Demandez à l'administrateur de votre organisation d'en envoyer un nouveau.",
            )}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'mismatch') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">
            {t('Use the invited account', 'Utilisez le compte invité')}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'This invitation was sent to another email address. Sign out, sign in with the invited email, then reopen this link.',
              "Cette invitation a été envoyée à une autre adresse e-mail. Déconnectez-vous, connectez-vous avec l'adresse invitée, puis rouvrez ce lien.",
            )}
          </p>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signOutPending}
            className="btn-primary mt-5 flex w-full items-center justify-center disabled:cursor-wait disabled:opacity-60"
          >
            {signOutPending ? t('Signing out…', 'Déconnexion…') : t('Sign out', 'Se déconnecter')}
          </button>
          {signOutError && <p role="alert" className="mt-3 text-sm text-red-700">{signOutError}</p>}
        </div>
      </div>
    );
  }

  if (status === 'already-member') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">
            {t('Already a member', 'Déjà membre')}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'This account already belongs to the organization. Its existing role was not changed.',
              "Ce compte appartient déjà à l'organisation. Son rôle actuel n'a pas été modifié.",
            )}
          </p>
          <a href="#/projects" className="btn-primary mt-5 flex items-center justify-center">
            {t('Go to projects', 'Voir les projets')}
          </a>
        </div>
      </div>
    );
  }

  // status === 'error'
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-sm p-6 text-center">
        <h1 className="text-lg font-semibold text-ink">
          {t('Could not join organization', "Impossible de rejoindre l'organisation")}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{errorMessage}</p>
        <button type="button" onClick={handleRetry} className="btn-primary mt-5 flex w-full items-center justify-center">
          {t('Try again', 'Réessayer')}
        </button>
      </div>
    </div>
  );
};

export default JoinScreen;
