/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/dispatch.js
   Routes renderActiveLayers() to each layer's own render/clear functions.
   Each layer file owns its data fetching, MapLibre layer setup, and legend.
   ========================================================================= */

import { getMap, removeLayer, removeSource } from '../map.js';
import { LAYERS } from './registry.js';

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

  // Update map overlay tag
  const tag = document.getElementById('active-layer-tag');
  if (tag) {
    tag.textContent = state.activeLayerIds.size
      ? [...state.activeLayerIds].join(' · ').toUpperCase()
      : '— NONE —';
  }
}
