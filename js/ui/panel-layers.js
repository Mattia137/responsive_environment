/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/panel-layers.js
   Renders the left panel's layer list.
   ========================================================================= */

import { LAYERS, LAYER_DETAILS } from '../layers/registry.js';

let _listeners = [];
export function onLayerToggle(fn) { _listeners.push(fn); }

export function renderLayers(state) {
  const host = document.getElementById('layer-list');
  if (!host) return;
  host.innerHTML = '';
  LAYERS.forEach((L, i) => {
    const active = state.activeLayerIds.has(L.id);
    const headline = state.impactResults?.[L.id]?.headline;
    const deltaTxt = state.mode === 'after' && headline ? headline.delta : '—';
    const deltaCls = headline ? `sign-${headline.sign}` : '';

    const el = document.createElement('div');
    el.className = 'layer ' + (active ? 'active' : 'inactive');
    el.innerHTML = `
      <div class="layer-row">
        <span class="layer-chk"></span>
        <span class="layer-idx">${String(i+1).padStart(2,'0')}</span>
        <span class="layer-name">${L.name}</span>
        <span class="layer-delta mono ${deltaCls}">${deltaTxt}</span>
      </div>
      <div class="layer-detail">
        <div>${LAYER_DETAILS[L.id]?.note || ''}</div>
        <div class="src">DATA SOURCES</div>
        <ul>${(LAYER_DETAILS[L.id]?.sources || []).map(s => `<li>${s}</li>`).join('')}</ul>
      </div>
    `;
    el.addEventListener('click', () => {
      _listeners.forEach(fn => fn(L.id));
    });
    host.appendChild(el);
  });
  const countEl = document.getElementById('layers-count');
  if (countEl) countEl.textContent = `${state.activeLayerIds.size} / ${LAYERS.length}`;
  const tagEl = document.getElementById('active-layer-tag');
  if (tagEl) {
    tagEl.textContent =
      state.activeLayerIds.size === 0
        ? '— NONE —'
        : state.activeLayerIds.size === 1
          ? LAYERS.find(L => state.activeLayerIds.has(L.id))?.name || ''
          : `${state.activeLayerIds.size} ACTIVE`;
  }
}
