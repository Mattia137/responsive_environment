/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/air.js
   Air quality layer — construction plume heatmap + monitoring station points.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-air';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.air;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  // Heatmap for plume
  ensureLayer({
    id: `${PREFIX}-heat`,
    type: 'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 30, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 3],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 13, 20, 18, 80],
      'heatmap-opacity':   state.mode === 'after' ? 0.7 : 0.3,
      'heatmap-color':     [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,0,0)',
        0.2, 'rgba(214,168,87,0.4)',
        0.5, 'rgba(255,140,50,0.6)',
        0.8, 'rgba(224,108,117,0.7)',
        1,   'rgba(224,108,117,0.9)',
      ],
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-heat`);
  removeSource(`${PREFIX}-src`);
}
