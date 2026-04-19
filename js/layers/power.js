/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/power.js
   Power supply layer — feeder flow line from site to Chelsea substation.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-power';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.power;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  ensureLayer({
    id: `${PREFIX}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     state.mode === 'after' ? '#ff5a1f' : '#d4a857',
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 3.5],
      'line-dasharray': [4, 3],
      'line-opacity':   state.mode === 'after' ? 0.85 : 0.4,
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-line`);
  removeSource(`${PREFIX}-src`);
}
