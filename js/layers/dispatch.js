/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/dispatch.js
   Routes renderActiveLayers() to each layer's own render/clear functions.
   Each layer file owns its data fetching, MapLibre layer setup, and legend.
   ========================================================================= */

import { getMap, removeLayer, removeSource, ensureSource, ensureLayer } from '../map.js';
import { LAYERS } from './registry.js';
import { makeRing, asFeatureCollection } from '../geometry.js';

/* Import every layer's render / clear API */
import * as air          from './air.js';
import * as power        from './power.js';
import * as pedestrian   from './pedestrian.js';
import * as rent         from './rent.js';
import * as displacement from './displacement.js';
import * as induced      from './induced.js';
import * as transit      from './transit.js';
import * as cost         from './cost.js';
import * as water        from './water.js';
import * as waste        from './waste.js';

const LAYER_MODULES = { air, power, pedestrian, rent, displacement, induced, transit, cost, water, waste };

export async function renderActiveLayers(state) {
  for (const L of LAYERS) {
    const mod = LAYER_MODULES[L.id];
    if (!mod) continue;

    if (state.activeLayerIds.has(L.id)) {
      try {
        await mod.render(state);
      } catch (e) {
        console.warn(`[dispatch] ${L.id} render error:`, e);
      }
    } else {
      try {
        mod.clear();
      } catch (e) {}
    }
  }

  // Always render the impact boundary outline
  _renderBoundary(state);

  // Update map overlay tag
  const tag = document.getElementById('active-layer-tag');
  if (tag) {
    tag.textContent = state.activeLayerIds.size
      ? [...state.activeLayerIds].join(' · ').toUpperCase()
      : '— NONE —';
  }
}

/* ---------------------------------------------------------------- */
const BOUNDARY_SRC = 'allspark-impact-boundary-src';
const BOUNDARY_LYR = 'allspark-impact-boundary';

function _renderBoundary(state) {
  const map = getMap();
  if (!map) return;

  const geo = state.impactGeometry;
  if (!geo) return;

  const t   = state.massing?.transform || {};
  const lng = t.anchor_lon ?? -74.0063;
  const lat = t.anchor_lat ?? 40.7539;

  let feature = null;
  if (geo.mode === 'euclidean') {
    feature = makeRing(lng, lat, geo.radius_m ?? 400);
  } else if (geo.polygon) {
    feature = geo.polygon;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5a1f';

  ensureSource(BOUNDARY_SRC, asFeatureCollection(feature));
  ensureLayer({
    id:     BOUNDARY_LYR,
    type:   'line',
    source: BOUNDARY_SRC,
    paint: {
      'line-color':     accent,
      'line-width':     1.5,
      'line-dasharray': [3, 2],
      'line-opacity':   feature ? 0.70 : 0,
    },
  });

  // Sync radius readout in overlay
  const radiusEl = document.getElementById('radius-readout');
  if (radiusEl) {
    radiusEl.textContent = geo.mode === 'euclidean' ? (geo.radius_m ?? 400)
      : geo.mode === 'isochrone'                    ? `${geo.iso_minutes ?? 15}min`
      : 'DRAWN';
  }
}
