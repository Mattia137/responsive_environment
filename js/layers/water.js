/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/water.js
   Water & stormwater — CSO outfall flow + runoff rings.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-water';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.water;
  if (!result?.spatial) return;

  let { features } = result.spatial;

  // If empty, check for CSO baseline data and generate flow arrows
  if ((!features || features.length === 0) && state.baselineData?.cso) {
    const cso = state.baselineData.cso;
    if (cso.features) {
      const [lat, lon] = [
        state.massing?.transform?.anchor_lat ?? 40.754283,
        state.massing?.transform?.anchor_lon ?? -74.006649,
      ];
      // Filter to nearby CSO outfalls and create flow lines
      const nearby = cso.features
        .filter(f => {
          if (!f.geometry?.coordinates) return false;
          const [cLon, cLat] = f.geometry.coordinates;
          const d = Math.sqrt((cLat - lat) ** 2 + (cLon - lon) ** 2);
          return d < 0.02;
        })
        .slice(0, 8);

      features = [
        // Point markers for outfalls
        ...nearby,
        // Flow lines from site to nearest outfalls
        ...nearby.slice(0, 3).map(f => ({
          type: 'Feature',
          properties: { flow: true },
          geometry: {
            type: 'LineString',
            coordinates: [[lon, lat], f.geometry.coordinates],
          },
        })),
      ];
    }
  }

  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  // Flow lines
  ensureLayer({
    id: `${PREFIX}-line`,
    type: 'line',
    source: srcId,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color':     state.mode === 'after' ? '#5b9bd5' : '#4a7a9a',
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 0.8, 18, 2.5],
      'line-dasharray': [3, 2],
      'line-opacity':   state.mode === 'after' ? 0.8 : 0.4,
    },
  });

  // CSO outfall points
  ensureLayer({
    id: `${PREFIX}-pts`,
    type: 'circle',
    source: srcId,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 7],
      'circle-color':        state.mode === 'after' ? '#5b9bd5' : '#4a7a9a',
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 0.5,
      'circle-opacity':      0.75,
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

export const render = showLayer;
export const clear  = hideLayer;
