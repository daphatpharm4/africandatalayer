import React, { useState } from 'react';
import ScreenHeader from '../shared/ScreenHeader';
import { apiFetch } from '../../lib/client/api';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

type RequestType = 'access' | 'rectification' | 'erasure';

const DataCompliance: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(requestType: RequestType) {
    setStatus('sending');
    setMessage(null);
    try {
      const response = await apiFetch('/api/privacy?view=requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          subjectReference: '',
          notes: t(
            `Self-service ${requestType} request from in-app screen.`,
            `Demande ${requestType} initiée depuis l'application.`,
          ),
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        setStatus('error');
        setMessage(text || t('Request failed. Please try again.', 'La demande a échoué. Veuillez réessayer.'));
        return;
      }
      setStatus('ok');
      setMessage(
        t(
          'Request submitted. Our team will respond within 30 days.',
          'Demande envoyée. Notre équipe répondra sous 30 jours.',
        ),
      );
    } catch {
      setStatus('error');
      setMessage(t('Network error. Please try again.', 'Erreur réseau. Veuillez réessayer.'));
    }
  }

  const actions: { type: RequestType; label: string; desc: string }[] = [
    {
      type: 'access',
      label: t('Request data access', "Demander l'accès aux données"),
      desc: t('Get a copy of all personal data we hold about you.', "Recevoir une copie de toutes les données personnelles que nous détenons à votre sujet."),
    },
    {
      type: 'rectification',
      label: t('Request rectification', 'Demander une rectification'),
      desc: t('Correct inaccurate or incomplete data.', 'Corriger des données inexactes ou incomplètes.'),
    },
    {
      type: 'erasure',
      label: t('Request erasure', "Demander l'effacement"),
      desc: t('Delete your account and personal submissions.', 'Supprimer votre compte et vos soumissions personnelles.'),
    },
  ];

  return (
    <div data-testid="screen-data-compliance" className="screen-shell">
      <ScreenHeader
        title={t('Data & Compliance', 'Données et conformité')}
        onBack={onBack}
        language={language}
      />
      <div className="p-6 pb-24 space-y-6">
        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('What we store', 'Ce que nous stockons')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'Your identifier, display name, hashed password, avatar preset, map scope, XP, trust score, audit log, and the submissions you capture (category, GPS, photos, EXIF).',
              'Votre identifiant, nom affiché, mot de passe haché, préréglage d\'avatar, périmètre cartographique, XP, score de confiance, journal d\'audit et les soumissions que vous capturez (catégorie, GPS, photos, EXIF).',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('Consent states', 'États de consentement')}
          </h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1">
            <li>{t('Obtained — subject gave explicit consent.', 'Obtenu — la personne a donné un consentement explicite.')}</li>
            <li>{t('Refused PII only — data collected without personal identifiers.', 'Refusé PII uniquement — données collectées sans identifiants personnels.')}</li>
            <li>{t('Not required — purely observational public data.', 'Non requis — données publiques purement observationnelles.')}</li>
            <li>{t('Withdrawn — consent revoked; personal identifiers erased.', 'Retiré — consentement révoqué ; identifiants personnels effacés.')}</li>
          </ul>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('Processors', 'Sous-traitants')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Supabase · Vercel · Sentry · Google Identity · Resend.
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('Your rights', 'Vos droits')}
          </h2>
          <div className="space-y-3">
            {actions.map((a) => (
              <button
                key={a.type}
                type="button"
                onClick={() => submit(a.type)}
                disabled={status === 'sending'}
                className="w-full text-left rounded-2xl border border-gray-200 bg-white p-4 active:scale-95 transition-all disabled:opacity-60"
                data-testid={`compliance-${a.type}`}
              >
                <div className="text-sm font-semibold text-ink">{a.label}</div>
                <div className="text-xs text-gray-600 mt-1 leading-relaxed">{a.desc}</div>
              </button>
            ))}
          </div>
          {message && (
            <p
              className={`text-xs leading-relaxed ${status === 'ok' ? 'text-forest' : 'text-danger'}`}
              role="status"
            >
              {message}
            </p>
          )}
        </section>

        <section className="card p-5 space-y-2">
          <h2 className="text-base font-bold text-ink">
            {t('Contact', 'Contact')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">privacy@africandatalayer.com</p>
        </section>
      </div>
    </div>
  );
};

export default DataCompliance;
