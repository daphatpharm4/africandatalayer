import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import {
  AuthClientError,
  getSession,
  isGoogleSignInSupported,
  registerWithCredentials,
  signInWithCredentials,
  signInWithApple,
  signInWithGoogle,
} from '../../lib/client/auth';
import { isNative } from '../../lib/client/native';
import { normalizeIdentifier } from '../../lib/shared/identifier';
import BrandLogo from '../BrandLogo';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  language: 'en' | 'fr';
  initialMode?: 'signin' | 'signup';
}

type AuthMode = 'signin' | 'signup';
type SubmitAction = 'credentials' | 'google' | 'apple' | null;

const Auth: React.FC<Props> = ({
  onBack,
  onComplete,
  language,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const isNativeApp = isNative();
  const googleAvailable = isGoogleSignInSupported({ nativeApp: isNativeApp });
  const isBusy = submitAction !== null;

  const isAuthClientError = (value: unknown): value is AuthClientError =>
    value instanceof Error &&
    'code' in value &&
    typeof (value as { code?: unknown }).code === 'string';

  const isLowSignalRuntimeMessage = (message: string): boolean => {
    const normalized = message.trim().toLowerCase();
    return (
      normalized.includes('string did not match the expected pattern') ||
      normalized.includes('failed to fetch') ||
      normalized.includes('networkerror') ||
      normalized.includes('load failed') ||
      normalized.includes('invalid url')
    );
  };

  const mapAuthErrorMessage = (error: unknown): string => {
    if (isAuthClientError(error)) {
      switch (error.code) {
        case 'invalid_credentials':
          return t(
            'Invalid phone/email or password.',
            'Téléphone/email ou mot de passe invalide.',
          );
        case 'registration_conflict':
          return t(
            'An account already exists for this phone/email.',
            'Un compte existe déjà pour ce téléphone/email.',
          );
        case 'validation_error': {
          const msg = error.message;
          if (/uppercase/i.test(msg))
            return t(
              'Password must include an uppercase letter.',
              'Le mot de passe doit contenir une majuscule.',
            );
          if (/lowercase/i.test(msg))
            return t(
              'Password must include a lowercase letter.',
              'Le mot de passe doit contenir une minuscule.',
            );
          if (/number/i.test(msg))
            return t(
              'Password must include a number.',
              'Le mot de passe doit contenir un chiffre.',
            );
          if (/10 char/i.test(msg) || /at least 10/i.test(msg)) {
            return t(
              'Password must be at least 10 characters.',
              'Le mot de passe doit contenir au moins 10 caractères.',
            );
          }
          return t(
            'Please check your details and try again.',
            'Vérifiez vos informations et réessayez.',
          );
        }
        case 'storage_unavailable':
          return t(
            'Registration is temporarily unavailable. Please try again in a moment.',
            'L\'inscription est temporairement indisponible. Réessayez dans un instant.',
          );
        case 'provider_unavailable':
          return t(
            'Google sign-in is not available in the mobile app yet. Use phone/email and password.',
            "La connexion Google n'est pas encore disponible dans l'app mobile. Utilisez téléphone/email et mot de passe.",
          );
        case 'configuration_error':
        case 'auth_unavailable':
          return t(
            'Authentication service is temporarily unavailable. Please retry.',
            "Service d'authentification temporairement indisponible. Réessayez.",
          );
        case 'callback_error':
          return t(
            'Unable to complete sign in right now. Please retry.',
            'Connexion impossible pour le moment. Réessayez.',
          );
        case 'access_denied':
          return t(
            'Access denied for this account.',
            'Accès refusé pour ce compte.',
          );
        case 'request_error': {
          const msg = error.message?.trim();
          if (msg && !isLowSignalRuntimeMessage(msg)) return msg;
          return t(
            'Unable to sign in right now. Please check your connection and try again.',
            "Connexion impossible pour le moment. Vérifiez la connexion et réessayez.",
          );
        }
        default:
          return t(
            'Authentication failed. Please try again.',
            "Échec d'authentification. Réessayez.",
          );
      }
    }

    if (error instanceof Error) {
      const message = error.message.replace(/^Error:\s*/, '').trim();
      if (
        message &&
        !isLowSignalRuntimeMessage(message) &&
        !/^<!doctype/i.test(message) &&
        !/^<html/i.test(message)
      ) {
        return message;
      }
    }

    return t(
      'Authentication failed. Please try again.',
      "Échec d'authentification. Réessayez.",
    );
  };

  const resetFeedback = () => {
    setErrorMessage('');
    setErrorCode('');
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetFeedback();
  };

  const handleCredentialsSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedIdentifier = normalizeIdentifier(identifier)?.value ?? '';
    if (!normalizedIdentifier || !password) {
      setErrorCode('validation_error');
      setErrorMessage(
        t(
          'Phone/email and password are required.',
          'Téléphone/email et mot de passe requis.',
        ),
      );
      return;
    }

    setSubmitAction('credentials');
    resetFeedback();
    let accountCreated = false;

    try {
      if (mode === 'signup') {
        await registerWithCredentials(normalizedIdentifier, password);
        accountCreated = true;
        await signInWithCredentials(normalizedIdentifier, password, {
          maxAttempts: 6,
          retryDelayMs: 500,
        });
      } else {
        await signInWithCredentials(normalizedIdentifier, password);
      }

      const session = await getSession();
      if (!session?.user) {
        throw new AuthClientError(
          'unknown_error',
          t('Unable to start a session.', 'Impossible de démarrer la session.'),
          { retryable: true },
        );
      }

      try {
        localStorage.setItem('adl_has_authenticated', 'true');
      } catch {
        // Ignore private browsing storage failures.
      }

      onComplete();
    } catch (error) {
      if (mode === 'signup' && accountCreated) {
        setMode('signin');
        setErrorCode('');
        setErrorMessage(
          t(
            'Account created! Auto sign-in timed out — please sign in manually.',
            'Compte créé ! La connexion auto a expiré — connectez-vous manuellement.',
          ),
        );
      } else {
        setErrorCode(isAuthClientError(error) ? error.code : '');
        setErrorMessage(mapAuthErrorMessage(error));
      }
    } finally {
      setSubmitAction(null);
    }
  };

  const handleAppleSubmit = async () => {
    setSubmitAction('apple');
    resetFeedback();

    try {
      await signInWithApple();
    } catch (error) {
      setErrorCode(isAuthClientError(error) ? error.code : '');
      setErrorMessage(mapAuthErrorMessage(error));
      setSubmitAction(null);
    }
  };

  const handleGoogleSubmit = async () => {
    setSubmitAction('google');
    resetFeedback();

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorCode(isAuthClientError(error) ? error.code : '');
      setErrorMessage(mapAuthErrorMessage(error));
      setSubmitAction(null);
    }
  };

  return (
    <div data-testid="screen-auth" className="screen-shell bg-page">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 pb-10 pt-3 sm:px-6">
        <button
          onClick={onBack}
          className="btn-back -ml-1"
          aria-label={t('Go back', 'Retour')}
          type="button"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="mt-6 flex flex-1 flex-col">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-navy-border bg-white shadow-[0_16px_28px_rgba(15,43,70,0.12)]">
            <BrandLogo size={40} />
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-[2rem] font-bold tracking-tight text-gray-900">
              {mode === 'signin'
                ? t('Welcome back', 'Bon retour')
                : t('Join the network', 'Rejoignez le réseau')}
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {mode === 'signin'
                ? t(
                    'Pick up your assignments, sync your uploads, and keep field coverage moving.',
                    'Retrouvez vos missions, synchronisez vos envois et gardez la couverture terrain en mouvement.',
                  )
                : t(
                    'Create a field account to capture locations, services, and infrastructure changes on the ground.',
                    "Créez un compte terrain pour capturer les lieux, services et changements d'infrastructure sur le terrain.",
                  )}
            </p>
          </div>

          <form
            className="mt-8 flex flex-col gap-4"
            onSubmit={handleCredentialsSubmit}
          >
            <button
              type="button"
              onClick={() => void handleAppleSubmit()}
              disabled={isBusy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.99] disabled:opacity-70"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span>
                {submitAction === 'apple'
                  ? t('Connecting...', 'Connexion...')
                  : t('Sign in with Apple', 'Se connecter avec Apple')}
              </span>
            </button>

            {googleAvailable && (
              <button
                type="button"
                onClick={() => void handleGoogleSubmit()}
                disabled={isBusy}
                className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-sm font-semibold text-navy shadow-sm transition-all hover:bg-gray-50 active:scale-[0.99] disabled:opacity-70"
              >
                {submitAction === 'google'
                  ? t(
                      'Connecting...',
                      'Connexion...',
                    )
                  : t('Continue with Google', 'Continuer avec Google')}
              </button>
            )}

            <div className="space-y-2">
              <label
                className="px-1 text-xs font-semibold text-gray-500"
                htmlFor="auth-identifier"
              >
                {t('Phone number or email', 'Numéro de téléphone ou email')}
              </label>
              <div className="group relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-navy"
                />
                <input
                  id="auth-identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder={t(
                    '+2376XXXXXXXX or name@email.com',
                    '+2376XXXXXXXX ou nom@email.com',
                  )}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  disabled={isBusy}
                  className="h-14 w-full rounded-2xl border border-gray-100 bg-white pl-12 pr-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="px-1 text-xs font-semibold text-gray-500"
                htmlFor="auth-password"
              >
                {t('Password', 'Mot de passe')}
              </label>
              <div className="group relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-navy"
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  enterKeyHint="go"
                  placeholder={
                    mode === 'signup'
                      ? t(
                          'Min. 10 chars, A-Z, a-z, 0-9',
                          'Min. 10 car., A-Z, a-z, 0-9',
                        )
                      : t('Your password', 'Votre mot de passe')
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isBusy}
                  className="h-14 w-full rounded-2xl border border-gray-100 bg-white pl-12 pr-12 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label={
                    showPassword
                      ? t('Hide password', 'Masquer le mot de passe')
                      : t('Show password', 'Afficher le mot de passe')
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="px-1 text-xs leading-5 text-gray-500">
                  {t(
                    'Use at least 10 characters with an uppercase letter, a lowercase letter, and a number.',
                    'Utilisez au moins 10 caractères avec une majuscule, une minuscule et un chiffre.',
                  )}
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left">
                <p className="text-sm font-semibold leading-5 text-red-700">
                  {errorMessage}
                </p>
                {mode === 'signin' &&
                  [
                    'invalid_credentials',
                    'auth_unavailable',
                    'unknown_error',
                    'request_error',
                  ].includes(errorCode) && (
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="mt-2 text-xs font-semibold text-navy hover:underline"
                    >
                      {t(
                        'No account yet? Create one.',
                        'Pas encore de compte ? Créez-en un.',
                      )}
                    </button>
                  )}
                {mode === 'signup' && errorCode === 'registration_conflict' && (
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="mt-2 text-xs font-semibold text-navy hover:underline"
                  >
                    {t(
                      'Already registered? Sign in instead.',
                      'Déjà inscrit ? Connectez-vous à la place.',
                    )}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy px-4 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(15,43,70,0.18)] transition-all hover:bg-navy-dark active:scale-[0.99] disabled:opacity-70"
            >
              <span>
                {submitAction === 'credentials'
                  ? t('Working...', 'Traitement...')
                  : mode === 'signin'
                    ? t('Sign in', 'Connexion')
                    : t('Create account', 'Créer un compte')}
              </span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-5 text-center">
            <div className="flex items-center gap-2 text-gray-500">
              <ShieldCheck size={12} />
              <span className="text-xs font-semibold">
                {t(
                  'Encrypted sign-in keeps your field account secure.',
                  'La connexion chiffrée protège votre compte terrain.',
                )}
              </span>
            </div>

            <p className="text-xs text-gray-500">
              {mode === 'signin'
                ? t("Don't have an account? ", 'Pas de compte ? ')
                : t('Already have an account? ', 'Vous avez déjà un compte ? ')}
              <button
                type="button"
                onClick={() =>
                  switchMode(mode === 'signin' ? 'signup' : 'signin')
                }
                className="font-bold text-navy hover:underline"
              >
                {mode === 'signin'
                  ? t('Create an account', 'Créer un compte')
                  : t('Sign in instead', 'Se connecter plutôt')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
