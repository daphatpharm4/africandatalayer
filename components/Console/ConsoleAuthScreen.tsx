import React, { useState } from 'react';
import { Building2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import {
  AuthClientError,
  getSession,
  registerWithCredentials,
  signInWithCredentials,
} from '../../lib/client/auth';
import { normalizeIdentifier } from '../../lib/shared/identifier';
import BrandLogo from '../BrandLogo';

interface Props {
  language: 'en' | 'fr';
  inviteMode: boolean;
  onAuthenticated: () => void | Promise<void>;
}

const ConsoleAuthScreen: React.FC<Props> = ({ language, inviteMode, onAuthenticated }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [mode, setMode] = useState<'signin' | 'signup'>(inviteMode ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const mapError = (error: unknown): string => {
    if (error instanceof AuthClientError) {
      if (error.code === 'invalid_credentials') {
        return t('Invalid email or password.', 'Adresse e-mail ou mot de passe invalide.');
      }
      if (error.code === 'registration_conflict') {
        return t('An account already exists for this email. Sign in instead.', 'Un compte existe déjà pour cette adresse. Connectez-vous plutôt.');
      }
      if (error.code === 'validation_error') return error.message;
      if (error.code === 'access_denied') {
        return t('Access is disabled for this account.', 'L’accès est désactivé pour ce compte.');
      }
    }
    return t(
      'Company sign-in is temporarily unavailable. Check your connection and try again.',
      'La connexion entreprise est temporairement indisponible. Vérifiez votre connexion et réessayez.',
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    const normalized = normalizeIdentifier(email);
    if (!normalized || normalized.type !== 'email' || !password) {
      setErrorMessage(t('A valid email and password are required.', 'Une adresse e-mail valide et un mot de passe sont requis.'));
      return;
    }
    if (mode === 'signup' && !acceptedPolicies) {
      setErrorMessage(t('Accept the Terms of Use and Privacy Policy to continue.', 'Acceptez les Conditions d’utilisation et la Politique de confidentialité pour continuer.'));
      return;
    }

    setIsBusy(true);
    setErrorMessage('');
    try {
      if (mode === 'signup') {
        await registerWithCredentials(normalized.value, password, {
          acceptedPolicies: ['privacy', 'terms'],
          smsOptIn: false,
        });
        await signInWithCredentials(normalized.value, password, { maxAttempts: 6, retryDelayMs: 500 });
      } else {
        await signInWithCredentials(normalized.value, password);
      }
      const session = await getSession();
      if (!session?.user) throw new Error('session_missing');
      try {
        localStorage.setItem('adl_has_authenticated', 'true');
      } catch {
        // Private browsing may reject local storage; the authenticated cookie is sufficient.
      }
      await onAuthenticated();
    } catch (error) {
      setErrorMessage(mapError(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="console-scroll-region route-grid flex h-[var(--app-height)] min-h-0 touch-pan-y items-center justify-center overflow-y-auto overscroll-contain bg-page px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-3">
          <BrandLogo size={36} />
          <div>
            <div className="text-lg font-bold text-navy">African Data Layer</div>
            <div className="micro-label text-gray-500">{t('Company Console', 'Console Entreprise')}</div>
          </div>
        </div>

        <section className="card overflow-hidden" aria-labelledby="console-auth-title">
          <div className="bg-navy px-5 py-6 text-white sm:px-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Building2 size={23} aria-hidden="true" />
            </div>
            <h1 id="console-auth-title" className="mt-4 text-2xl font-bold">
              {mode === 'signup'
                ? t('Create your invited company account', 'Créez votre compte entreprise invité')
                : t('Sign in to your company', 'Connectez-vous à votre entreprise')}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/75">
              {mode === 'signup'
                ? t('Use the email address that received the invitation. You will enter the company console immediately after verification.', 'Utilisez l’adresse e-mail ayant reçu l’invitation. Vous accéderez directement à la console entreprise après vérification.')
                : t('Access only your authorized company projects, reviews and data.', 'Accédez uniquement aux projets, revues et données autorisés de votre entreprise.')}
            </p>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-5 sm:p-7">
            <div className="block">
              <label htmlFor="console-work-email" className="text-xs font-bold text-gray-700">
                {t('Work email', 'Adresse e-mail professionnelle')}
              </label>
              <span className="relative mt-2 block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                <input
                  id="console-work-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  required
                  className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-base text-ink-dark focus:border-navy focus:outline-none"
                  placeholder="name@company.com"
                />
              </span>
            </div>

            <div className="block">
              <label htmlFor="console-password" className="text-xs font-bold text-gray-700">
                {t('Password', 'Mot de passe')}
              </label>
              <span className="relative mt-2 block">
                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                <input
                  id="console-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={10}
                  className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-14 text-base text-ink-dark focus:border-navy focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1 flex h-12 w-12 items-center justify-center rounded-xl text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                  aria-label={showPassword ? t('Hide password', 'Masquer le mot de passe') : t('Show password', 'Afficher le mot de passe')}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </div>

            {mode === 'signup' && (
              <label className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-page p-3 text-sm leading-5 text-gray-700">
                <input
                  type="checkbox"
                  checked={acceptedPolicies}
                  onChange={(event) => setAcceptedPolicies(event.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-navy"
                />
                <span>
                  {t('I accept the', 'J’accepte les')}{' '}
                  <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t('Terms of Use', 'Conditions d’utilisation')}</a>
                  {' '}{t('and', 'et la')}{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t('Privacy Policy', 'Politique de confidentialité')}</a>.
                </span>
              </label>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy px-5 text-sm font-bold text-white shadow-sm disabled:cursor-wait disabled:opacity-60"
            >
              <ShieldCheck size={18} aria-hidden="true" />
              {isBusy
                ? t('Securing access…', 'Sécurisation de l’accès…')
                : mode === 'signup'
                  ? t('Create account and join company', 'Créer le compte et rejoindre l’entreprise')
                  : t('Open company console', 'Ouvrir la console entreprise')}
            </button>

            {inviteMode && (
              <button
                type="button"
                onClick={() => {
                  setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
                  setErrorMessage('');
                }}
                className="min-h-12 w-full rounded-2xl text-sm font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
              >
                {mode === 'signin'
                  ? t('New invited user? Create the account', 'Nouvel utilisateur invité ? Créer le compte')
                  : t('Already have an account? Sign in', 'Vous avez déjà un compte ? Se connecter')}
              </button>
            )}
          </form>
        </section>

        {!inviteMode && (
          <p className="mt-4 text-center text-xs leading-5 text-gray-500">
            {t('New company users must use the invitation link sent by their company manager.', 'Les nouveaux utilisateurs doivent utiliser le lien d’invitation envoyé par leur gestionnaire.')}
          </p>
        )}
      </div>
    </main>
  );
};

export default ConsoleAuthScreen;
