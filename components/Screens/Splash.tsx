import React, { useState } from 'react';
import { Screen } from '../../types';
import { Camera, MapPin, ShieldCheck, ArrowRight, Globe } from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { runViewTransition } from '../../lib/client/motion';

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
      desc: t('Browse Bonamoussadi points across pharmacies, fuel stations, and mobile money kiosks.', 'Parcourez les points de Bonamoussadi: pharmacies, stations-service et kiosques mobile money.'),
      icon: <MapPin size={46} className="text-navy" />,
      action: t('Next', 'Suivant')
    },
    {
      title: t('Contribute local info', 'Contribuez des infos locales'),
      desc: t('Capture live photos, add prices, and confirm availability in minutes.', 'Capturez des photos en direct, ajoutez les prix et confirmez la disponibilite en quelques minutes.'),
      icon: <Camera size={46} className="text-navy" />,
      action: t('Next', 'Suivant')
    },
    {
      title: t('Earn rewards, power change', 'Gagnez des recompenses, creez le changement'),
      desc: t('Collect XP, unlock badges, and redeem local rewards.', 'Gagnez des XP, debloquez des badges et echangez des recompenses locales.'),
      icon: <ShieldCheck size={46} className="text-navy" />,
      action: t('Get Started', 'Commencer')
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      void runViewTransition(() => setStep(step + 1));
    }
  };

  const isFinalSlide = step === slides.length - 1;
  const heroIconBg = step === 0 ? 'bg-white' : step < 2 ? 'bg-navy' : 'bg-gray-100';
  const introHighlights = [
    t('Live capture', 'Capture live'),
    t('GPS proof', 'Preuve GPS'),
    t('Rewarded quality', 'Qualite recompensee'),
  ];

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-page text-ink route-grid-soft">
      <div className="ambient-orb left-[-4rem] top-[10%] h-36 w-36 bg-gold/20" />
      <div className="ambient-orb right-[-3rem] top-[18%] h-28 w-28 bg-terra/20" style={{ animationDelay: '-2.2s' }} />
      <div className="ambient-orb bottom-[22%] right-[8%] h-24 w-24 bg-navy/10" style={{ animationDelay: '-4.2s' }} />

      <div className="relative z-10 flex flex-1 flex-col px-6 pt-8 pb-6 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white/90 px-3 py-2 shadow-sm">
            <BrandLogo size={18} className="shrink-0" />
            <span className="micro-label text-navy">ADL</span>
          </div>
          <div className="rounded-full bg-white/90 px-3 py-2 micro-label text-gray-500 shadow-sm">
            {step + 1}/{slides.length}
          </div>
        </div>

        <div key={step} className="surface-reveal relative flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            {introHighlights.map((highlight, index) => (
              <span
                key={highlight}
                className={`rounded-full border px-3 py-1.5 micro-label shadow-sm ${
                  index === step % introHighlights.length
                    ? 'border-terra/30 bg-terra-wash text-terra'
                    : 'border-gray-200 bg-white/90 text-gray-500'
                }`}
              >
                {highlight}
              </span>
            ))}
          </div>

          <div className="relative mb-10">
            <div className="absolute inset-[-16px] rounded-[2rem] bg-white/60" />
            <div className="absolute inset-[-12px] rounded-[2rem] border border-white ring-pulse" />
            <div
              className={`relative z-10 flex h-28 w-28 items-center justify-center rounded-[2rem] ${heroIconBg}`}
              style={{ boxShadow: 'var(--shadow-lift)' }}
            >
              {slides[step].icon}
            </div>
          </div>

          <div className="max-w-[21rem]">
            <p className="micro-label-wide text-terra">{t('Mission-ready onboarding', 'Onboarding pret pour mission')}</p>
            <h1 className="mt-3 text-[2rem] font-extrabold tracking-tight text-ink">{slides[step].title}</h1>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              {slides[step].desc}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="micro-label-wide text-gray-400">{t('Why agents trust this flow', 'Pourquoi les agents font confiance a ce flux')}</div>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  {step < 2
                    ? t('Fast orientation before first capture', 'Orientation rapide avant la premiere capture')
                    : t('Clear next step, clear reward, clear proof', 'Action claire, recompense claire, preuve claire')}
                </div>
              </div>
              <div className="rounded-2xl bg-navy-wash px-3 py-2 text-right">
                <div className="micro-label text-navy">{t('Mode', 'Mode')}</div>
                <div className="text-sm font-bold text-navy">{step < 2 ? t('Setup', 'Preparation') : t('Action', 'Action')}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-1.5">
          {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-10 bg-navy' : i < step ? 'w-4 bg-terra/60' : 'w-3 bg-gray-200'
                }`}
              />
          ))}
          </div>

          {!isFinalSlide && (
            <button
              onClick={handleNext}
              className="motion-pressable w-full h-14 rounded-[1.2rem] bg-navy text-white font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2"
              style={{ boxShadow: 'var(--shadow-lift)' }}
            >
              <span>{slides[step].action}</span>
              <ArrowRight size={18} />
            </button>
          )}

          {isFinalSlide && (
            <div className="space-y-3">
              <button
                onClick={() => onStart(Screen.HOME)}
                className="motion-pressable w-full h-14 rounded-[1.2rem] bg-white text-navy border border-navy/20 font-bold uppercase text-xs tracking-widest"
              >
                {t('Browse as Guest', 'Continuer en invite')}
              </button>
              <button
                onClick={() => onStart(Screen.AUTH)}
                className="motion-pressable button-breathe w-full h-14 rounded-[1.2rem] bg-terra text-white font-bold uppercase text-xs tracking-widest flex items-center justify-center space-x-2"
                style={{ boxShadow: 'var(--shadow-terra)' }}
              >
                <Globe size={16} />
                <span>{t('Sign In', 'Connexion')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Splash;
