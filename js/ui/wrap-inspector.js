/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/wrap-inspector.js
   The Wrap Inspector panel — surfaces what each layer sees and excludes.
   Keyboard shortcut: W
   ========================================================================= */

import { LAYERS } from '../layers/registry.js';
import { WRAP_NOTES } from '../wrap-knowledge.js';

let _panel     = null;
let _isOpen    = false;
let _activeId  = null;

export function initWrapInspector() {
  _panel = document.getElementById('wrap-inspector');
  if (!_panel) return;

  const btn   = document.getElementById('btn-wrap-inspector');
  const close = document.getElementById('wrap-inspector-close');

  if (btn)   btn.addEventListener('click', toggle);
  if (close) close.addEventListener('click', close_);

  _renderContent();

  // Wire the editorial "WHY?" toggle
  _panel?.addEventListener('click', e => {
    if (e.target.id !== 'wrap-why-btn') return;
    const body = document.getElementById('wrap-why-body');
    const btn  = document.getElementById('wrap-why-btn');
    if (!body || !btn) return;
    const open = body.classList.toggle('open');
    btn.textContent = open ? 'CLOSE' : 'WHY ?';
  });
}

export function toggle() {
  _isOpen ? close_() : open_();
}

function open_() {
  _isOpen = true;
  _panel?.classList.add('open');
  document.getElementById('btn-wrap-inspector')?.setAttribute('aria-expanded', 'true');
  if (_activeId) _scrollToLayer(_activeId);
}

function close_() {
  _isOpen = false;
  _panel?.classList.remove('open');
  document.getElementById('btn-wrap-inspector')?.setAttribute('aria-expanded', 'false');
}

/* Called from main.js whenever the active layer changes */
export function syncActiveLayer(layerId) {
  _activeId = layerId;

  // Highlight the active section
  _panel?.querySelectorAll('.wrap-section').forEach(sec => {
    sec.classList.toggle('wrap-section-active', sec.dataset.layerId === layerId);
  });

  // If the panel is open, scroll to it
  if (_isOpen && layerId) _scrollToLayer(layerId);
}

function _scrollToLayer(layerId) {
  const sec = _panel?.querySelector(`[data-layer-id="${layerId}"]`);
  if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
const EDITORIAL_CALLOUT = `
<div class="wrap-editorial" id="wrap-editorial">
  <div class="wrap-editorial-title">GEOMETRY IS A POLITICAL CHOICE</div>
  <p class="wrap-editorial-text">
    This impact boundary is an editorial choice, not a measurement. The default 400 m ring is convenient, not correct.
    Anchor effects propagate along transit lines, school district edges, and existing rent gradients — not in perfect circles.
  </p>
  <button class="wrap-editorial-why-btn" id="wrap-why-btn">WHY ?</button>
  <div class="wrap-editorial-why" id="wrap-why-body">
    A circular buffer treats all directions as equivalent, which is false in any city. The 7-train station at 34th Street–Hudson Yards
    creates a transit catchment that extends northeast into Queens, not southwest into the Hudson River.
    Rent gradients follow school district edges and historic redlining boundaries, not radii. The walking-isochrone mode corrects
    for street network topology, but still treats the pedestrian network as uniform — it cannot model the effect of elevated arterials,
    missing sidewalks, or park barriers on actual pedestrian behaviour. All three geometry modes are epistemically incomplete.
    Choose the one that is honest about its assumptions.
  </div>
</div>`;

const EDITORIAL_TIME_CALLOUT = `
<div class="wrap-editorial" style="margin-top: 16px;">
  <div class="wrap-editorial-title">TIME IS NOT A MEASUREMENT</div>
  <p class="wrap-editorial-text">
    Future projections are not predictions; they are conditional model outputs whose conditions are themselves contested.
  </p>
</div>`;

function _renderContent() {
  const body = _panel?.querySelector('.wrap-inspector-body');
  if (!body) return;

  body.innerHTML = EDITORIAL_CALLOUT + EDITORIAL_TIME_CALLOUT + LAYERS.map((L, i) => {
    const notes = WRAP_NOTES[L.id];
    if (!notes) return `<section class="wrap-section" data-layer-id="${L.id}">
      <div class="wrap-section-head">
        <span class="wrap-layer-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="wrap-layer-name">${L.name}</span>
      </div>
      <p class="wrap-text" style="color:var(--ink-faint)">No wrap notes available for this layer.</p>
    </section>`;

    return `
    <section class="wrap-section" data-layer-id="${L.id}">
      <div class="wrap-section-head">
        <span class="wrap-layer-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="wrap-layer-name">${L.name}</span>
      </div>

      <div class="wrap-block">
        <div class="wrap-block-title">WHAT THIS LAYER SEES</div>
        <p class="wrap-text">${_clean(notes.sees)}</p>
      </div>

      <div class="wrap-block">
        <div class="wrap-block-title">WHAT THIS LAYER DOES NOT SEE</div>
        <ul class="wrap-list">
          ${(notes.excludes || []).map(e => `<li>${_clean(e)}</li>`).join('')}
        </ul>
      </div>

      ${notes.demographics ? `
      <div class="wrap-block">
        <div class="wrap-block-title">WHO IS COUNTED, WHO IS NOT</div>
        <p class="wrap-text">${_clean(notes.demographics)}</p>
      </div>` : ''}

      <div class="wrap-block">
        <div class="wrap-block-title">POLITICAL GEOMETRY</div>
        <p class="wrap-text wrap-text-serif">${_clean(notes.political)}</p>
      </div>
    </section>`;
  }).join('<div class="wrap-divider"></div>');
}

/* Collapse extra whitespace from template literals */
function _clean(str) {
  return str.replace(/\s+/g, ' ').trim();
}
