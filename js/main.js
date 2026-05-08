/* =========================================================================
   ALLSPARK // IMPACT  ·  js/main.js
   Bootstrap — wires map, massing, impact model, layers, readouts, and UI.
   ========================================================================= */

import { CONFIG } from '../config.js';
import { initMap, getMap, onMapReady, setTheme as setMapTheme, flyToSite, flyTo, geocode } from './map.js';
import { fetchIsochrone } from './geometry.js';
import { loadGLB, clearMassing, updateMassingTransform, getMassingTransform, extractGeometry } from './massing.js';
import { runImpactModel } from './impact-model.js';
import { prefetchAllBaselineData } from './data-loader.js';
import { initTheme, onThemeChange } from './ui/theme.js';
import { renderLayers, onLayerToggle } from './ui/panel-layers.js';
import { initMassingControls, onMassingUpdate, setDerived, handleFile } from './ui/panel-massing.js';
import { renderReadouts } from './ui/panel-readouts.js';
import { renderActiveLayers } from './layers/dispatch.js';
import { initWrapInspector, toggle as toggleWrapInspector, syncActiveLayer } from './ui/wrap-inspector.js';

/* ================================================================
   APPLICATION STATE — single source of truth
   ================================================================ */
const state = {
  theme: 'light',
  timeStep: 0,          // 0: Baseline, 1: Build, 2: Open, 3: Settled, 4: Horizon
  activeLayerIds: new Set(),
  massing: {
    loaded: false,
    geometry: null,         // { footprint_m2, height_m, volume_m3, num_floors_est }
    transform: { ...getMassingTransform() },
  },
  program: {
    type:                     'museum_media',
    gfa_m2:                   13750,
    operating_hours_per_week: 60,
    admission_price_usd:      28,
    staff_count:              120,
  },
  impactResults: {},
  baselineData: {},
  impactGeometry: {
    mode:        'euclidean',
    radius_m:    400,
    iso_minutes: 15,
    polygon:     null,
  },
};

/* ================================================================
   BOOT SEQUENCE
   ================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

async function boot() {
  /* 1. Theme */
  initTheme(state);
  onThemeChange(theme => {
    state.theme = theme;
    setMapTheme(theme);
    // Re-render layers after style swap so CSS-var colors refresh
    setTimeout(() => renderActiveLayers(state), 500);
  });

  /* 1.5 Fetch Vercel Edge Config (Environment Variables) */
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const vConfig = await res.json();
      if (vConfig.MAPTILER_KEY) CONFIG.MAPTILER_KEY = vConfig.MAPTILER_KEY;
    }
  } catch (e) {
    console.log('[main] Running locally without Vercel Edge API');
  }

  /* 2. Map */
  initMap(state);

  /* 3. Time Scrubber */
  wireTimeScrubber();

  /* 4. Massing controls */
  initMassingControls(state);
  onMassingUpdate(handleMassingUpdate);

  /* 5. Layer toggle */
  onLayerToggle(handleLayerToggle);

  /* 6. When map ready → load data + auto-load default GLB */
  onMapReady(async () => {
    /* Prefetch baseline data from public APIs */
    try {
      await prefetchAllBaselineData(state);
    } catch (e) {
      console.warn('[main] baseline prefetch error:', e);
    }

    /* Auto-load default GLB if configured */
    if (CONFIG.DEFAULT_GLB) {
      try {
        document.getElementById('massing-status').textContent = 'LOADING…';
        const geometry = await loadGLB(CONFIG.DEFAULT_GLB);
        state.massing.loaded = true;
        state.massing.geometry = geometry;
        document.getElementById('massing-status').textContent = 'LOADED';
        const dzEl = document.getElementById('drop-zone');
        if (dzEl) dzEl.classList.add('hidden');
        const btnClr = document.getElementById('btn-clear-glb');
        if (btnClr) btnClr.disabled = false;
        setDerived(geometry);
        // Auto-fill GFA from floor-sliced geometry (5 m floors) or fallback estimate
        if (geometry) {
          const gfa = geometry.total_gfa
            ? Math.round(geometry.total_gfa)
            : Math.round(geometry.footprint_m2 * geometry.num_floors_est * 0.85);
          state.program.gfa_m2 = gfa;
          const gfaEl = document.getElementById('in-gfa');
          if (gfaEl) gfaEl.value = gfa;
        }
        // Cinematic zoom-in from globe to site removed to keep USA view
        // flyToSite();
      } catch (err) {
        console.warn('[main] default GLB load failed:', err);
        document.getElementById('massing-status').textContent = 'NOT LOADED';
        const dzEl = document.getElementById('drop-zone');
        if (dzEl) dzEl.classList.remove('hidden');
      }
    }

    /* Initial impact model run + render */
    fullUpdate();
  });

  /* 7. Geocoder search */
  wireGeoSearch();

  /* 8. Wrap Inspector */
  initWrapInspector();

  /* 9. Mode toggle (layers / massing / impact) */
  wireModeToggle();

  /* 10. Panel collapse toggles */
  wirePanelToggles();

  /* 11. Left panel tab bar */
  wireLpTabs();

  /* 12. Footer init */
  initFooter();

  /* 13. Keyboard shortcuts */
  document.addEventListener('keydown', e => {
    if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'ArrowLeft') { e.preventDefault(); setTimeStep(Math.max(0, state.timeStep - 1)); }
    if (e.code === 'ArrowRight') { e.preventDefault(); setTimeStep(Math.min(4, state.timeStep + 1)); }
    if (e.code === 'KeyW')  { e.preventDefault(); toggleWrapInspector(); }
  });
}

