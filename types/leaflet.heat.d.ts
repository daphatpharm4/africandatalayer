declare module 'leaflet.heat' {
  import type * as L from 'leaflet';

  namespace HeatLayer {
    interface Options {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    }
  }

  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: HeatLayer.Options,
  ): L.Layer;
}

declare namespace L {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
    },
  ): L.Layer;
}
