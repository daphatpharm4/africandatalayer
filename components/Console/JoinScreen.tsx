import React, { useCallback, useEffect, useRef, useState } from 'react';
import { acceptInviteRequest, PlatformApiError } from '../../lib/client/platformApi';

export interface JoinScreenProps {
  token: string | undefined;
  hasSession: boolean;
  language: 'en' | 'fr';
  onJoined: (organizationId: string) => void;
}

type AcceptStatus = 'loading' | 'expired' | 'invalid' | 'error';

const JoinScreen: React.FC<JoinScreenProps> = ({ token, hasSession, language, onJoined }) => {
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

  if (!hasSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">{t('Sign in required', 'Connexion requise')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'Sign in first, then reopen your invite link',
              "Connectez-vous d'abord, puis rouvrez votre lien d'invitation",
            )}
          </p>
          <a href="/" className="btn-primary mt-5 flex items-center justify-center">
            {t('Go to sign in', 'Aller à la connexion')}
          </a>
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
