import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Trash2, X } from 'lucide-react';
import { signOut } from '../../lib/client/auth';
import {
  deleteMyAccountRequest,
  getAccountDeletionRequirementsRequest,
  type AccountDeletionRequirements,
} from '../../lib/client/accountDeletion';
import { executeAppWipe } from '../../lib/client/remoteWipe';

interface Props {
  language: 'en' | 'fr';
  redirectTo?: string;
}

const DeleteAccountPanel: React.FC<Props> = ({ language, redirectTo = '/api/auth/signin?deleted=1' }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [expanded, setExpanded] = useState(false);
  const [requirements, setRequirements] = useState<AccountDeletionRequirements | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!expanded || requirements) return;
    let cancelled = false;
    setError('');
    void getAccountDeletionRequirementsRequest()
      .then((next) => { if (!cancelled) setRequirements(next); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('Could not check account protection.', 'Impossible de vérifier la protection du compte.'));
      });
    return () => { cancelled = true; };
  }, [expanded, requirements, language]);

  const blockers = requirements?.blockers ?? [];
  const canDelete = Boolean(
    requirements && blockers.length === 0 && confirmation === 'DELETE' && acknowledged &&
    (!requirements.requiresPassword || password.length > 0) && !busy,
  );

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError('');
    try {
      await deleteMyAccountRequest({
        confirmation: 'DELETE',
        acknowledgeDataLoss: true,
        password: requirements?.requiresPassword ? password : undefined,
      });
      try { await signOut(); } catch { /* the server already revoked the account */ }
      await executeAppWipe(redirectTo);
    } catch (reason) {
      setError(reason instanceof Error && reason.message
        ? reason.message
        : t('Your account was not deleted. Please try again.', 'Votre compte n’a pas été supprimé. Veuillez réessayer.'));
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-red-800">{t('Delete account', 'Supprimer le compte')}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {t('Permanently remove your identity, credentials and company access.', 'Supprimez définitivement votre identité, vos identifiants et vos accès entreprise.')}
        </p>
        <button type="button" onClick={() => setExpanded(true)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50">
          <Trash2 size={16} />{t('Start account deletion', 'Commencer la suppression')}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-red-300 bg-red-50/40 p-5" aria-labelledby="delete-account-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="delete-account-title" className="flex items-center gap-2 text-base font-bold text-red-800"><AlertTriangle size={18} />{t('Permanently delete this account', 'Supprimer définitivement ce compte')}</h2>
          <p className="mt-2 text-sm leading-6 text-red-900">
            {t('This signs you out everywhere, removes your profile and company memberships, and clears data stored on this device. Operational records remain only under an anonymous identifier.', 'Cette action vous déconnecte partout, supprime votre profil et vos accès entreprise, puis efface les données de cet appareil. Les données opérationnelles restent uniquement sous un identifiant anonyme.')}
          </p>
        </div>
        <button type="button" onClick={() => setExpanded(false)} aria-label={t('Cancel account deletion', 'Annuler la suppression')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-800"><X size={18} /></button>
      </div>

      {!requirements && !error && <p role="status" className="mt-4 text-sm text-ink-muted">{t('Checking account protection…', 'Vérification de la protection du compte…')}</p>}
      {blockers.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-semibold">{t('Deletion is protected until access is transferred:', 'La suppression est protégée jusqu’au transfert des accès :')}</p>
          <ul className="mt-2 list-disc pl-5">
            {blockers.map((blocker) => <li key={`${blocker.code}-${blocker.label}`}>{blocker.code === 'last_adl_admin' ? t('Assign another ADL admin first.', 'Attribuez d’abord le rôle admin ADL à une autre personne.') : t(`Assign another owner for ${blocker.label}.`, `Attribuez un autre propriétaire à ${blocker.label}.`)}</li>)}
          </ul>
        </div>
      )}

      {requirements && blockers.length === 0 && (
        <div className="mt-5 space-y-4">
          {requirements.requiresPassword && (
            <label className="block">
              <span className="text-sm font-semibold text-ink">{t('Current password', 'Mot de passe actuel')}</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-red-200 bg-white px-3 text-base text-ink outline-none focus:border-red-600" />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-ink">{t('Type DELETE to confirm', 'Saisissez DELETE pour confirmer')}</span>
            <input type="text" autoCapitalize="characters" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-red-200 bg-white px-3 text-base font-semibold tracking-wide text-ink outline-none focus:border-red-600" />
          </label>
          <label className="flex min-h-12 items-start gap-3 rounded-xl bg-white p-3 text-sm leading-6 text-ink">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-red-700" />
            <span>{t('I understand that this action cannot be undone and that my personal account data will be erased.', 'Je comprends que cette action est irréversible et que les données personnelles de mon compte seront effacées.')}</span>
          </label>
          <button type="button" disabled={!canDelete} onClick={() => void handleDelete()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <ShieldCheck size={16} className="animate-pulse" /> : <Trash2 size={16} />}
            {busy ? t('Deleting account…', 'Suppression du compte…') : t('Permanently delete my account', 'Supprimer définitivement mon compte')}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-red-700">{error}</p>}
    </section>
  );
};

export default DeleteAccountPanel;
