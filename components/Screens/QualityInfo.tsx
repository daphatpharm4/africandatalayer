import React from 'react';
import { ArrowLeft, ShieldCheck, UserCheck, Search, Database } from 'lucide-react';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

const QualityInfo: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">{t('Data Quality & Trust', 'Qualite et confiance des donnees')}</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-6 space-y-8">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-[#e7eef4] text-[#0f2b46] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('How we ensure reliability', 'Comment nous garantissons la fiabilite')}</h2>
          <p className="text-sm text-gray-500 leading-relaxed px-4">
            {t('Every data point on African Data Layer undergoes a multi-layered validation process to maintain institutional standards.', 'Chaque point de donnee sur African Data Layer suit un processus de validation multi-couches pour maintenir des standards eleves.')}
          </p>
        </div>

        <div className="space-y-4">
          {[
            { title: t('Community Verification', 'Verification communautaire'), desc: t('New submissions are cross-referenced by nearby contributors in real time.', 'Les nouvelles soumissions sont verifiees en temps reel par des contributeurs proches.'), icon: <Users size={20} /> },
            { title: t('Automated Integrity Checks', 'Controles automatiques d\'integrite'), desc: t('Systems detect statistical outliers and potential fraud patterns.', 'Le systeme detecte les valeurs aberrantes et les schemas potentiels de fraude.'), icon: <Search size={20} /> },
            { title: t('Reputation Scoring', 'Score de reputation'), desc: t('Contributors build a history of trust. High-trust users carry more weight.', 'Les contributeurs construisent un historique de confiance. Les profils fiables ont plus de poids.'), icon: <UserCheck size={20} /> },
            { title: t('Ground Truth Audits', 'Audits terrain'), desc: t('Random physical inspections by senior contributors ensure accuracy.', 'Des inspections physiques aleatoires par des contributeurs seniors assurent la precision.'), icon: <Database size={20} /> }
          ].map((step, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
              <div className="p-3 bg-[#e7eef4] text-[#0f2b46] rounded-2xl">
                {step.icon}
              </div>
              <div className="flex flex-col space-y-1">
                <h4 className="text-sm font-bold text-gray-900">{step.title}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#0f2b46] rounded-2xl p-6 text-white space-y-4 shadow-xl">
          <h4 className="text-xs font-bold uppercase tracking-widest">{t('Our Sovereignty Principle', 'Notre principe de souverainete')}</h4>
          <p className="text-sm leading-relaxed opacity-90">
            {t('African data, stored and governed locally. We believe infrastructure intelligence should serve the people who build it.', 'Donnees africaines, stockees et gouvernees localement. Nous pensons que l\'intelligence d\'infrastructure doit servir ceux qui la construisent.')}
          </p>
          <button className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-4 py-2 rounded-xl hover:bg-white/30 transition-colors">
            {t('Read Governance Framework', 'Lire le cadre de gouvernance')}
          </button>
        </div>

        <div className="h-24"></div>
      </div>
    </div>
  );
};

const Users = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

export default QualityInfo;
