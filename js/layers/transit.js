/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/transit.js
   Transit pressure — subway/bus station dots resized by projected delta.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';

const PREFIX = 'allspark-transit';

export function showLayer(state) {
  const map = getMap();
  if (!map) return;
  const result = state.impactResults?.transit;
  if (!result?.spatial) return;

  let { features } = result.spatial;

  // If empty, generate from subway baseline data
  if ((!features || features.length === 0) && state.baselineData?.subway) {
    const subway = state.baselineData.subway;
    if (subway.features) {
      // Filter to stations near the site (within ~1.5km)
      const [lat, lon] = [
        state.massing?.transform?.anchor_lat ?? 40.754283,
        state.massing?.transform?.anchor_lon ?? -74.006649,
      ];
      features = subway.features
        .filter(f => {
          if (!f.geometry?.coordinates) return false;
          const [sLon, sLat] = f.geometry.coordinates;
          const d = Math.sqrt((sLat - lat) ** 2 + (sLon - lon) ** 2);
          return d < 0.015; // ~1.5km in degrees
        })
        .map(f => ({
          ...f,
          properties: {
            ...f.properties,
            value: state.mode === 'after' ? 0.7 : 0.3,
          },
        }));
    }
  }

  const srcId = `${PREFIX}-src`;
  const geojson = { type: 'FeatureCollection', features: features || [] };

  ensureSource(srcId, geojson);

  ensureLayer({
    id: `${PREFIX}-pts`,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 8],
      'circle-color':        state.mode === 'after' ? '#e06c75' : '#d4a857',
      'circle-stroke-color': state.mode === 'after' ? '#ff5a1f' : '#8a877f',
      'circle-stroke-width': 1.5,
      'circle-opacity':      0.8,
    },
  });

  // Highlight ring around stations within 400m
  ensureLayer({
    id: `${PREFIX}-ring`,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 6, 18, 14],
      'circle-color':        'transparent',
      'circle-stroke-color': state.mode === 'after' ? '#ff5a1f' : '#8a877f',
      'circle-stroke-width': 0.5,
      'circle-opacity':      0.5,
    },
  });
}

export function hideLayer() {
  const map = getMap();
  if (!map) return;
  removeLayer(`${PREFIX}-pts`);
  removeLayer(`${PREFIX}-ring`);
  removeSource(`${PREFIX}-src`);
}
