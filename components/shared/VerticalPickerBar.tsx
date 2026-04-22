import React from 'react';
import { ChevronDown } from 'lucide-react';
import { categoryLabel, normalizeCategoryAlias } from '../../shared/verticals';
import { Category } from '../../types';

type Language = 'en' | 'fr';

interface VerticalPickerBarProps {
  active: Category;
  onToggle: () => void;
  language: Language;
}

const ACCENT_CLASS: Record<Category, string> = {
  [Category.PHARMACY]: 'border-l-forest',
  [Category.FUEL]: 'border-l-terra',
  [Category.MOBILE_MONEY]: 'border-l-navy',
  [Category.ALCOHOL_OUTLET]: 'border-l-danger',
  [Category.BILLBOARD]: 'border-l-gold',
  [Category.TRANSPORT_ROAD]: 'border-l-gray-400',
  [Category.CENSUS_PROXY]: 'border-l-gray-600',
};

function VerticalPickerBar({ active, onToggle, language }: VerticalPickerBarProps) {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const normalizedCategory = normalizeCategoryAlias(active) ?? null;
  const label = normalizedCategory ? categoryLabel(normalizedCategory, language) : active;
  const accentClass = ACCENT_CLASS[active] ?? 'border-l-terra';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`motion-pressable flex h-12 w-full items-center gap-2 rounded-2xl border-l-[3px] bg-gray-100 pl-3 pr-4 text-navy ${accentClass}`}
    >
      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
        {t('Category', 'Catégorie')}: {label}
      </span>
      <ChevronDown size={16} className="shrink-0 text-gray-500" />
    </button>
  );
}

export default React.memo(VerticalPickerBar);
