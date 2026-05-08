/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/panel-layers.js
   Renders the left panel's layer list with category grouping.
   ========================================================================= */

import { LAYERS, LAYER_CATEGORIES } from '../layers/registry.js';

let _listeners = [];
export function onLayerToggle(fn) { _listeners.push(fn); }

/* Track which categories are open */
const _openCats = new Set(['env', 'eco', 'log']);

export function renderLayers(state) {
  const host = document.getElementById('layer-list');
  if (!host) return;
  host.innerHTML = '';

  /* Group layers by category */
  const grouped = {};
  LAYERS.forEach(L => {
    const cat = L.category || 'log';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(L);
  });

  /* Render each category */
  Object.entries(LAYER_CATEGORIES).forEach(([catId, cat]) => {
    const items = grouped[catId] || [];
    if (!items.length) return;

    const onCount = items.filter(L => state.activeLayerIds.has(L.id)).length;
    const isOpen  = _openCats.has(catId);

    const catEl = document.createElement('div');
    catEl.className = 'layer-cat' + (isOpen ? ' open' : '');
    catEl.dataset.cat = catId;

    /* Category header */
    catEl.innerHTML = `
      <div class="layer-cat-head">
        <div class="layer-cat-dot" style="background:${cat.color}"></div>
        <span class="layer-cat-label">${cat.label}</span>
        <span class="layer-cat-count">${onCount}/${items.length}</span>
        <span class="layer-cat-chevron">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4">
            <polyline points="2,4 5,7 8,4"/>
          </svg>
        </span>
      </div>
      <div class="layer-cat-rows"></div>
    `;

    /* Toggle accordion on header click */
    catEl.querySelector('.layer-cat-head').addEventListener('click', () => {
      const open = catEl.classList.toggle('open');
      if (open) _openCats.add(catId);
      else _openCats.delete(catId);
    });

    /* Layer rows */
    const rowsEl = catEl.querySelector('.layer-cat-rows');
    items.forEach(L => {
      const active = state.activeLayerIds.has(L.id);
      const result = state.impactResults?.[L.id];
      const headline = result?.headline;
      const isProj = state.timeStep > 0;
      const showDelta = isProj && headline;
      const deltaSign = headline?.sign; // 'pos' | 'neg' | 'neu'

      const row = document.createElement('div');
      row.className = 'layer' + (active ? ' active' : '');
      row.dataset.layerId = L.id;

      row.innerHTML = `
        <div class="layer-chk">
          ${active ? `<svg width="7" height="6" viewBox="0 0 7 6"><polyline points="1,3 3,5 6,1" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round"/></svg>` : ''}
        </div>
        <div class="layer-swatch" style="background:${L.swatch}"></div>
        <span class="layer-name">${L.name}</span>
        ${headline ? `<span class="layer-val">${headline.value} ${headline.unit || ''}</span>` : ''}
        ${showDelta ? `<span class="layer-delta sign-${deltaSign}">${headline.delta}</span>` : ''}
      `;

      row.addEventListener('click', () => {
        _listeners.forEach(fn => fn(L.id));
      });

      rowsEl.appendChild(row);
    });

    host.appendChild(catEl);
  });

  /* Update count badge */
  const countEl = document.getElementById('layers-count');
  if (countEl) countEl.textContent = `${state.activeLayerIds.size} / ${LAYERS.length}`;

  /* Update HUD active-layer tag */
  const tagEl = document.getElementById('active-layer-tag');
  if (tagEl) {
    tagEl.textContent =
      state.activeLayerIds.size === 0
        ? '— NONE —'
        : state.activeLayerIds.size === 1
          ? LAYERS.find(L => state.activeLayerIds.has(L.id))?.name?.toUpperCase() || ''
          : `${state.activeLayerIds.size} ACTIVE`;
  }
}
