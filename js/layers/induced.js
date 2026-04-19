/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/induced.js
   Induced demand — point markers for projected new storefronts.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-induced';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.induced;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  ensureLayer({
    id: `${PREFIX}-pts`,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 2.5, 18, 6],
      'circle-color':        state.mode === 'after' ? '#7fb069' : '#4a7a3a',
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 0.5,
      'circle-opacity':      state.mode === 'after' ? 0.85 : 0.4,
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-pts`);
  removeSource(`${PREFIX}-src`);
}
