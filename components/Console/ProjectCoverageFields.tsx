import React from 'react';
import type { PlatformProjectCoverageScope } from '../../shared/platformTypes';

interface ProjectCoverageFieldsProps {
  scope: PlatformProjectCoverageScope;
  label: string;
  onScopeChange: (scope: PlatformProjectCoverageScope) => void;
  onLabelChange: (label: string) => void;
  language: 'en' | 'fr';
  disabled?: boolean;
  idPrefix: string;
}

const ProjectCoverageFields: React.FC<ProjectCoverageFieldsProps> = ({
  scope,
  label,
  onScopeChange,
  onLabelChange,
  language,
  disabled = false,
  idPrefix,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const needsLabel = scope !== 'worldwide';

  return (
    <fieldset className="space-y-4">
      <legend className="px-1 text-xs font-semibold text-gray-500">
        {t('Collection coverage', 'Zone de collecte')}
      </legend>
      <p className="px-1 text-xs leading-5 text-ink-muted">
        {t(
          'Choose where this project operates. Field maps still open around each collector’s live location.',
          'Choisissez où ce projet opère. La carte terrain s’ouvre toujours autour de la position réelle de chaque collecteur.',
        )}
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Coverage type', 'Type de zone')}>
        {([
          ['town', t('Town', 'Ville')],
          ['country', t('Country', 'Pays')],
          ['worldwide', t('Worldwide', 'Monde')],
        ] as Array<[PlatformProjectCoverageScope, string]>).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            disabled={disabled}
            onClick={() => onScopeChange(value)}
            className={`min-h-12 rounded-xl border px-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
              scope === value
                ? 'border-navy bg-navy text-white'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      {needsLabel && (
        <div className="space-y-2">
          <label className="px-1 text-xs font-semibold text-gray-500" htmlFor={`${idPrefix}-coverage-label`}>
            {scope === 'town' ? t('Town name', 'Nom de la ville') : t('Country name', 'Nom du pays')}
          </label>
          <input
            id={`${idPrefix}-coverage-label`}
            type="text"
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            disabled={disabled}
            placeholder={scope === 'town' ? t('e.g. Nairobi', 'p. ex. Nairobi') : t('e.g. Kenya', 'p. ex. Kenya')}
            className="h-14 w-full rounded-2xl border border-gray-100 bg-white px-4 text-base text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-navy focus:outline-none disabled:bg-gray-50"
          />
        </div>
      )}
    </fieldset>
  );
};

export default ProjectCoverageFields;
