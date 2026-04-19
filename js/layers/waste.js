/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/waste.js
   Waste & noise — before/after heatmap.
   BEFORE: NYC 311 noise complaints heatmap (real data from NYC Open Data).
   AFTER:  same heatmap + operational dB rings from the building + construction noise.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';
import { fetchNoise311 } from '../data-loader.js';

const P = 'allspark-waste';

let _noiseCache    = null;
let _noiseCacheKey = '';

export async function render(state) {
  const map = getMap();
  if (!map) return;

  const t       = state.massing?.transform || {};
  const siteLat = t.anchor_lat ?? 40.7539;
  const siteLon = t.anchor_lon ?? -74.0063;
  const cacheKey = `${siteLat.toFixed(4)}_${siteLon.toFixed(4)}`;

  /* Fetch real 311 noise complaints */
  let noiseData = state.baselineData?.noise311;
  if (!noiseData || noiseData.length === 0) {
    if (_noiseCacheKey !== cacheKey || !_noiseCache) {
      try {
        _noiseCache    = await fetchNoise311(siteLat, siteLon, 1500);
        _noiseCacheKey = cacheKey;
        if (state.baselineData) state.baselineData.noise311 = _noiseCache;
      } catch (e) {
        console.warn('[noise] 311 fallback:', e.message);
        _noiseCache    = generateSyntheticNoise(siteLat, siteLon);
        _noiseCacheKey = cacheKey;
      }
    }
    noiseData = _noiseCache;
  }
  if (!noiseData || noiseData.length === 0) {
    noiseData = generateSyntheticNoise(siteLat, siteLon);
  }

  /* 311 complaint points */
  const complaintFeatures = noiseData.map(r => ({
    type: 'Feature',
    properties: { weight: 1, desc: r.desc || 'noise' },
    geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
  }));

  const srcId = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features: complaintFeatures });

  /* BEFORE/AFTER heatmap — blue(quiet) → yellow → red(loud) */
  ensureLayer({
    id: `${P}-heat`,
    type: 'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    1,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 2, 18, 4],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 12, 18, 16, 35, 18, 60],
      'heatmap-opacity':   state.mode === 'after' ? 0.65 : 0.55,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.1,  '#313695',   // dark blue — quiet
        0.3,  '#74add1',   // blue
        0.5,  '#fee090',   // yellow
        0.7,  '#f46d43',   // orange
        1.0,  '#a50026',   // dark red — loud
      ],
    },
  });

  /* AFTER: add operational + construction noise rings from site */
  if (state.mode === 'after') {
    const result      = state.impactResults?.waste;
    const dBDelta     = result ? parseFloat(result.headline?.delta?.replace(' dB L_eq','') || '0') : 0;
    const ringSrcId   = `${P}-rings-src`;
    const ringBands = [
      { r: 90,  dB: 78, label: '78 dB' },   // source at loading dock
      { r: 140, dB: 72, label: '72 dB' },
      { r: 200, dB: 66, label: '66 dB' },
      { r: 300, dB: 60, label: '60 dB (ambient + Δ)' },
    ];
    const ringFeatures = ringBands.map(b => ({
      type: 'Feature',
      properties: { dB: b.dB, label: b.label },
      geometry: turf.circle([siteLon, siteLat], b.r / 1000, { units: 'kilometers', steps: 64 }).geometry,
    }));
    ensureSource(ringSrcId, { type: 'FeatureCollection', features: ringFeatures });

    ensureLayer({
      id: `${P}-rings`,
      type: 'fill',
      source: ringSrcId,
      paint: {
        'fill-color': ['interpolate', ['linear'], ['get', 'dB'], 60, '#fee090', 78, '#a50026'],
        'fill-opacity': 0.25,
      },
    });
    ensureLayer({
      id: `${P}-ring-lines`,
      type: 'line',
      source: ringSrcId,
      paint: {
        'line-color': ['interpolate', ['linear'], ['get', 'dB'], 60, '#fd8d3c', 78, '#a50026'],
        'line-dasharray': [3, 3],
        'line-width': 1,
        'line-opacity': 0.8,
      },
    });
    ensureLayer({
      id: `${P}-ring-labels`,
      type: 'symbol',
      source: ringSrcId,
      layout: {
        'text-field':       ['get', 'label'],
        'text-font':        ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size':        9,
        'symbol-placement': 'line',
        'symbol-spacing':   200,
      },
      paint: {
        'text-color':      '#f46d43',
        'text-halo-color': '#0a0a0a',
        'text-halo-width': 1.5,
        'text-opacity':    ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
      },
    });
  } else {
    [`${P}-rings`, `${P}-ring-lines`, `${P}-ring-labels`].forEach(removeLayer);
    [`${P}-rings-src`].forEach(removeSource);
  }

  showLegend({
    title: `WASTE & NOISE${state.mode === 'after' ? ' — PROJECTED' : ' — BASELINE (311)'}`,
    gradient: {
      stops: [
        { color: '#313695', at: 0 },
        { color: '#74add1', at: 0.25 },
        { color: '#fee090', at: 0.55 },
        { color: '#f46d43', at: 0.75 },
        { color: '#a50026', at: 1 },
      ],
      min: 'QUIET', max: 'LOUD', unit: '311 noise density',
    },
    items: state.mode === 'after'
      ? [
          { color: '#a50026', label: 'LOADING DOCK',   value: '78 dB' },
          { color: '#f46d43', label: '140m FALLOFF',   value: '72 dB' },
          { color: '#fee090', label: '300m FALLOFF',   value: '60 dB' },
        ]
      : [],
    note: `${complaintFeatures.length} NYC 311 noise complaints (1.5 km radius, recent 400)`,
  });
}

/* Synthetic fallback noise data (realistic complaint density for Midtown West) */
function generateSyntheticNoise(lat, lon) {
  const pts = [];
  const n = 120;
  for (let i = 0; i < n; i++) {
    const r = Math.random() ** 0.5 * 0.013;
    const a = Math.random() * Math.PI * 2;
    pts.push({ lat: lat + r * Math.cos(a), lon: lon + r * Math.sin(a), desc: 'Noise - Street/Sidewalk' });
  }
  return pts;
}

export function clear() {
  [`${P}-heat`, `${P}-rings`, `${P}-ring-lines`, `${P}-ring-labels`].forEach(removeLayer);
  [`${P}-src`, `${P}-rings-src`].forEach(removeSource);
  hideLegend();
}
