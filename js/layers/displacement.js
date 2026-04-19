/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/displacement.js
   Displacement risk — choropleth of census tracts by composite index.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-displacement';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.displacement;
  if (!result?.spatial) return;

  let { features } = result.spatial;

  // If we have census tract data in baseline, generate synthetic displacement features
  if ((!features || features.length === 0) && state.baselineData?.tracts) {
    const tracts = state.baselineData.tracts;
    if (tracts.features && tracts.features.length > 0) {
      features = tracts.features
        .filter(f => f.geometry)
        .slice(0, 60)
        .map(f => ({
          ...f,
          properties: {
            ...f.properties,
            value: Math.random() * 0.6 + (state.mode === 'after' ? 0.25 : 0),
          },
        }));
    }
  }

  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  ensureLayer({
    id: `${PREFIX}-fill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'value'], 0],
        0,   'rgba(0,0,0,0)',
        0.3, state.mode === 'after' ? '#d4a857' : '#4a4742',
        0.6, state.mode === 'after' ? '#e06c75' : '#8a877f',
        1,   state.mode === 'after' ? '#c04050' : '#aaa69e',
      ],
      'fill-opacity': state.mode === 'after' ? 0.45 : 0.2,
      'fill-outline-color': '#2d2b27',
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-fill`);
  removeSource(`${PREFIX}-src`);
}
