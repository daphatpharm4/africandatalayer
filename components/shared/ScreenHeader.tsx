import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  onBack: () => void;
  language: 'en' | 'fr';
  /** Optional right-side action */
  trailing?: React.ReactNode;
  /** Override background/text for dark headers (e.g. AdminQueue) */
  variant?: 'default' | 'dark';
}

const ScreenHeader: React.FC<Props> = ({ title, onBack, language, trailing, variant = 'default' }) => {
  const backLabel = language === 'fr' ? 'Retour' : 'Go back';

  const wrapperClass = variant === 'dark'
    ? 'sticky top-0 z-30 bg-ink text-white px-4 h-14 flex items-center justify-between'
    : 'screen-header';

  const backClass = variant === 'dark'
    ? 'p-2 -ml-2 hover:text-terra transition-colors'
    : 'btn-back';

  return (
    <div className={wrapperClass}>
      <button onClick={onBack} className={backClass} aria-label={backLabel}>
        <ArrowLeft size={20} />
      </button>
      <h1 className={`text-sm font-bold mx-auto ${variant === 'dark' ? 'text-xs uppercase tracking-[0.2em]' : ''}`}>
        {title}
      </h1>
      {trailing ? (
        <div className="absolute right-2">{trailing}</div>
      ) : (
        <div className="w-8" />
      )}
    </div>
  );
};

export default ScreenHeader;
