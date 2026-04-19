/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/cost.js
   Project cost & logistics — construction staging ring.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-cost';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.cost;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  ensureLayer({
    id: `${PREFIX}-fill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color':   state.mode === 'after' ? '#ff5a1f' : '#d4a857',
      'fill-opacity': state.mode === 'after' ? 0.15 : 0.06,
    },
  });

  ensureLayer({
    id: `${PREFIX}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     state.mode === 'after' ? '#ff5a1f' : '#d4a857',
      'line-dasharray': [4, 3],
      'line-width':     1,
      'line-opacity':   state.mode === 'after' ? 0.7 : 0.3,
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

/* dispatch.js calls render/clear */
export const render = showLayer;
export const clear  = hideLayer;
