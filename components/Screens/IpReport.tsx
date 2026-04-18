import React, { useState } from 'react';
import ScreenHeader from '../shared/ScreenHeader';
import { submitIpReport, type IpReportInput } from '../../lib/client/legal';

interface Props {
  onBack: () => void;
  onSubmitted?: () => void;
  language: 'en' | 'fr';
}

type TargetKind = IpReportInput['targetKind'];

const IpReport: React.FC<Props> = ({ onBack, onSubmitted, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [targetKind, setTargetKind] = useState<TargetKind>('submission');
  const [targetRef, setTargetRef] = useState('');
  const [description, setDescription] = useState('');
  const [sworn, setSworn] = useState(false);
  const [signature, setSignature] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!sworn) {
      setError(t('You must affirm the sworn statement.', 'Vous devez confirmer la déclaration sous serment.'));
      return;
    }
    if (!signature.trim()) {
      setError(t('Please sign with your full name.', 'Veuillez signer avec votre nom complet.'));
      return;
    }
    if (description.trim().length < 20) {
      setError(t('Description must be at least 20 characters.', 'La description doit contenir au moins 20 caractères.'));
      return;
    }

    setStatus('sending');
    try {
      await submitIpReport({
        reporterName: reporterName.trim(),
        reporterEmail: reporterEmail.trim(),
        targetKind,
        targetRef: targetRef.trim() || undefined,
        description: description.trim(),
        sworn: true,
      });
      setStatus('ok');
      onSubmitted?.();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : t('Submission failed.', 'La soumission a échoué.'));
    }
  }

  if (status === 'ok') {
    return (
      <div data-testid="screen-ip-report" className="screen-shell">
        <ScreenHeader
          title={t('Report IP Infringement', 'Signaler une atteinte PI')}
          onBack={onBack}
          language={language}
        />
        <div className="p-6 space-y-4">
          <div className="card p-6 space-y-3 text-center">
            <h2 className="text-base font-bold text-ink">
              {t('Report received', 'Signalement reçu')}
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t(
                'Thank you. Our legal team will review your report and respond within 10 business days.',
                "Merci. Notre équipe juridique examinera votre signalement et répondra sous 10 jours ouvrés.",
              )}
            </p>
            <button
              type="button"
              onClick={onBack}
              className="btn-primary w-full"
            >
              {t('Back to Settings', 'Retour aux paramètres')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="screen-ip-report" className="screen-shell">
      <ScreenHeader
        title={t('Report IP Infringement', 'Signaler une atteinte PI')}
        onBack={onBack}
        language={language}
      />
      <form onSubmit={onSubmit} className="p-6 pb-24 space-y-5">
        <p className="text-sm text-gray-700 leading-relaxed">
          {t(
            'Use this form to notify us of content that infringes your copyright, trademark, or other intellectual-property rights. Submitting knowingly false reports may result in liability.',
            "Utilisez ce formulaire pour signaler un contenu qui porte atteinte à votre droit d'auteur, votre marque ou tout autre droit de propriété intellectuelle. Un signalement sciemment faux peut engager votre responsabilité.",
          )}
        </p>

        <label className="flex flex-col gap-1">
          <span className="micro-label text-gray-500">
            {t('Your full name', 'Votre nom complet')}
          </span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={160}
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            className="rounded-xl border border-gray-200 p-3 text-sm"
            data-testid="ip-reporter-name"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="micro-label text-gray-500">
            {t('Your email', 'Votre email')}
          </span>
          <input
            type="email"
            required
            maxLength={160}
            value={reporterEmail}
            onChange={(e) => setReporterEmail(e.target.value)}
            className="rounded-xl border border-gray-200 p-3 text-sm"
            data-testid="ip-reporter-email"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="micro-label text-gray-500">
            {t('Target kind', 'Type de cible')}
          </span>
          <select
            value={targetKind}
            onChange={(e) => setTargetKind(e.target.value as TargetKind)}
            className="rounded-xl border border-gray-200 p-3 text-sm bg-white"
            data-testid="ip-target-kind"
          >
            <option value="submission">{t('Submission', 'Soumission')}</option>
            <option value="point">{t('Point', 'Point')}</option>
            <option value="other">{t('Other', 'Autre')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="micro-label text-gray-500">
            {t('Target reference (optional)', 'Référence de la cible (facultatif)')}
          </span>
          <input
            type="text"
            maxLength={160}
            value={targetRef}
            onChange={(e) => setTargetRef(e.target.value)}
            className="rounded-xl border border-gray-200 p-3 text-sm"
            data-testid="ip-target-ref"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="micro-label text-gray-500">
            {t('Description of the infringement (min 20 chars)', "Description de l'atteinte (min 20 car.)")}
          </span>
          <textarea
            required
            minLength={20}
            maxLength={4000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl border border-gray-200 p-3 text-sm"
            data-testid="ip-description"
          />
        </label>

        <label className="flex items-start gap-3 px-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={sworn}
            onChange={(e) => setSworn(e.target.checked)}
            required
            className="mt-1 min-w-[16px]"
            data-testid="ip-sworn"
          />
          <span>
            {t(
              'I swear, under penalty of perjury, that the information in this notice is accurate and that I am the rights holder or authorised to act on their behalf.',
              'Je déclare sous serment, sous peine de parjure, que les informations de ce signalement sont exactes et que je suis le titulaire des droits ou autorisé à agir en son nom.',
            )}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="micro-label text-gray-500">
            {t('Signature (type your full name)', 'Signature (tapez votre nom complet)')}
          </span>
          <input
            type="text"
            required
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            className="rounded-xl border border-gray-200 p-3 text-sm"
            data-testid="ip-signature"
          />
        </label>

        {error && (
          <p className="text-xs text-danger leading-relaxed" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="btn-primary w-full disabled:opacity-60"
          data-testid="ip-submit"
        >
          {status === 'sending'
            ? t('Submitting…', 'Envoi…')
            : t('Submit report', 'Envoyer le signalement')}
        </button>
      </form>
    </div>
  );
};

export default IpReport;
