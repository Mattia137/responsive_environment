/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/pedestrian.js
   Pedestrian traffic — flow lines from subway stations + visitor point cloud.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-pedestrian';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.pedestrian;
  if (!result?.spatial) return;

  const { features } = result.spatial;
  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  // Flow lines from stations to site
  ensureLayer({
    id: `${PREFIX}-line`,
    type: 'line',
    source: srcId,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color':     state.mode === 'after' ? '#ff5a1f' : '#8a877f',
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 0.8, 18, 3],
      'line-dasharray': [3, 2],
      'line-opacity':   state.mode === 'after' ? 0.85 : 0.5,
    },
  });

  // Point markers at stations
  ensureLayer({
    id: `${PREFIX}-pts`,
    type: 'circle',
    source: srcId,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 6],
      'circle-color':        state.mode === 'after' ? '#ff5a1f' : '#d4a857',
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 0.5,
      'circle-opacity':      0.85,
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-line`);
  removeLayer(`${PREFIX}-pts`);
  removeSource(`${PREFIX}-src`);
}