/* ================================================================
   TIME SCRUBBER
   ================================================================ */
function wireTimeScrubber() {
  const steps = document.querySelectorAll('.scrubber-step');
  steps.forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeStep(parseInt(btn.getAttribute('data-step'), 10));
    });
  });
}

const SCRUB_LABELS = ['BASELINE T0', 'BUILD T1', 'OPEN +1Y', 'SETTLED +5Y', 'HORIZON +20Y'];

function setTimeStep(step) {
  state.timeStep = step;

  document.querySelectorAll('.scrubber-step').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === step);
    btn.classList.toggle('filled', idx < step);
  });

  const fill = document.getElementById('scrubber-fill');
  if (fill) fill.style.width = `${(step / 4) * 100}%`;

  const label = SCRUB_LABELS[step];

  const scenarioTag = document.getElementById('scenario-tag');
  if (scenarioTag) scenarioTag.textContent = label;

  const modeTag = document.getElementById('mode-tag');
  if (modeTag) modeTag.textContent = step === 0 ? 'CONTEXT' : 'PROJECTION';

  _syncRpSub();
  fullUpdate();
}

/* ================================================================
   LAYER TOGGLE
   ================================================================ */
function handleLayerToggle(layerId) {
  if (state.activeLayerIds.has(layerId)) {
    state.activeLayerIds.delete(layerId);
  } else {
    state.activeLayerIds.add(layerId);
  }
  // Sync the most recently toggled layer to the Wrap Inspector
  const mostRecent = state.activeLayerIds.has(layerId) ? layerId : [...state.activeLayerIds].at(-1) ?? null;
  syncActiveLayer(mostRecent);
  fullUpdate();
}

/* ================================================================
   MASSING + PROGRAM UPDATES
   ================================================================ */
function handleMassingUpdate(update) {
  if (update.clear) {
    clearMassing();
    state.massing.loaded = false;
    state.massing.geometry = null;
    fullUpdate();
    return;
  }
  if (update.geometry) {
    handleGeometryUpdate(update.geometry); // async fire-and-forget
    return;
  }
  if (update.transform) {
    Object.assign(state.massing.transform, update.transform);
    updateMassingTransform(update.transform);
    // Update the context site coords for impact model
    if (update.transform.anchor_lat || update.transform.anchor_lon) {
      const coordsEl = document.getElementById('site-coords');
      if (coordsEl) {
        const t = getMassingTransform();
        coordsEl.textContent = `${t.anchor_lat.toFixed(4)} / ${t.anchor_lon.toFixed(4)}`;
      }
    }
    fullUpdate();
  }
  if (update.program) {
    Object.assign(state.program, update.program);
    fullUpdate();
  }
}

/* ================================================================
   GEOMETRY UPDATE — async because isochrone fetch may be needed
   ================================================================ */
async function handleGeometryUpdate(geoUpdate) {
  Object.assign(state.impactGeometry, geoUpdate);

  // Re-fetch isochrone when switching to that mode or changing walk time
  if (state.impactGeometry.mode === 'isochrone' &&
      (geoUpdate.mode === 'isochrone' || 'iso_minutes' in geoUpdate)) {
    const t       = getMassingTransform();
    const mins    = state.impactGeometry.iso_minutes;
    const feature = await fetchIsochrone(t.anchor_lon, t.anchor_lat, mins);
    state.impactGeometry.polygon = feature;
    if (!feature) console.warn('[main] isochrone fetch returned null — check network');
  }

  // Drawn polygon arrives directly in update.polygon; no extra fetch needed
  fullUpdate();
}

/* ================================================================
   FULL UPDATE — re-run impact model + re-render everything
   ================================================================ */
function fullUpdate() {
  const transform = getMassingTransform();

  // Build geometry from loaded mesh or use defaults
  const geometry = state.massing.geometry || {
    footprint_m2:   2200,
    height_m:       45,
    volume_m3:      99000,
    num_floors_est: 11,
  };

  // Build context for impact model
  const context = {
    site_lat_lon: [transform.anchor_lat, transform.anchor_lon],
    baseline: state.baselineData,
  };

  // Run impact model
  state.impactResults = runImpactModel({
    geometry,
    program: state.program,
    context,
    timeStep: state.timeStep,
  });

  // Render UI
  renderLayers(state);
  renderReadouts(state);
  _syncRpSub();
  _syncFooter();

  // Render map overlays — only when mode is 'after' or we want baseline vis
  renderActiveLayers(state);
}

/* ================================================================
   GEOCODER SEARCH
   ================================================================ */
