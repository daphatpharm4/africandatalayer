import React from 'react';
import { Copy, Download, FileSpreadsheet, FileText, Map as MapIcon, Printer } from 'lucide-react';

type ExportFormat = 'csv' | 'geojson' | 'pdf';

interface Props {
  language: 'en' | 'fr';
  apiPreview: string;
  selectedFormat: ExportFormat;
  canExport?: boolean;
  exportDisabledReason?: string | null;
  onSelectFormat: (format: ExportFormat) => void;
  onExport: (format: ExportFormat) => void;
  onCopyApi: () => void;
}

const ExportPanel: React.FC<Props> = ({
  language,
  apiPreview,
  selectedFormat,
  canExport = true,
  exportDisabledReason = null,
  onSelectFormat,
  onExport,
  onCopyApi,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const options: Array<{ id: ExportFormat; icon: React.ReactNode; label: string }> = [
    { id: 'csv', icon: <FileSpreadsheet size={14} />, label: t('CSV Snapshot', 'CSV snapshot') },
    { id: 'geojson', icon: <MapIcon size={14} />, label: t('GeoJSON Delta', 'GeoJSON delta') },
    { id: 'pdf', icon: <FileText size={14} />, label: t('PDF Report', 'Rapport PDF') },
  ];

  return (
    <div className="card-pill p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="micro-label-wide text-gray-400">
            {t('Export Workflow', 'Workflow export')}
          </div>
          <h4 className="mt-1 text-lg font-bold text-gray-900">
            {t('Capture the current story', 'Capturer l\'histoire actuelle')}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => onExport('pdf')}
          disabled={!canExport}
          className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
            canExport ? 'bg-navy text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          aria-label={t('Print report', 'Imprimer le rapport')}
        >
          <Printer size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelectFormat(option.id)}
            disabled={!canExport}
            className={`h-12 rounded-2xl border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${
              !canExport
                ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                : selectedFormat === option.id
                ? 'border-navy bg-navy text-white'
                : 'border-gray-100 bg-page text-gray-700'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-page p-4 space-y-2">
        <div className="micro-label text-gray-400">
          {t('API Preview', 'Aperçu API')}
        </div>
        <code className="block text-xs text-navy break-all">{apiPreview}</code>
        <button
          type="button"
          onClick={onCopyApi}
          className="inline-flex items-center gap-2 micro-label text-navy"
        >
          <Copy size={12} />
          {t('Copy API Path', 'Copier le chemin API')}
        </button>
      </div>

      {!canExport && exportDisabledReason && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-800">
          {exportDisabledReason}
        </div>
      )}

      <button
        type="button"
        onClick={() => onExport(selectedFormat)}
        disabled={!canExport}
        className={`w-full h-12 rounded-2xl text-xs font-bold uppercase tracking-widest ${
          canExport ? 'bg-terra text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <Download size={14} />
          {selectedFormat === 'pdf' ? t('Open Print Report', 'Ouvrir le rapport imprimable') : t('Export Current Filter', 'Exporter le filtre courant')}
        </span>
      </button>
    </div>
  );
};

export default ExportPanel;
