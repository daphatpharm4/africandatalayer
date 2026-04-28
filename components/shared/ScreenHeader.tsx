import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  language: 'en' | 'fr';
  trailing?: React.ReactNode;
  variant?: 'default' | 'dark';
  routeGrid?: boolean;
}

const ScreenHeader: React.FC<Props> = ({
  title,
  subtitle,
  onBack,
  language,
  trailing,
  variant = 'default',
  routeGrid = false,
}) => {
  const backLabel = language === 'fr' ? 'Retour' : 'Go back';
  const isDark = variant === 'dark';

  const wrapperClass = [
    'sticky top-0 z-30 grid grid-cols-[44px_1fr_44px] items-center gap-2 px-4 py-2.5',
    'min-h-[60px] border-b border-gray-100',
    isDark ? 'bg-ink text-white' : 'bg-white text-ink',
    routeGrid ? 'route-grid' : '',
  ].join(' ');

  const backClass = isDark
    ? 'flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:text-terra'
    : 'flex h-11 w-11 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-50';

  return (
    <header className={wrapperClass}>
      {onBack ? (
        <button onClick={onBack} className={backClass} aria-label={backLabel} type="button">
          <ArrowLeft size={20} />
        </button>
      ) : (
        <div />
      )}
      <div className="min-w-0 text-center">
        <div className={`truncate font-display font-bold leading-tight ${isDark ? 'text-xs uppercase tracking-[0.16em]' : 'text-[15px]'}`}>
          {title}
        </div>
        {subtitle && (
          <div className={`mt-0.5 truncate text-[11px] ${isDark ? 'text-white/70' : 'text-gray-500'}`}>
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex min-w-11 items-center justify-end">{trailing ?? null}</div>
    </header>
  );
};

export default React.memo(ScreenHeader);
