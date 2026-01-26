import React, { useState } from 'react';
import { Screen } from '../../types';
import { Layers, Camera, MapPin, ShieldCheck, ArrowRight, Globe } from 'lucide-react';

interface Props {
  onStart: (screen: Screen) => void;
}

const Splash: React.FC<Props> = ({ onStart }) => {
  const [step, setStep] = useState(0);

  const slides = [
    {
      title: 'Real-time infrastructure & price data for African cities.',
      desc: 'African Data Layer is a civic-tech platform for crowdsourced, fraud-resistant reporting.',
      icon: <Layers size={46} className="text-white" />,
      action: 'Continue'
    },
    {
      title: 'Permission Use Notice',
      desc: 'Camera + location are required for geotagging and fraud prevention. No gallery uploads allowed.',
      icon: (
        <div className="flex items-center space-x-4 text-white">
          <Camera size={28} />
          <MapPin size={28} />
        </div>
      ),
      action: 'Allow Permissions'
    },
    {
      title: 'See the map',
      desc: 'Browse live fuel stations and mobile money kiosks in your city.',
      icon: <MapPin size={46} className="text-[#0f2b46]" />,
      action: 'Next'
    },
    {
      title: 'Contribute local info',
      desc: 'Capture live photos, add prices, and confirm availability in minutes.',
      icon: <Camera size={46} className="text-[#0f2b46]" />,
      action: 'Next'
    },
    {
      title: 'Earn rewards, power change',
      desc: 'Collect XP, unlock badges, and redeem local rewards.',
      icon: <ShieldCheck size={46} className="text-[#0f2b46]" />,
      action: 'Get Started'
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    }
  };

  const isFinalSlide = step === slides.length - 1;

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] text-[#1f2933]">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-700">
        <div className={`w-24 h-24 ${step < 2 ? 'bg-[#0f2b46]' : 'bg-[#f2f4f7]'} rounded-2xl flex items-center justify-center mb-10 shadow-xl`}>
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
              Browse as Guest
            </button>
            <button
              onClick={() => onStart(Screen.AUTH)}
              className="w-full h-14 bg-[#c86b4a] text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 hover:bg-[#b85f3f] transition-all"
            >
              <Globe size={16} />
              <span>Create Account</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Splash;