function wireGeoSearch() {
  const input   = document.getElementById('geo-input');
  const results = document.getElementById('geo-results');
  if (!input || !results) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { results.innerHTML = ''; return; }
    debounce = setTimeout(async () => {
      const features = await geocode(q);
      results.innerHTML = features.map(f => {
        const name = f.text || f.place_name || '';
        const sub  = (f.place_name || '').split(',').slice(1).join(',').trim();
        const lng  = f.center?.[0] ?? 0;
        const lat  = f.center?.[1] ?? 0;
        return `<li class="geo-result-item" data-lng="${lng}" data-lat="${lat}">
          <span class="geo-result-name">${name}</span>
          ${sub ? `<span class="geo-result-sub">${sub}</span>` : ''}
        </li>`;
      }).join('');
    }, 280);
  });

  results.addEventListener('click', e => {
    const li = e.target.closest('.geo-result-item');
    if (!li) return;
    const lng = parseFloat(li.dataset.lng);
    const lat = parseFloat(li.dataset.lat);
    flyTo([lng, lat], { zoom: 14, pitch: 55, bearing: 0, duration: 3000 });
    input.value = li.querySelector('.geo-result-name')?.textContent ?? '';
    results.innerHTML = '';
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#geo-search')) results.innerHTML = '';
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.innerHTML = ''; input.blur(); }
  });
}

/* ================================================================
   MODE TOGGLE (layers / massing / impact)
   ================================================================ */
let _currentMode = 'impact';

function wireModeToggle() {
  document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
}

function setMode(mode) {
  _currentMode = mode;

  /* Highlight active button */
  document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  /* Show correct right panel body */
  document.querySelectorAll('.rp-mode-body').forEach(el => {
    el.classList.remove('active');
  });
  if (mode === 'massing') {
    document.getElementById('rp-massing')?.classList.add('active');
  } else {
    document.getElementById('rp-impact')?.classList.add('active');
  }

  /* Update right panel header title */
  const titleEl = document.getElementById('rp-title');
  if (titleEl) {
    titleEl.textContent = mode === 'massing' ? 'MASSING MODEL'
      : mode === 'impact'                    ? 'IMPACT READOUTS'
      : 'LAYER SETTINGS';
  }

  _syncRpSub();
}

/* ================================================================
   PANEL COLLAPSE TOGGLES
   ================================================================ */
function wirePanelToggles() {
  document.getElementById('btn-toggle-lpanel')?.addEventListener('click', () => {
    const panel = document.getElementById('panel-left');
    if (!panel) return;
    const isOpen = !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', isOpen);
    document.body.classList.toggle('lpanel-closed', isOpen);
    document.getElementById('btn-toggle-lpanel')?.classList.toggle('active', !isOpen);
  });

  document.getElementById('btn-toggle-rpanel')?.addEventListener('click', () => {
    const panel = document.getElementById('panel-right');
    if (!panel) return;
    const isOpen = !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', isOpen);
    document.body.classList.toggle('rpanel-closed', isOpen);
    document.getElementById('btn-toggle-rpanel')?.classList.toggle('active', !isOpen);
  });
}

/* ================================================================
   LEFT PANEL TABS
   ================================================================ */
function wireLpTabs() {
  document.querySelectorAll('.lp-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.lp-tab-body').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`lp-${tab.dataset.tab}`)?.classList.add('active');
    });
  });
}

/* ================================================================
   RIGHT PANEL SUBTITLE SYNC
   ================================================================ */
function _syncRpSub() {
  const sub = document.getElementById('rp-sub');
  if (!sub) return;
  const label   = SCRUB_LABELS[state.timeStep] || 'BASELINE T0';
  const radius  = state.impactGeometry?.radius_m ?? 400;
  const geoMode = state.impactGeometry?.mode ?? 'euclidean';
  const radiusStr = geoMode === 'euclidean' ? `${radius} m`
    : geoMode === 'isochrone'               ? `${state.impactGeometry.iso_minutes ?? 15} min walk`
    : 'drawn';
  sub.textContent = `Scenario: ${label} · Radius: ${radiusStr}`;
}

/* ================================================================
   FOOTER INIT — populates static and dynamic footer items
   ================================================================ */
function initFooter() {
  _syncFooter();
}

function _syncFooter() {
  const programNames = {
    museum_art:     'Museum · Art',
    museum_science: 'Museum · Science',
    museum_media:   'Museum · Media',
    office:         'Office',
    residential:    'Residential',
    hotel:          'Hotel',
    retail:         'Retail',
    education:      'Education',
    lab:            'Lab / Research',
  };
  const progEl = document.getElementById('program-tag');
  if (progEl) progEl.textContent = programNames[state.program.type] || state.program.type;

  const gfaEl = document.getElementById('gfa-tag');
  if (gfaEl) gfaEl.textContent = `${(state.program.gfa_m2 || 0).toLocaleString()} m²`;

  const radiusEl = document.getElementById('radius-footer');
  if (radiusEl) radiusEl.textContent = state.impactGeometry?.radius_m ?? 400;
}

/* Legacy no-op stubs */
function startClock() {}
function buildMarquee() {}
