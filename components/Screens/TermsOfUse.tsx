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

const TermsOfUse: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const version = POLICY_VERSIONS.terms;
  const effective = POLICY_EFFECTIVE_DATES.terms;

  return (
    <div data-testid="screen-terms-of-use" className="screen-shell">
      <ScreenHeader
        title={t('Terms of Use', "Conditions d'utilisation")}
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
            {t('1. Agreement', '1. Acceptation')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'By creating an account, you agree to these Terms and the Privacy Policy. If you do not agree, do not use the service.',
              'En créant un compte, vous acceptez les présentes Conditions et la Politique de confidentialité. Si vous refusez, n\'utilisez pas le service.',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('2. Accounts', '2. Comptes')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'You must be 18 or older. One account per person. You are responsible for keeping credentials secure. We may suspend or delete accounts used for fraud or abuse.',
              'Vous devez avoir 18 ans ou plus. Un compte par personne. Vous êtes responsable de la confidentialité de vos identifiants. Nous pouvons suspendre ou supprimer les comptes utilisés à des fins frauduleuses ou abusives.',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('3. Acceptable use', '3. Usage acceptable')}
          </h2>
          <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-2">
            <li>{t('No fabricated locations, photos, or prices.', 'Aucune localisation, photo ou prix fabriqué.')}</li>
            <li>{t('No mock GPS, emulators, or spoofing tools.', 'Aucun GPS simulé, émulateur ou outil de falsification.')}</li>
            <li>{t('No submission of third-party copyrighted content without rights.', 'Aucune soumission de contenu couvert par des droits tiers sans autorisation.')}</li>
            <li>{t('No personal attack, harassment, or unlawful content.', 'Aucune attaque personnelle, harcèlement ou contenu illicite.')}</li>
          </ul>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('4. Data rights & license', '4. Droits & licence sur les données')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'You grant African Data Layer a worldwide, royalty-free, irrevocable license to use, store, reproduce, and publish aggregated or anonymised insights derived from your submissions. Personal identifiers remain yours.',
              "Vous accordez à African Data Layer une licence mondiale, gratuite et irrévocable pour utiliser, stocker, reproduire et publier des analyses agrégées ou anonymisées issues de vos soumissions. Les identifiants personnels restent votre propriété.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('5. Rewards & compensation', '5. Récompenses et rétribution')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'XP, streaks, and badges are non-monetary. Cash-equivalent rewards are subject to the Rewards Catalog terms and may be revoked in cases of fraud or dispute.',
              "XP, séries et badges ne sont pas monétaires. Les récompenses à valeur marchande sont soumises aux conditions du catalogue Rewards et peuvent être révoquées en cas de fraude ou de litige.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('6. Termination', '6. Résiliation')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'Either party may terminate at any time. We may suspend access without notice for violations. You may request deletion via the Data & Compliance screen.',
              "Chaque partie peut résilier à tout moment. Nous pouvons suspendre l'accès sans préavis en cas de violation. Vous pouvez demander la suppression via l'écran Données et conformité.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('7. Liability', '7. Responsabilité')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'The service is provided "as is". To the maximum extent permitted by law, African Data Layer disclaims warranties and limits liability to direct damages not exceeding fees paid in the last 12 months.',
              'Le service est fourni « en l\'état ». Dans la mesure maximale permise, African Data Layer décline toute garantie et limite sa responsabilité aux dommages directs ne dépassant pas les frais payés au cours des 12 derniers mois.',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('8. Governing law', '8. Droit applicable')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'These Terms are governed by the laws of the Republic of Cameroon and the OHADA Uniform Acts. Disputes are first subject to good-faith negotiation, then to the competent courts of Douala.',
              "Les présentes Conditions sont régies par les lois de la République du Cameroun et les Actes uniformes OHADA. Les litiges sont d'abord soumis à une négociation de bonne foi, puis aux tribunaux compétents de Douala.",
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('9. Changes', '9. Modifications')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {t(
              'We may update these Terms. Material changes increment the version and require re-acceptance before continued use.',
              'Nous pouvons mettre à jour ces Conditions. Les changements importants incrémentent la version et exigent une nouvelle acceptation avant toute utilisation.',
            )}
          </p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t('10. Contact', '10. Contact')}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">legal@africandatalayer.com</p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfUse;
