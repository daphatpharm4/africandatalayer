import React from 'react';
import { Copy, Download, FileSpreadsheet, FileText, Map as MapIcon, Printer } from 'lucide-react';

type ExportFormat = 'csv' | 'geojson' | 'pdf';

interface Props {
  language: 'en' | 'fr';
  apiPreview: string;
  selectedFormat: ExportFormat;
  onSelectFormat: (format: ExportFormat) => void;
  onExport: (format: ExportFormat) => void;
  onCopyApi: () => void;
}

const ExportPanel: React.FC<Props> = ({
  language,
  apiPreview,
  selectedFormat,
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
    <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
            {t('Export Workflow', 'Workflow export')}
          </div>
          <h4 className="mt-1 text-lg font-bold text-gray-900">
            {t('Capture the current story', 'Capturer l histoire actuelle')}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => onExport('pdf')}
          className="h-10 w-10 rounded-2xl bg-[#0f2b46] text-white flex items-center justify-center"
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
            className={`h-12 rounded-2xl border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${
              selectedFormat === option.id
                ? 'border-[#0f2b46] bg-[#0f2b46] text-white'
                : 'border-gray-100 bg-[#f9fafb] text-gray-700'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-[#f9fafb] p-4 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {t('API Preview', 'Apercu API')}
        </div>
        <code className="block text-xs text-[#0f2b46] break-all">{apiPreview}</code>
        <button
          type="button"
          onClick={onCopyApi}
          className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]"
        >
          <Copy size={12} />
          {t('Copy API Path', 'Copier le chemin API')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onExport(selectedFormat)}
        className="w-full h-12 rounded-2xl bg-[#c86b4a] text-white text-xs font-bold uppercase tracking-widest"
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
