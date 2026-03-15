import React, { useState } from 'react';
import { ChevronLeft, Mail, Lock, Eye, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuthClientError, getSession, registerWithCredentials, signInWithCredentials, signInWithGoogle } from '../../lib/client/auth';
import { normalizeIdentifier } from '../../lib/shared/identifier';
import BrandLogo from '../BrandLogo';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  language: 'en' | 'fr';
}

const Auth: React.FC<Props> = ({ onBack, onComplete, language }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const isAuthClientError = (value: unknown): value is AuthClientError =>
    value instanceof Error && 'code' in value && typeof (value as { code?: unknown }).code === 'string';

  const mapAuthErrorMessage = (error: unknown): string => {
    if (isAuthClientError(error)) {
      switch (error.code) {
        case 'invalid_credentials':
          return t('Invalid phone/email or password.', 'Téléphone/email ou mot de passe invalide.');
        case 'registration_conflict':
          return t('An account already exists for this phone/email.', 'Un compte existe déjà pour ce téléphone/email.');
        case 'validation_error':
          return t('Please check your details and try again.', 'Vérifiez vos informations et réessayez.');
        case 'storage_unavailable':
          return t('Registration storage is temporarily unavailable. Please retry shortly.', 'Le stockage des inscriptions est temporairement indisponible. Réessayez bientôt.');
        case 'configuration_error':
        case 'auth_unavailable':
          return t('Authentication service is temporarily unavailable. Please retry.', 'Service d\'authentification temporairement indisponible. Réessayez.');
        case 'callback_error':
          return t('Unable to complete sign in right now. Please retry.', 'Connexion impossible pour le moment. Réessayez.');
        case 'access_denied':
          return t('Access denied for this account.', 'Accès refusé pour ce compte.');
        default:
          return t('Authentication failed. Please try again.', 'Échec d\'authentification. Réessayez.');
      }
    }

    if (error instanceof Error) {
      const message = error.message.replace(/^Error:\s*/, '').trim();
      if (message && !/^<!doctype/i.test(message) && !/^<html/i.test(message)) {
        return message;
      }
    }
    return t('Authentication failed. Please try again.', 'Échec d\'authentification. Réessayez.');
  };

  const handleSubmit = async () => {
    const normalizedIdentifier = normalizeIdentifier(identifier)?.value ?? '';
    if (!normalizedIdentifier || !password) {
      setErrorMessage(t('Phone/email and password are required.', 'Téléphone/email et mot de passe requis.'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    let accountCreated = false;

    try {
      if (mode === 'signup') {
        await registerWithCredentials(normalizedIdentifier, password);
        accountCreated = true;
        await signInWithCredentials(normalizedIdentifier, password, { maxAttempts: 6, retryDelayMs: 500 });
      } else {
        await signInWithCredentials(normalizedIdentifier, password);
      }
      const session = await getSession();
      if (!session?.user) {
        throw new AuthClientError('unknown_error', t('Unable to start a session.', 'Impossible de démarrer la session.'), { retryable: true });
      }
      onComplete();
    } catch (error) {
      if (mode === 'signup' && accountCreated) {
        setMode('signin');
        setErrorMessage(t('Account created. Automatic sign in took too long. Please sign in in a few seconds.', 'Compte créé. La connexion automatique a pris trop de temps. Connectez-vous dans quelques secondes.'));
      } else {
        setErrorMessage(mapAuthErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-page p-8 overflow-y-auto no-scrollbar">
      <button onClick={onBack} className="p-2 -ml-4 self-start text-gray-700" aria-label={t('Go back', 'Retour')}><ChevronLeft size={24} /></button>

      <div className="flex-1 flex flex-col justify-center max-w-[320px] mx-auto w-full">
        <div className="w-16 h-16 bg-white border border-navy-light rounded-2xl flex items-center justify-center mb-8 shadow-lg mx-auto">
          <BrandLogo size={40} />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{mode === 'signin' ? t('Welcome Back', 'Bon retour') : t('Join the Network', 'Rejoignez le réseau')}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            {mode === 'signin'
              ? t('Access the African Data Layer portal for infrastructure and pricing.', 'Accédez au portail African Data Layer pour les données d\'infrastructure et de prix.')
              : t('Create an account to contribute data and earn XP rewards.', 'Créez un compte pour contribuer et gagner des récompenses XP.')}
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => signInWithGoogle()}
            className="w-full h-12 bg-white border border-gray-100 rounded-xl text-[11px] font-bold uppercase tracking-widest text-navy shadow-sm hover:bg-gray-50 transition-all"
          >
            {t('Continue with Google', 'Continuer avec Google')}
          </button>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Phone or email', 'Téléphone ou email')}</label>
            <div className="relative group">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy transition-colors" />
              <input
                type="text"
                placeholder={t('+2376XXXXXXXX or name@email.com', '+2376XXXXXXXX ou nom@email.com')}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-4 text-sm focus:border-navy focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t('Password', 'Mot de passe')}</label>
              {mode === 'signin' && <button className="text-[11px] font-bold text-navy uppercase">{t('Forgot?', 'Oublié ?')}</button>}
            </div>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('Min. 8 characters', 'Min. 8 caractères')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-12 text-sm focus:border-navy focus:outline-none transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-14 bg-navy text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-navy-dark active:scale-95 transition-all disabled:opacity-70"
          >
            <span>{isSubmitting ? t('Working...', 'Traitement...') : mode === 'signin' ? t('Sign In', 'Connexion') : t('Create Account', 'Créer un compte')}</span>
            <ArrowRight size={18} />
          </button>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-[11px] font-semibold uppercase tracking-widest text-red-600 text-center">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="mt-8 text-center flex flex-col space-y-6 items-center">
          <div className="flex items-center space-x-2 text-gray-400">
            <ShieldCheck size={12} />
            <span className="text-[11px] font-bold uppercase tracking-widest">{t('Secure Encrypted Login', 'Connexion chiffrée sécurisée')}</span>
          </div>

          <p className="text-xs text-gray-500">
            {mode === 'signin' ? t("Don't have an account? ", 'Pas de compte ? ') : t('Already have an account? ', 'Vous avez déjà un compte ? ')}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMessage('');
              }}
              className="text-navy font-bold hover:underline"
            >
              {mode === 'signin' ? t('Create an account', 'Créer un compte') : t('Sign in instead', 'Se connecter plutôt')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
