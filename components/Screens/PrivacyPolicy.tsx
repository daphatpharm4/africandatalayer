import React from 'react';
import ScreenHeader from '../shared/ScreenHeader';
import {
  POLICY_VERSIONS,
  POLICY_EFFECTIVE_DATES,
} from '../../shared/legalPolicies';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

const PrivacyPolicy: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const version = POLICY_VERSIONS.privacy;
  const effective = POLICY_EFFECTIVE_DATES.privacy;

  return (
    <div data-testid="screen-privacy-policy" className="screen-shell">
      <ScreenHeader
        title={t('Privacy Policy', 'Politique de confidentialité')}
        onBack={onBack}
        language={language}
      />
      <div className="p-6 pb-24 space-y-6">
        <p className="micro-label text-gray-500">
          {t(
            `Version ${version} · Effective ${effective}`,
            `Version ${version} · En vigueur le ${effective}`,
          )}
        </p>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('1. Data controller', '1. Responsable du traitement')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'African Data Layer operates this platform to collect field data about public infrastructure in Cameroon. We act as the data controller for all personal data processed through the app.',
              "African Data Layer exploite cette plateforme pour collecter des données de terrain sur les infrastructures publiques au Cameroun. Nous agissons comme responsable du traitement de toutes les données personnelles traitées dans l'application.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('2. What we collect', '2. Ce que nous collectons')}
          </h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-2">
            <li>
              {t(
                'Account identifiers: phone or email, display name, hashed password, avatar preset, map scope preference.',
                "Identifiants de compte : téléphone ou email, nom affiché, mot de passe haché, préréglage d'avatar, préférence de périmètre cartographique.",
              )}
            </li>
            <li>
              {t(
                'Submissions: category, GPS coordinates, photos, device EXIF, accelerometer samples, captured timestamps.',
                'Soumissions : catégorie, coordonnées GPS, photos, EXIF du dispositif, échantillons de capteurs, horodatage.',
              )}
            </li>
            <li>
              {t(
                'Security telemetry: IP address (hashed), user agent, failed-login counters, audit log entries.',
                "Télémétrie de sécurité : adresse IP (hachée), user agent, compteurs d'échec de connexion, journal d'audit.",
              )}
            </li>
          </ul>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('3. Why we process it', '3. Pourquoi nous le traitons')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'We process data to: operate the data-collection service, score submission quality, detect fraud, calculate XP and rewards, fulfill legal obligations, and produce aggregated public-interest insights.',
              "Nous traitons les données pour : exploiter le service de collecte, évaluer la qualité des soumissions, détecter la fraude, calculer XP et récompenses, répondre aux obligations légales et produire des analyses agrégées d'intérêt public.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('4. Legal basis', '4. Base légale')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'Cameroonian Law 2010/012 on cybersecurity and personal-data protection. Where relevant for cross-border viewers, we also align with GDPR principles of lawfulness, purpose limitation, data minimisation, and storage limitation.',
              'Loi camerounaise n° 2010/012 relative à la cybersécurité et à la protection des données à caractère personnel. Pour les visiteurs transfrontaliers, nous nous alignons également sur les principes RGPD de licéité, limitation des finalités, minimisation et limitation de conservation.',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('5. Retention', '5. Conservation')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'Account data is retained for the life of the account plus 24 months. Submission records are retained for 5 years for quality audits; photos are retained 18 months unless flagged for investigation. Security audit logs are retained 24 months.',
              "Les données de compte sont conservées pour la durée du compte plus 24 mois. Les soumissions sont conservées 5 ans pour audit qualité ; les photos 18 mois sauf signalement. Le journal d'audit de sécurité est conservé 24 mois.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('6. Sharing', '6. Partage')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'We share data with processors who host, authenticate, monitor, or back up the service (Supabase, Vercel, Sentry, Google). We publish aggregated statistics to partners and the public. We never sell personal data.',
              'Nous partageons les données avec les sous-traitants qui hébergent, authentifient, surveillent ou sauvegardent le service (Supabase, Vercel, Sentry, Google). Nous publions des statistiques agrégées à des partenaires et au public. Nous ne vendons jamais de données personnelles.',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('7. Your rights', '7. Vos droits')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'You may request access, rectification, erasure, or objection at any time. Use the Data & Compliance screen in Settings, or email privacy@africandatalayer.com. We respond within 30 days.',
              "Vous pouvez demander accès, rectification, effacement ou opposition à tout moment. Utilisez l'écran Données et conformité dans Paramètres, ou écrivez à privacy@africandatalayer.com. Nous répondons sous 30 jours.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('8. Contact', '8. Contact')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            privacy@africandatalayer.com
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
