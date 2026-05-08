import React, { useEffect, useState } from 'react';
import { ChevronLeft, Lock, Mail, ShieldCheck } from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { apiJson } from '../../lib/client/api';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

type Mode = 'request' | 'confirm';

const ForgotPassword: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const initialToken = (() => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') ?? '';
    } catch {
      return '';
    }
  })();

  const [mode] = useState<Mode>(initialToken ? 'confirm' : 'request');
  const [identifier, setIdentifier] = useState('');
  const [token] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, [mode]);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (identifier.trim().length < 3) {
      setErrorMessage(
        t('Enter a valid phone or email.', 'Entrez un téléphone ou e-mail valide.'),
      );
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password-reset-request',
          identifier: identifier.trim(),
          language,
        }),
      });
      setSuccessMessage(
        t(
          'If an account exists for this contact, a reset link has been sent. Check your inbox.',
          "Si un compte existe pour ce contact, un lien de réinitialisation a été envoyé. Vérifiez votre boîte mail.",
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('Something went wrong. Try again.', "Une erreur est survenue. Réessayez."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (password.length < 8) {
      setErrorMessage(
        t('Password must be at least 8 characters.', 'Le mot de passe doit contenir au moins 8 caractères.'),
      );
      return;
    }
    if (password !== confirm) {
      setErrorMessage(t('Passwords do not match.', 'Les mots de passe ne correspondent pas.'));
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password-reset-confirm',
          token,
          password,
        }),
      });
      setSuccessMessage(
        t(
          'Password updated. You can now sign in with your new password.',
          'Mot de passe mis à jour. Vous pouvez vous connecter avec votre nouveau mot de passe.',
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('Reset link is invalid or expired.', 'Le lien de réinitialisation est invalide ou expiré.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-shell flex min-h-screen flex-col bg-page">
      <header className="screen-header flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('Back', 'Retour')}
          className="motion-pressable rounded-full p-2 text-navy hover:bg-navy-wash"
        >
          <ChevronLeft size={20} />
        </button>
        <BrandLogo className="h-7" />
        <span className="w-10" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-2">
        <div className="card-soft p-6">
          <div className="flex items-center gap-2 text-navy">
            <ShieldCheck size={18} />
            <h1 className="text-lg font-bold">
              {mode === 'request'
                ? t('Reset your password', 'Réinitialiser votre mot de passe')
                : t('Set a new password', 'Définir un nouveau mot de passe')}
            </h1>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
            {mode === 'request'
              ? t(
                  'Enter the phone or email tied to your account. If a match is found, we will send a reset link.',
                  'Entrez le téléphone ou e-mail lié à votre compte. Si une correspondance est trouvée, nous enverrons un lien.',
                )
              : t(
                  'Choose a new password (at least 8 characters).',
                  'Choisissez un nouveau mot de passe (au moins 8 caractères).',
                )}
          </p>

          {mode === 'request' ? (
            <form onSubmit={handleRequest} className="mt-5 space-y-4">
              <label className="block">
                <span className="micro-label text-gray-500">
                  {t('Phone or email', 'Téléphone ou e-mail')}
                </span>
                <div className="mt-1 flex items-center rounded-2xl border border-gray-200 bg-white px-3 focus-within:border-navy">
                  <Mail size={16} className="text-gray-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    className="ml-2 h-12 w-full bg-transparent text-sm text-ink outline-none"
                    placeholder={t('e.g. +237699000000 or you@example.com', 'ex. +237699000000 ou vous@exemple.com')}
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting
                  ? t('Sending…', 'Envoi…')
                  : t('Send reset link', 'Envoyer le lien')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="mt-5 space-y-4">
              <label className="block">
                <span className="micro-label text-gray-500">{t('New password', 'Nouveau mot de passe')}</span>
                <div className="mt-1 flex items-center rounded-2xl border border-gray-200 bg-white px-3 focus-within:border-navy">
                  <Lock size={16} className="text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="ml-2 h-12 w-full bg-transparent text-sm text-ink outline-none"
                    placeholder={t('At least 8 characters', 'Au moins 8 caractères')}
                  />
                </div>
              </label>
              <label className="block">
                <span className="micro-label text-gray-500">{t('Confirm password', 'Confirmer le mot de passe')}</span>
                <div className="mt-1 flex items-center rounded-2xl border border-gray-200 bg-white px-3 focus-within:border-navy">
                  <Lock size={16} className="text-gray-400" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="ml-2 h-12 w-full bg-transparent text-sm text-ink outline-none"
                    placeholder={t('Re-enter new password', 'Saisissez à nouveau')}
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting
                  ? t('Saving…', 'Enregistrement…')
                  : t('Update password', 'Mettre à jour le mot de passe')}
              </button>
            </form>
          )}

          {errorMessage && (
            <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-[13px] text-red-700">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div role="status" className="mt-4 rounded-xl border border-forest-wash bg-forest-wash p-3 text-[13px] text-forest">
              {successMessage}
            </div>
          )}

          <div className="mt-6 text-center">
            <button type="button" onClick={onBack} className="text-[13px] font-medium text-navy underline">
              {t('Back to sign in', 'Retour à la connexion')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
