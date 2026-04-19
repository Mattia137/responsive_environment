/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/waste.js
   Waste & noise — concentric dB rings around loading-dock position.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-waste';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.waste;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  // Ring fills with dB-proportional opacity
  ensureLayer({
    id: `${PREFIX}-fill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color':   state.mode === 'after' ? '#e06c75' : '#d4a857',
      'fill-opacity': state.mode === 'after'
        ? ['interpolate', ['linear'], ['get', 'value'], 60, 0.04, 78, 0.2]
        : 0.04,
    },
  });

  // Ring outlines
  ensureLayer({
    id: `${PREFIX}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     state.mode === 'after' ? '#e06c75' : '#8a877f',
      'line-dasharray': [2, 3],
      'line-width':     0.8,
      'line-opacity':   state.mode === 'after' ? 0.65 : 0.3,
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-fill`);
  removeLayer(`${PREFIX}-line`);
  removeSource(`${PREFIX}-src`);
}
