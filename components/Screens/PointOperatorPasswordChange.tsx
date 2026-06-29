import React, { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { changePointOperatorPassword } from '../../lib/client/pointOperatorApi';

interface Props {
  language: 'en' | 'fr';
  onCancel?: () => void;
  onSignedOut: () => void;
}

const PointOperatorPasswordChange: React.FC<Props> = ({ language, onCancel, onSignedOut }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    currentPassword.trim().length > 0 &&
    newPassword.trim().length >= 10 &&
    confirmPassword.trim().length > 0 &&
    !isSaving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('New passwords do not match.', 'Les nouveaux mots de passe ne correspondent pas.'));
      return;
    }
    if (newPassword.length < 10) {
      setError(t('Use at least 10 characters.', 'Utilisez au moins 10 caracteres.'));
      return;
    }

    setIsSaving(true);
    try {
      await changePointOperatorPassword({ currentPassword, newPassword });
      onSignedOut();
    } catch (saveError) {
      setError(saveError instanceof Error && saveError.message.trim()
        ? saveError.message
        : t('Unable to change password.', 'Impossible de changer le mot de passe.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-testid="screen-point-operator-password" className="screen-shell bg-page">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-[calc(var(--safe-top)+12px)] backdrop-blur">
        <p className="micro-label text-terra">{t('Point Operator', 'Operateur de point')}</p>
        <h1 className="mt-1 text-xl font-black text-navy">{t('Change password', 'Changer le mot de passe')}</h1>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4 pb-10 sm:p-6">
        <section className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <KeyRound size={20} className="mt-0.5 shrink-0 text-navy" aria-hidden="true" />
            <p className="text-sm font-semibold leading-relaxed text-gray-700">
              {t('Choose a private password before continuing.', 'Choisissez un mot de passe prive avant de continuer.')}
            </p>
          </div>
        </section>

        <label className="block">
          <span className="text-xs font-black uppercase text-gray-500">{t('Current password', 'Mot de passe actuel')}</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-2 min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base font-semibold text-ink outline-none focus:border-navy"
            autoComplete="current-password"
          />
        </label>

        <label className="block">
          <span className="text-xs font-black uppercase text-gray-500">{t('New password', 'Nouveau mot de passe')}</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-2 min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base font-semibold text-ink outline-none focus:border-navy"
            autoComplete="new-password"
          />
        </label>

        <label className="block">
          <span className="text-xs font-black uppercase text-gray-500">{t('Confirm new password', 'Confirmer le nouveau mot de passe')}</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 min-h-[52px] w-full rounded-2xl border border-gray-200 bg-white px-4 text-base font-semibold text-ink outline-none focus:border-navy"
            autoComplete="new-password"
          />
        </label>

        {error && (
          <div className="rounded-2xl border border-terra/30 bg-terra-wash p-3 text-sm font-semibold text-terra-dark">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary min-h-[52px] w-full disabled:opacity-60"
        >
          {isSaving ? t('Saving...', 'Enregistrement...') : t('Change password', 'Changer le mot de passe')}
        </button>

        <button
          type="button"
          onClick={onSignedOut}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-terra-dark"
        >
          <LogOut size={18} aria-hidden="true" />
          {t('Sign out instead', 'Se deconnecter')}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[52px] w-full rounded-2xl px-4 text-sm font-black text-gray-600"
          >
            {t('Back to profile', 'Retour au profil')}
          </button>
        )}
      </form>
    </div>
  );
};

export default PointOperatorPasswordChange;
