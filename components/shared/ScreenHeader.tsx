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
    ? 'sticky top-0 z-30 grid min-h-16 grid-cols-[auto,1fr,auto] items-center gap-2 bg-ink px-4 py-3 text-white'
    : 'screen-header';

  const backClass = variant === 'dark'
    ? 'p-2 -ml-2 hover:text-terra transition-colors'
    : 'btn-back';

  return (
    <div className={wrapperClass}>
      <button onClick={onBack} className={backClass} aria-label={backLabel}>
        <ArrowLeft size={20} />
      </button>
      <h1
        className={`min-w-0 px-1 text-center font-bold leading-tight ${
          variant === 'dark' ? 'text-xs uppercase tracking-[0.16em]' : 'text-sm text-ink'
        }`}
      >
        {title}
      </h1>
      {trailing ? (
        <div className="flex min-w-[40px] justify-end">{trailing}</div>
      ) : (
        <div className="w-10" />
      )}
    </div>
  );
};

export default ScreenHeader;
