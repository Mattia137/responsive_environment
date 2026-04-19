/* =========================================================================
   ALLSPARK // IMPACT  ·  ui/panel-readouts.js
   Renders the RIGHT panel's bottom section (readouts).
   ========================================================================= */

import { LAYERS } from '../layers/registry.js';

export function renderReadouts(state) {
  const host = document.getElementById('readout-body');
  host.innerHTML = '';
  const ctxTag = document.getElementById('readout-context');

  const active = Array.from(state.activeLayerIds);
  if (active.length === 0) {
    ctxTag.textContent = 'OVERVIEW';
    host.appendChild(overviewCard(state));
    host.appendChild(summaryGrid(state));
    return;
  }

  const primary = active[active.length - 1]; // most recently toggled
  ctxTag.textContent = LAYERS.find(L => L.id === primary).name;
  const result = state.impactResults[primary];
  if (!result) return;

  host.appendChild(headlineCard(primary, result, state.mode));
  host.appendChild(metricsCard(result, state.mode));
  host.appendChild(notesCard(primary));
}

function overviewCard(state) {
  const el = document.createElement('div');
  el.className = 'readout-card headline';
  el.innerHTML = `
    <div class="readout-card-title">SCENARIO · ${state.mode.toUpperCase()}</div>
    <div class="big-number">${state.activeLayerIds.size}<span class="big-number-unit">/ ${LAYERS.length} layers active</span></div>
    <div class="big-delta sign-neu">${state.mode === 'before' ? 'baseline · pre-intervention' : 'projected · 5-year horizon'}</div>
    <div style="margin-top:14px; color:var(--ink-dim); font-size:11px; line-height:1.6;">
      Select a layer from the left to inspect its projection.
      ${state.massing.loaded ? '' : '<br><br><strong style="color:var(--accent)">No massing loaded.</strong> Default geometry applied — upload a GLB for project-specific projections.'}
    </div>
  `;
  return el;
}

function summaryGrid(state) {
  const el = document.createElement('div');
  el.className = 'readout-card';
  el.innerHTML = `<div class="readout-card-title">ALL LAYERS · AT A GLANCE</div>` +
    LAYERS.map(L => {
      const r = state.impactResults?.[L.id];
      const headline = r?.headline;
      const sign = headline ? `sign-${headline.sign}` : '';
      return `
        <div class="metric-row">
          <span class="label">${L.name}</span>
          <span>
            <span class="value">${state.mode === 'after' && headline ? headline.value : '—'}</span>
            ${state.mode === 'after' && headline ? `<span class="delta ${sign}">${headline.unit || ''} ${headline.delta}</span>` : ''}
          </span>
        </div>`;
    }).join('');
  return el;
}

function headlineCard(id, result, mode) {
  const el = document.createElement('div');
  el.className = 'readout-card headline';
  const h = result.headline;
  el.innerHTML = `
    <div class="readout-card-title">${id.toUpperCase()} · HEADLINE</div>
    <div class="big-number">${h.value}<span class="big-number-unit">${h.unit || ''}</span></div>
    <div class="big-delta sign-${h.sign}">${mode === 'after' ? 'Δ ' + h.delta : 'baseline'}</div>
    <svg class="spark" viewBox="0 0 200 32" preserveAspectRatio="none">
      <polyline points="${sparkline(id, mode, h.sign)}" fill="none" stroke="var(--${h.sign === 'neg' ? 'negative' : h.sign === 'pos' ? 'positive' : 'neutral'})" stroke-width="1.2"/>
    </svg>
  `;
  return el;
}

function metricsCard(result, mode) {
  const el = document.createElement('div');
  el.className = 'readout-card';
  el.innerHTML = `<div class="readout-card-title">METRICS</div>` +
    (result.metrics || []).map(m => `
      <div class="metric-row">
        <span class="label">${m.label}</span>
        <span>
          <span class="value">${mode === 'before' ? m.baseline : m.projected}</span>
          ${mode === 'after' ? `<span class="delta sign-${m.sign}">${m.delta}</span>` : ''}
        </span>
      </div>`).join('');
  return el;
}

function notesCard(id) {
  const el = document.createElement('div');
  el.className = 'readout-card';
  el.innerHTML = `
    <div class="readout-card-title">ANALYST NOTE</div>
    <div class="serif" style="font-size:12.5px; line-height:1.55; color:var(--ink);">
      ${window.LAYER_DETAILS_NOTE?.[id] || 'See data sources for methodology.'}
    </div>
  `;
  return el;
}

function sparkline(id, mode, sign) {
  const seed = id.charCodeAt(0) + id.charCodeAt(1);
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const x = (i / 39) * 200;
    const base = 16 + Math.sin((i + seed) * 0.35) * 5 + Math.cos((i + seed) * 0.7) * 3;
    const shift = mode === 'after'
      ? (sign === 'neg' ? (i/40) * 7 : sign === 'pos' ? -(i/40) * 6 : (i/40) * 2)
      : 0;
    const y = Math.max(2, Math.min(30, base + shift));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}
