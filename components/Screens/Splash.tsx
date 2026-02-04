import React, { useState } from 'react';
import { Screen } from '../../types';
import { Camera, MapPin, ShieldCheck, ArrowRight, Globe } from 'lucide-react';
import BrandLogo from '../BrandLogo';

interface Props {
  onStart: (screen: Screen) => void;
  language: 'en' | 'fr';
}

const Splash: React.FC<Props> = ({ onStart, language }) => {
  const [step, setStep] = useState(0);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const slides = [
    {
      title: t('Real-time infrastructure & price data for African cities.', 'Donnees d\'infrastructure et de prix en temps reel pour les villes africaines.'),
      desc: t('African Data Layer is a civic-tech platform for crowdsourced, fraud-resistant reporting.', 'African Data Layer est une plateforme civic-tech de signalement participatif resistante a la fraude.'),
      icon: <BrandLogo size={52} />,
      action: t('Continue', 'Continuer')
    },
    {
      title: t('Permission Use Notice', 'Avis d\'utilisation des permissions'),
      desc: t('Camera + location are required for geotagging and fraud prevention. No gallery uploads allowed.', 'La camera et la localisation sont requises pour le geotagging et la prevention de fraude. Import galerie interdit.'),
      icon: (
        <div className="flex items-center space-x-4 text-white">
          <Camera size={28} />
          <MapPin size={28} />
        </div>
      ),
      action: t('Allow Permissions', 'Autoriser les permissions')
    },
    {
      title: t('See the map', 'Voir la carte'),
      desc: t('Browse live fuel stations and mobile money kiosks in your city.', 'Parcourez les stations-service et kiosques mobile money de votre ville.'),
      icon: <MapPin size={46} className="text-[#0f2b46]" />,
      action: t('Next', 'Suivant')
    },
    {
      title: t('Contribute local info', 'Contribuez des infos locales'),
      desc: t('Capture live photos, add prices, and confirm availability in minutes.', 'Capturez des photos en direct, ajoutez les prix et confirmez la disponibilite en quelques minutes.'),
      icon: <Camera size={46} className="text-[#0f2b46]" />,
      action: t('Next', 'Suivant')
    },
    {
      title: t('Earn rewards, power change', 'Gagnez des recompenses, creez le changement'),
      desc: t('Collect XP, unlock badges, and redeem local rewards.', 'Gagnez des XP, debloquez des badges et echangez des recompenses locales.'),
      icon: <ShieldCheck size={46} className="text-[#0f2b46]" />,
      action: t('Get Started', 'Commencer')
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    }
  };

  const isFinalSlide = step === slides.length - 1;
  const heroIconBg = step === 0 ? 'bg-white' : step < 2 ? 'bg-[#0f2b46]' : 'bg-[#f2f4f7]';

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] text-[#1f2933]">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-700">
        <div className={`w-24 h-24 ${heroIconBg} rounded-2xl flex items-center justify-center mb-10 shadow-xl`}>
          {slides[step].icon}
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-4 text-[#1f2933]">{slides[step].title}</h1>
        <p className="text-sm text-gray-500 max-w-[280px] leading-relaxed mb-12">
          {slides[step].desc}
        </p>
      </div>

      <div className="px-8 pb-12 space-y-4">
        <div className="flex justify-center space-x-1.5 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-[#0f2b46]' : 'w-2 bg-gray-200'}`} />
          ))}
        </div>

        {!isFinalSlide && (
          <button
            onClick={handleNext}
            className="w-full h-14 bg-[#0f2b46] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all"
          >
            <span>{slides[step].action}</span>
            <ArrowRight size={18} />
          </button>
        )}

        {isFinalSlide && (
          <div className="space-y-3">
            <button
              onClick={() => onStart(Screen.HOME)}
              className="w-full h-14 bg-white text-[#0f2b46] border border-[#0f2b46]/20 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-[#f2f4f7] transition-all"
            >
              {t('Browse as Guest', 'Continuer en invite')}
            </button>
            <button
              onClick={() => onStart(Screen.AUTH)}
              className="w-full h-14 bg-[#c86b4a] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-[#b85f3f] transition-all"
            >
              <Globe size={16} />
              <span>{t('Sign In', 'Connexion')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Splash;
