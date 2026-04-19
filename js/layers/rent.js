/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/rent.js
   Rent & property value — concentric radial rings by anchor-effect uplift.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-rent';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.rent;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  // Fill with opacity by value
  ensureLayer({
    id: `${PREFIX}-fill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color':   state.mode === 'after' ? '#e06c75' : '#d4a857',
      'fill-opacity': state.mode === 'after'
        ? ['interpolate', ['linear'], ['get', 'value'], 0, 0.03, 0.2, 0.22]
        : 0.05,
    },
  });

  // Ring outlines
  ensureLayer({
    id: `${PREFIX}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     state.mode === 'after' ? '#e06c75' : '#d4a857',
      'line-dasharray': [2, 3],
      'line-width':     0.8,
      'line-opacity':   state.mode === 'after' ? 0.7 : 0.35,
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
