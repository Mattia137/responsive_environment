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
  theme: 'dark',
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
        // Cinematic zoom-in from globe to site
        flyToSite();
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

  /* 8b. Wrap Inspector */
  initWrapInspector();

  /* 8. Live clock */
  startClock();

  /* 9. Footer marquee */
  buildMarquee();

  /* 10. Keyboard shortcuts */
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

function setTimeStep(step) {
  state.timeStep = step;
  
  const steps = document.querySelectorAll('.scrubber-step');
  const fill = document.getElementById('scrubber-fill');
  
  steps.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === step);
    btn.classList.toggle('filled', idx < step);
  });
  
  if (fill) {
    fill.style.width = `${(step / 4) * 100}%`;
  }
  
  const tags = [
    'BASELINE',
    'CONSTRUCTION · PEAK',
    '+ MASSING · OPEN +1Y',
    '+ MASSING · SETTLED +5Y',
    '+ MASSING · HORIZON +20Y'
  ];
  const tagEl = document.getElementById('scenario-tag');
  if (tagEl) tagEl.textContent = tags[step];
  
  const modeTag = document.getElementById('mode-tag');
  if (modeTag) modeTag.textContent = step === 0 ? 'CONTEXT' : 'PROJECTION';
  
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
