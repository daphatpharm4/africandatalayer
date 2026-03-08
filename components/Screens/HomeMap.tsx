import React, { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Category, DataPoint } from '../../types';
import type { MapScope } from '../../shared/types';
import { LEGACY_CATEGORY_MAP, VERTICALS } from '../../shared/verticals';

type MapPointGroup = {
  key: string;
  latitude: number;
  longitude: number;
  points: DataPoint[];
};

interface Props {
  mapScope: MapScope;
  mapCenter: [number, number];
  mapZoom: number;
  mapMinZoom: number;
  mapBounds: [[number, number], [number, number]] | undefined;
  mapPointGroups: MapPointGroup[];
  selectedCityLabel: string;
  onSelectPoint: (point: DataPoint) => void;
  categoryLabel: (type: Category) => string;
  formatExplorerPrimaryMeta: (point: DataPoint) => string;
  formatPharmacyOpenStatus: (point: DataPoint) => string | null;
  language: 'en' | 'fr';
  t: (en: string, fr: string) => string;
  isLowEndDevice: boolean;
}

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 8px 16px rgba(15,43,70,0.35);display:flex;align-items:center;justify-content:center;"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

const clusterIconCache = new Map<string, L.DivIcon>();

const getClusterIcon = (color: string, count: number) => {
  const key = `${color}_${count}`;
  const cached = clusterIconCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: '',
    html: `<div style="min-width:28px;height:28px;padding:0 8px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 8px 16px rgba(15,43,70,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:700;line-height:1;">${count}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  clusterIconCache.set(key, icon);
  return icon;
};

const markerIconCache = new Map<string, L.DivIcon>();

const getMarkerIconForType = (type: Category): L.DivIcon => {
  const verticalId = LEGACY_CATEGORY_MAP[type] ?? type;
  const color = VERTICALS[verticalId]?.color ?? '#374151';
  const cached = markerIconCache.get(color);
  if (cached) return cached;
  const icon = createMarkerIcon(color);
  markerIconCache.set(color, icon);
  return icon;
};

const agentLocationIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#3b82f6;border:3px solid #ffffff;box-shadow:0 0 0 2px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.2);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const AgentLocationMarker: React.FC = () => {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!position) return null;

  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={Math.min(position.accuracy, 200)}
        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }}
      />
      <Marker position={[position.lat, position.lng]} icon={agentLocationIcon} zIndexOffset={1000}>
        <Popup>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">Your location</span>
        </Popup>
      </Marker>
    </>
  );
};

const MapSizeSync: React.FC<{ active: boolean }> = ({ active }) => {
  const map = useMap();

  useEffect(() => {
    if (!active) return;
    const rafId = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 140);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [active, map]);

  return null;
};

const HomeMap: React.FC<Props> = ({
  mapScope,
  mapCenter,
  mapZoom,
  mapMinZoom,
  mapBounds,
  mapPointGroups,
  selectedCityLabel,
  onSelectPoint,
  categoryLabel,
  formatExplorerPrimaryMeta,
  formatPharmacyOpenStatus,
  language,
  t,
  isLowEndDevice
}) => {
  return (
    <div className="flex-1 bg-[#e7eef4] relative overflow-hidden z-0 min-h-0">
      <MapContainer
        key={`map-${mapScope}`}
        center={mapCenter}
        zoom={mapZoom}
        minZoom={mapMinZoom}
        maxBounds={mapBounds}
        maxBoundsViscosity={mapBounds ? 1.0 : undefined}
        scrollWheelZoom
        preferCanvas={isLowEndDevice}
        zoomAnimation={!isLowEndDevice}
        fadeAnimation={!isLowEndDevice}
        markerZoomAnimation={!isLowEndDevice}
        className="absolute inset-0 h-full w-full"
      >
        <MapSizeSync active />
        <AgentLocationMarker />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapPointGroups.map((group) => {
          const singlePoint = group.points.length === 1 ? group.points[0] : null;
          const icon = singlePoint
            ? getMarkerIconForType(singlePoint.type)
            : (() => {
              const types = new Set(group.points.map((p) => LEGACY_CATEGORY_MAP[p.type] ?? p.type));
              const color = types.size === 1
                ? (VERTICALS[Array.from(types)[0]]?.color ?? '#c86b4a')
                : '#c86b4a';
              return getClusterIcon(color, group.points.length);
            })();

          return (
            <Marker
              key={group.key}
              position={[group.latitude, group.longitude]}
              icon={icon}
            >
              <Popup>
                {singlePoint ? (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#0f2b46]">
                      {categoryLabel(singlePoint.type)}
                    </span>
                    <p className="text-sm font-semibold text-gray-900">{singlePoint.name}</p>
                    <p className="text-[10px] text-gray-600">{formatExplorerPrimaryMeta(singlePoint)}</p>
                    {singlePoint.type === Category.PHARMACY && (
                      <p className="text-[10px] text-gray-500">{formatPharmacyOpenStatus(singlePoint)}</p>
                    )}
                    <button
                      className="mt-2 w-full rounded-lg bg-[#0f2b46] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                      onClick={() => onSelectPoint(singlePoint)}
                    >
                      {t('View Details', 'Voir details')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 min-w-[220px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                      {language === 'fr' ? `${group.points.length} points au meme endroit` : `${group.points.length} points at this location`}
                    </p>
                    <div className="space-y-1.5">
                      {group.points.map((point) => (
                        <button
                          key={point.id}
                          className="w-full rounded-lg border border-gray-100 px-2 py-1.5 text-left hover:bg-gray-50"
                          onClick={() => onSelectPoint(point)}
                        >
                          <p className="text-[11px] font-semibold text-gray-900 truncate">{point.name}</p>
                          <p className="text-[9px] uppercase tracking-wider text-gray-500">
                            {categoryLabel(point.type)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <div className="absolute inset-x-4 top-4 z-20 bg-white/95 backdrop-blur rounded-xl p-3 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
              {mapScope === 'bonamoussadi'
                ? t('Bonamoussadi Geofence', 'Geofence Bonamoussadi')
                : mapScope === 'cameroon'
                  ? t('Cameroon Coverage', 'Couverture Cameroun')
                  : t('Global Coverage', 'Couverture mondiale')}
            </p>
            <p className="text-xs text-gray-500">
              {mapScope === 'bonamoussadi' ? t('Map blocked to', 'Carte bloquee sur') : t('Map unlocked to', 'Carte debloquee sur')} {selectedCityLabel}
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-[#4c7c59] animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default HomeMap;
