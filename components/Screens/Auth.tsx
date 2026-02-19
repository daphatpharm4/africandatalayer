import React, { useState } from 'react';
import { ChevronLeft, Mail, Lock, Eye, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuthClientError, getSession, registerWithCredentials, signInWithCredentials, signInWithGoogle } from '../../lib/client/auth';
import BrandLogo from '../BrandLogo';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  language: 'en' | 'fr';
}

const Auth: React.FC<Props> = ({ onBack, onComplete, language }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
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
          return t('Invalid email or password.', 'Email ou mot de passe invalide.');
        case 'registration_conflict':
          return t('An account already exists for this email.', 'Un compte existe deja pour cet email.');
        case 'validation_error':
          return t('Please check your details and try again.', 'Verifiez vos informations et reessayez.');
        case 'storage_unavailable':
          return t('Registration storage is temporarily unavailable. Please retry shortly.', 'Le stockage des inscriptions est temporairement indisponible. Reessayez bientot.');
        case 'configuration_error':
        case 'auth_unavailable':
          return t('Authentication service is temporarily unavailable. Please retry.', 'Service d\'authentification temporairement indisponible. Reessayez.');
        case 'callback_error':
          return t('Unable to complete sign in right now. Please retry.', 'Connexion impossible pour le moment. Reessayez.');
        case 'access_denied':
          return t('Access denied for this account.', 'Acces refuse pour ce compte.');
        default:
          return t('Authentication failed. Please try again.', 'Echec d\'authentification. Reessayez.');
      }
    }

    if (error instanceof Error) {
      const message = error.message.replace(/^Error:\s*/, '').trim();
      if (message && !/^<!doctype/i.test(message) && !/^<html/i.test(message)) {
        return message;
      }
    }
    return t('Authentication failed. Please try again.', 'Echec d\'authentification. Reessayez.');
  };

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage(t('Email and password are required.', 'Email et mot de passe requis.'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    let accountCreated = false;

    try {
      if (mode === 'signup') {
        await registerWithCredentials(normalizedEmail, password);
        accountCreated = true;
        await signInWithCredentials(normalizedEmail, password, { maxAttempts: 6, retryDelayMs: 500 });
      } else {
        await signInWithCredentials(normalizedEmail, password);
      }
      const session = await getSession();
      if (!session?.user) {
        throw new AuthClientError('unknown_error', t('Unable to start a session.', 'Impossible de demarrer la session.'), { retryable: true });
      }
      onComplete();
    } catch (error) {
      if (mode === 'signup' && accountCreated) {
        setMode('signin');
        setErrorMessage(t('Account created. Automatic sign in took too long. Please sign in in a few seconds.', 'Compte cree. La connexion automatique a pris trop de temps. Connectez-vous dans quelques secondes.'));
      } else {
        setErrorMessage(mapAuthErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] p-8 overflow-y-auto no-scrollbar">
      <button onClick={onBack} className="p-2 -ml-4 self-start text-gray-700"><ChevronLeft size={24} /></button>

      <div className="flex-1 flex flex-col justify-center max-w-[320px] mx-auto w-full">
        <div className="w-16 h-16 bg-white border border-[#e7eef4] rounded-2xl flex items-center justify-center mb-8 shadow-lg mx-auto">
          <BrandLogo size={40} />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{mode === 'signin' ? t('Welcome Back', 'Bon retour') : t('Join the Network', 'Rejoignez le reseau')}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            {mode === 'signin'
              ? t('Access the African Data Layer portal for infrastructure and pricing.', 'Accedez au portail African Data Layer pour les donnees d\'infrastructure et de prix.')
              : t('Create an account to contribute data and earn XP rewards.', 'Creez un compte pour contribuer et gagner des recompenses XP.')}
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => signInWithGoogle()}
            className="w-full h-12 bg-white border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#0f2b46] shadow-sm hover:bg-gray-50 transition-all"
          >
            {t('Continue with Google', 'Continuer avec Google')}
          </button>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('Email Address', 'Adresse email')}</label>
            <div className="relative group">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f2b46] transition-colors" />
              <input
                type="email"
                placeholder={t('name@email.com', 'nom@email.com')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-4 text-sm focus:border-[#0f2b46] focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Password', 'Mot de passe')}</label>
              {mode === 'signin' && <button className="text-[10px] font-bold text-[#0f2b46] uppercase">{t('Forgot?', 'Oublie ?')}</button>}
            </div>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0f2b46] transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('Min. 8 characters', 'Min. 8 caracteres')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-14 bg-white border border-gray-100 rounded-xl pl-12 pr-12 text-sm focus:border-[#0f2b46] focus:outline-none transition-all shadow-sm"
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
            className="w-full h-14 bg-[#0f2b46] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-[#0b2236] active:scale-95 transition-all disabled:opacity-70"
          >
            <span>{isSubmitting ? t('Working...', 'Traitement...') : mode === 'signin' ? t('Sign In', 'Connexion') : t('Create Account', 'Creer un compte')}</span>
            <ArrowRight size={18} />
          </button>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-[10px] font-semibold uppercase tracking-widest text-red-600 text-center">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="mt-8 text-center flex flex-col space-y-6 items-center">
          <div className="flex items-center space-x-2 text-gray-400">
            <ShieldCheck size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t('Secure Encrypted Login', 'Connexion chiffree securisee')}</span>
          </div>

          <p className="text-xs text-gray-500">
            {mode === 'signin' ? t("Don't have an account? ", 'Pas de compte ? ') : t('Already have an account? ', 'Vous avez deja un compte ? ')}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMessage('');
              }}
              className="text-[#0f2b46] font-bold hover:underline"
            >
              {mode === 'signin' ? t('Create an account', 'Creer un compte') : t('Sign in instead', 'Se connecter plutot')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
