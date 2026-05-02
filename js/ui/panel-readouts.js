/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/panel-readouts.js
   Renders the RIGHT panel's bottom section (readouts).
   ========================================================================= */

import { LAYERS, LAYER_DETAILS } from '../layers/registry.js';
import { provDot } from './prov.js';

export function renderReadouts(state) {
  const host = document.getElementById('readout-body');
  if (!host) return;
  host.innerHTML = '';
  const ctxTag = document.getElementById('readout-context');

  const active = Array.from(state.activeLayerIds);
  if (active.length === 0) {
    if (ctxTag) ctxTag.textContent = 'OVERVIEW';
    host.appendChild(overviewCard(state));
    host.appendChild(summaryGrid(state));
    return;
  }

  const primary = active[active.length - 1]; // most recently toggled
  const layerInfo = LAYERS.find(L => L.id === primary);
  if (ctxTag) ctxTag.textContent = layerInfo?.name || primary;
  const result = state.impactResults[primary];
  if (!result) return;

  host.appendChild(headlineCard(primary, result, state.timeStep));
  host.appendChild(metricsCard(result, state.timeStep));
  host.appendChild(notesCard(primary));
}

function formatUncertainty(u) {
  if (!u) return '';
  const [low, high] = u;
  const f = n => {
    if (Math.abs(n) >= 1000) return (n/1000).toFixed(1) + 'k';
    return Number.isInteger(n) ? n.toString() : n.toFixed(1);
  };
  return `<div style="font-size: 8px; color: var(--ink-dim); margin-top: 3px; letter-spacing: 0.05em; font-family: 'Fragment Mono', monospace;">range: ${f(low)} – ${f(high)}</div>`;
}

function overviewCard(state) {
  const el = document.createElement('div');
  el.className = 'readout-card headline';
  el.innerHTML = `
    <div class="readout-card-title">SCENARIO · T${state.timeStep}</div>
    <div class="big-number">${state.activeLayerIds.size}<span class="big-number-unit">/ ${LAYERS.length} layers active</span></div>
    <div class="big-delta sign-neu">${state.timeStep === 0 ? 'baseline · pre-intervention' : 'projected · time horizon'}</div>
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
      const showValue = state.timeStep > 0 && headline;
      return `
        <div class="metric-row">
          <span class="label">${L.name}</span>
          <span style="display: flex; flex-direction: column; align-items: flex-end;">
            <div>
              ${showValue ? provDot(headline.provenance) : ''}
              <span class="value">${showValue ? headline.value : '—'}</span>
              ${showValue ? `<span class="delta ${sign}" style="margin-left: 6px;">${headline.unit || ''} ${headline.delta}</span>` : ''}
            </div>
            ${showValue && headline.uncertainty ? formatUncertainty(headline.uncertainty) : ''}
          </span>
        </div>`;
    }).join('');
  return el;
}

function headlineCard(id, result, timeStep) {
  const el = document.createElement('div');
  el.className = 'readout-card headline';
  const h = result.headline;
  const isProj = timeStep > 0;
  el.innerHTML = `
    <div class="readout-card-title">${id.toUpperCase()} · HEADLINE</div>
    <div class="big-number">${provDot(h.provenance)}${h.value}<span class="big-number-unit">${h.unit || ''}</span></div>
    ${h.uncertainty ? formatUncertainty(h.uncertainty) : ''}
    <div class="big-delta sign-${h.sign}" style="margin-top: 6px;">${isProj ? 'Δ ' + h.delta : 'baseline'}</div>
    <svg class="spark" viewBox="0 0 200 32" preserveAspectRatio="none">
      <polyline points="${sparkline(id, timeStep, h.sign)}" fill="none" stroke="var(--${h.sign === 'neg' ? 'negative' : h.sign === 'pos' ? 'positive' : 'neutral'})" stroke-width="1.2"/>
    </svg>
  `;
  return el;
}

function metricsCard(result, timeStep) {
  const el = document.createElement('div');
  el.className = 'readout-card';
  const isProj = timeStep > 0;
  el.innerHTML = `<div class="readout-card-title">METRICS</div>` +
    (result.metrics || []).map(m => `
      <div class="metric-row">
        <span class="label">${m.label}</span>
        <span style="display: flex; flex-direction: column; align-items: flex-end;">
          <div>
            ${provDot(m.provenance)}
            <span class="value prov-val-${m.provenance ?? ''}">${!isProj ? m.baseline : m.projected}</span>
            ${isProj ? `<span class="delta sign-${m.sign}" style="margin-left: 6px;">${m.delta}</span>` : ''}
          </div>
          ${m.uncertainty ? formatUncertainty(m.uncertainty) : ''}
        </span>
      </div>`).join('');
  return el;
}

function notesCard(id) {
  const el = document.createElement('div');
  el.className = 'readout-card';
  const note = LAYER_DETAILS[id]?.note || 'See data sources for methodology.';
  el.innerHTML = `
    <div class="readout-card-title">ANALYST NOTE</div>
    <div class="serif" style="font-size:12.5px; line-height:1.55; color:var(--ink);">
      ${note}
    </div>
  `;
  return el;
}

function sparkline(id, timeStep, sign) {
  const seed = id.charCodeAt(0) + id.charCodeAt(1);
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const x = (i / 39) * 200;
    const base = 16 + Math.sin((i + seed) * 0.35) * 5 + Math.cos((i + seed) * 0.7) * 3;
    const shift = timeStep > 0
      ? (sign === 'neg' ? (i/40) * 7 : sign === 'pos' ? -(i/40) * 6 : (i/40) * 2)
      : 0;
    const y = Math.max(2, Math.min(30, base + shift));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}
