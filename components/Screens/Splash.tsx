
import React, { useState } from 'react';
import { Screen } from '../../types';
import { Layers, ChevronRight, Camera, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';

interface Props {
  onStart: (screen: Screen) => void;
}

const Splash: React.FC<Props> = ({ onStart }) => {
  const [step, setStep] = useState(0);

  const slides = [
    {
      title: "Real-world data. Built for Africa.",
      desc: "Institutional infrastructure intelligence collected on the ground.",
      icon: <Layers size={48} className="text-white" />,
      action: "Next"
    },
    {
      title: "Enable Permissions",
      desc: "We use location and camera to verify real-world prices and prevent fraud.",
      icon: <div className="flex space-x-4"><Camera size={32} /><MapPin size={32} /></div>,
      action: "Allow Access"
    },
    {
      title: "📍 See what others reported",
      desc: "Explore real-time data on fuel stations and kiosks around you.",
      icon: <MapPin size={48} />,
      action: "Next"
    },
    {
      title: "🤳 Contribute & Earn Rewards",
      desc: "Report local data to earn XP redeemable for airtime and vouchers.",
      icon: <ShieldCheck size={48} />,
      action: "Get Started"
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onStart(Screen.HOME);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] text-[#111827]">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-blue-100">
          {slides[step].icon}
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-4 text-gray-900">{slides[step].title}</h1>
        <p className="text-sm text-gray-500 max-w-[280px] leading-relaxed mb-12">
          {slides[step].desc}
        </p>
      </div>

      <div className="px-8 pb-12 space-y-4">
        <div className="flex justify-center space-x-1.5 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-blue-600' : 'w-2 bg-gray-200'}`} />
          ))}
        </div>
        
        <button
          onClick={handleNext}
          className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all"
        >
          <span>{slides[step].action}</span>
          <ArrowRight size={18} />
        </button>

        {step === 0 && (
          <button
            onClick={() => onStart(Screen.AUTH)}
            className="w-full h-14 bg-white text-blue-600 border border-blue-100 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-blue-50 transition-all"
          >
            Contributor Login
          </button>
        )}
      </div>
    </div>
  );
};

export default Splash;
