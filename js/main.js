/* =========================================================================
   ALLSPARK // IMPACT  ·  js/main.js
   Bootstrap — wires map, massing, impact model, layers, readouts, and UI.
   ========================================================================= */

import { CONFIG } from '../config.js';
import { initMap, getMap, onMapReady, setTheme as setMapTheme } from './map.js';
import { loadGLB, clearMassing, updateMassingTransform, getMassingTransform, extractGeometry } from './massing.js';
import { runImpactModel } from './impact-model.js';
import { prefetchAllBaselineData } from './data-loader.js';
import { initTheme, onThemeChange } from './ui/theme.js';
import { renderLayers, onLayerToggle } from './ui/panel-layers.js';
import { initMassingControls, onMassingUpdate, setDerived, handleFile } from './ui/panel-massing.js';
import { renderReadouts } from './ui/panel-readouts.js';
import { renderActiveLayers } from './layers/dispatch.js';

/* ================================================================
   APPLICATION STATE — single source of truth
   ================================================================ */
const state = {
  theme: 'dark',
  mode: 'before',          // 'before' | 'after'
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

  /* 3. Before/After toggle */
  wireStateToggle();

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
        // Auto-fill GFA estimate
        if (geometry) {
          const gfa = Math.round(geometry.footprint_m2 * geometry.num_floors_est * 0.85);
          state.program.gfa_m2 = gfa;
          const gfaEl = document.getElementById('in-gfa');
          if (gfaEl) gfaEl.value = gfa;
        }
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

  /* 7. Live clock */
  startClock();

  /* 8. Footer marquee */
  buildMarquee();

  /* 9. Keyboard shortcuts */
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) {
      e.preventDefault();
      toggleMode();
    }
  });
}

/* ================================================================
   BEFORE / AFTER TOGGLE
   ================================================================ */
function wireStateToggle() {
  const btnBefore = document.getElementById('btn-before');
  const btnAfter  = document.getElementById('btn-after');
  btnBefore?.addEventListener('click', () => setMode('before'));
  btnAfter?.addEventListener('click',  () => setMode('after'));
}

function setMode(mode) {
  state.mode = mode;
  document.getElementById('btn-before').classList.toggle('active', mode === 'before');
  document.getElementById('btn-after').classList.toggle('active',  mode === 'after');
  document.getElementById('scenario-tag').textContent = mode === 'before' ? 'BASELINE' : '+ MASSING · 5YR';
  document.getElementById('mode-tag').textContent = mode === 'before' ? 'CONTEXT' : 'PROJECTION';
  fullUpdate();
}

function toggleMode() {
  setMode(state.mode === 'before' ? 'after' : 'before');
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
  });

  // Render UI
  renderLayers(state);
  renderReadouts(state);

  // Render map overlays — only when mode is 'after' or we want baseline vis
  renderActiveLayers(state);
}

/* ================================================================
   LIVE CLOCK
   ================================================================ */
function startClock() {
  const el = document.getElementById('local-time');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}

/* ================================================================
   FOOTER MARQUEE — cycles dataset names + sources
   ================================================================ */
function buildMarquee() {
  const track = document.getElementById('marquee-track');
  if (!track) return;
  const sources = [
    'EPA AirNow API',
    'NYC DOHMH NYCCAS',
    'NYC LL84 Energy Disclosure',
    'NYC DOT Pedestrian Volumes',
    'MTA Daily Ridership',
    'MapPLUTO',
    'NYC DOF Rolling Sales',
    'StreetEasy ZORI',
    'HUD Fair Market Rent',
    'ACS 5-Year Census',
    'HPD Eviction Filings',
    'DCP Storefront Tracker',
    'NYC DOF Business Registrations',
    'Citi Bike System Data',
    'NYC DOB Job Filings',
    'Turner Cost Index',
    'EC3 Building Transparency',
    'NYC DEP CSO Outfalls',
    'NOAA Atlas 14',
    'NYC DSNY Commercial Waste Zones',
    'NYC SoundScore',
    'NYC 311 Noise Complaints',
    'Furman Center',
    'MapTiler GL JS',
    'OpenStreetMap',
  ];
  const sep = '   ·   ';
  const text = sources.join(sep);
  // Duplicate for seamless scroll loop
  track.textContent = text + sep + text + sep;
}
