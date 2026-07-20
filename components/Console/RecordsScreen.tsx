import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Map as MapIcon,
  Table as TableIcon,
  Search,
  Filter,
  MapPin,
  Calendar,
  User,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import {
  listApprovedPlatformRecordsRequest,
  listProjectsRequest,
  exportPlatformRecordsCsv,
  exportPlatformRecordsGeojson,
  PlatformApiError,
} from '../../lib/client/platformApi';
import type { PlatformRecord, PlatformProject } from '../../shared/platformTypes';

interface RecordsScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
}

type ViewMode = 'table' | 'map';

const RecordsScreen: React.FC<RecordsScreenProps> = ({ organizationId, language }) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);
  const [records, setRecords] = useState<PlatformRecord[] | null>(null);
  const [projects, setProjects] = useState<PlatformProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'geojson' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setError(null);
    void listApprovedPlatformRecordsRequest(organizationId)
      .then((next) => { if (!cancelled) setRecords(next); })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof PlatformApiError && reason.status < 500
          ? reason.message
          : t('Could not load records. Check your connection and try again.', 'Impossible de charger les données. Vérifiez votre connexion et réessayez.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, selectedProject, t]);

  useEffect(() => {
    let cancelled = false;
    void listProjectsRequest(organizationId)
      .then((projs) => { if (!cancelled) setProjects(projs); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [organizationId]);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    let filtered = records;
    if (selectedProject) {
      filtered = filtered.filter((r) => r.projectId === selectedProject);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.recordTypeKey.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query) ||
        r.capturedBy.toLowerCase().includes(query) ||
        Object.values(r.data).some((v) =>
          String(v).toLowerCase().includes(query)
        )
      );
    }
    return filtered;
  }, [records, selectedProject, searchQuery]);

  const mapRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.evidence.gps?.latitude != null && r.evidence.gps?.longitude != null);
  }, [filteredRecords]);

  const handleExportCsv = useCallback(async () => {
    setExporting('csv');
    try {
      const csv = await exportPlatformRecordsCsv({
        organizationId,
        projectId: selectedProject || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform-records-${organizationId.slice(0, 8)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert(t('Export failed. Please try again.', "L'export a échoué. Veuillez réessayer."));
    } finally {
      setExporting(null);
    }
  }, [organizationId, selectedProject, t]);

  const handleExportGeojson = useCallback(async () => {
    setExporting('geojson');
    try {
      const geojson = await exportPlatformRecordsGeojson({
        organizationId,
        projectId: selectedProject || undefined,
      });
      const blob = new Blob([geojson], { type: 'application/geo+json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform-records-${organizationId.slice(0, 8)}.geojson`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GeoJSON export failed:', err);
      alert(t('Export failed. Please try again.', "L'export a échoué. Veuillez réessayer."));
    } finally {
      setExporting(null);
    }
  }, [organizationId, selectedProject, t]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFieldValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? t('Yes', 'Oui') : t('No', 'Non');
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <header className="rounded-3xl bg-navy p-6 text-white sm:p-8">
        <p className="micro-label text-white/70">{t('Company data', 'Données entreprise')}</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{t('Records', 'Données')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
          {t(
            'Browse approved records, export data, and visualize coverage on the map.',
            'Consultez les données approuvées, exportez les données et visualisez la couverture sur la carte.'
          )}
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder={t('Search records...', 'Rechercher...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-navy-border bg-white py-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-terra focus:outline-none focus:ring-1 focus:ring-terra"
            />
          </div>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded-lg border border-navy-border bg-white px-3 py-2 text-sm text-ink focus:border-terra focus:outline-none focus:ring-1 focus:ring-terra"
          >
            <option value="">{t('All projects', 'Tous les projets')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-navy-border bg-white">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-l-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-navy text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <TableIcon size={16} />
              {t('Table', 'Tableau')}
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 rounded-r-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'map'
                  ? 'bg-navy text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <MapIcon size={16} />
              {t('Map', 'Carte')}
            </button>
          </div>

          {/* Export buttons */}
          <button
            onClick={handleExportCsv}
            disabled={exporting !== null || filteredRecords.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-navy-border bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === 'csv' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-terra border-t-transparent" />
            ) : (
              <FileText size={16} />
            )}
            CSV
          </button>
          <button
            onClick={handleExportGeojson}
            disabled={exporting !== null || filteredRecords.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-navy-border bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === 'geojson' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-terra border-t-transparent" />
            ) : (
              <Download size={16} />
            )}
            GeoJSON
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {records === null && !error && (
        <div className="flex items-center justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-navy-border border-t-terra" />
        </div>
      )}

      {/* Empty state */}
      {records && filteredRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-navy-50 p-4">
            <Filter className="h-8 w-8 text-ink-muted" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-ink">
            {t('No records found', 'Aucune donnée trouvée')}
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            {searchQuery || selectedProject
              ? t('Try adjusting your filters.', 'Essayez de modifier vos filtres.')
              : t('Approved records will appear here.', 'Les données approuvées apparaîtront ici.')}
          </p>
        </div>
      )}

      {/* Table view */}
      {records && filteredRecords.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden rounded-xl border border-navy-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-navy-border bg-navy-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('Type', 'Type')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('Data', 'Données')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('Captured by', 'Collecté par')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('Date', 'Date')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {t('Location', 'Localisation')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-terra-50 px-2.5 py-1 text-xs font-medium text-terra">
                        {record.recordTypeKey}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-md space-y-1">
                        {Object.entries(record.data).slice(0, 3).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-2 text-sm">
                            <span className="font-medium text-ink-muted">{key}:</span>
                            <span className="text-ink">{formatFieldValue(value)}</span>
                          </div>
                        ))}
                        {Object.keys(record.data).length > 3 && (
                          <span className="text-xs text-ink-muted">
                            +{Object.keys(record.data).length - 3} {t('more', 'autres')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                        <User size={14} />
                        <span className="truncate">{record.capturedBy.slice(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                        <Calendar size={14} />
                        {formatDate(record.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {record.evidence.gps ? (
                        <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                          <MapPin size={14} />
                          <span>
                            {record.evidence.gps.latitude.toFixed(4)}, {record.evidence.gps.longitude.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-navy-border bg-navy-50 px-4 py-2 text-sm text-ink-muted">
            {t(
              `Showing ${filteredRecords.length} of ${records.length} records`,
              `Affichage de ${filteredRecords.length} sur ${records.length} données`
            )}
          </div>
        </div>
      )}

      {/* Map view */}
      {records && filteredRecords.length > 0 && viewMode === 'map' && (
        <div className="overflow-hidden rounded-xl border border-navy-border bg-white">
          <MapContainer
            center={[4.0511, 9.7679]}
            zoom={13}
            style={{ height: '600px', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapRecords.map((record) => {
              const lat = record.evidence.gps?.latitude;
              const lng = record.evidence.gps?.longitude;
              if (lat == null || lng == null) return null;
              const position: LatLngExpression = [lat, lng];
              return (
                <Marker key={record.id} position={position}>
                  <Popup>
                    <div className="min-w-[200px]">
                      <p className="mb-1 text-xs font-semibold uppercase text-terra">
                        {record.recordTypeKey}
                      </p>
                      <div className="space-y-1 text-sm">
                        {Object.entries(record.data).slice(0, 4).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-1">
                            <span className="font-medium">{key}:</span>
                            <span>{formatFieldValue(value)}</span>
                          </div>
                        ))}
                        <p className="mt-2 text-xs text-gray-500">
                          {formatDate(record.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          <div className="border-t border-navy-border bg-navy-50 px-4 py-2 text-sm text-ink-muted">
            {t(
              `Showing ${mapRecords.length} records with GPS data`,
              `Affichage de ${mapRecords.length} données avec données GPS`
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordsScreen;
