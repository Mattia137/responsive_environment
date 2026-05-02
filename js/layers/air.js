/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/air.js
   Air quality — global PM2.5 heatmap via Open-Meteo Air Quality API.
   BEFORE: baseline PM2.5 heatmap interpolated around the site.
   AFTER:  same heatmap + construction/operation plume centred on massing.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-air';

/* Module-level API cache keyed by "lat_lon" */
let _apiCache    = null;
let _apiCacheKey = '';

/* ── Fetch Open-Meteo Air Quality (free, global, no key) ── */
async function fetchAirQuality(lat, lon) {
  const key = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
  if (_apiCacheKey === key && _apiCache !== null) return _apiCache;

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=pm2_5,nitrogen_dioxide,ozone` +
    `&timezone=auto&forecast_days=1`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    /* Take the first non-null PM2.5 reading of the day */
    const pm25Values = (data.hourly?.pm2_5 || []).filter(v => v != null);
    const pm25 = pm25Values.length ? pm25Values[0] : 8.5;
    _apiCache    = { pm25, raw: data };
    _apiCacheKey = key;
    return _apiCache;
  } catch (e) {
    console.warn('[air] Open-Meteo fetch failed, using fallback:', e.message);
    _apiCache    = { pm25: 8.5, raw: null };
    _apiCacheKey = key;
    return _apiCache;
  }
}

/* ── Build ~80-point heatmap grid around the site ── */
function buildHeatmapFeatures(basePm25, mode, siteLat, siteLon, footprintR_m) {
  const features = [];

  /* Grid: lat ±0.04, lon ±0.06 → ~9×9 = 81 cells */
  const dLat = 0.04, dLon = 0.06;
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lat = siteLat - dLat + (2 * dLat * i / steps);
      const lon = siteLon - dLon + (2 * dLon * j / steps);

      /* Distance in rough metres */
      const dLatM = (lat - siteLat) * 111111;
      const dLonM = (lon - siteLon) * 111111 * Math.cos(siteLat * Math.PI / 180);
      const dist  = Math.sqrt(dLatM * dLatM + dLonM * dLonM);

      /* IDW falloff from site reading — sharper near centre */
      const decay  = 1 / (1 + dist / 8000);
      const pm25   = basePm25 * (0.6 + 0.4 * decay) + (Math.random() - 0.5) * 0.4;
      const weight = pm25 / 25;  // normalised to unhealthy threshold

      features.push({
        type: 'Feature',
        properties: { weight, pm25 },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      });
    }
  }

  /* AFTER mode: construction plume within 200 m of anchor */
  if (mode === 'after') {
    const plumeRadius_deg = 200 / 111111;
    const n = 40;
    for (let i = 0; i < n; i++) {
      const r     = Math.random() ** 0.5 * plumeRadius_deg;
      const theta = Math.random() * Math.PI * 2;
      const lat   = siteLat + r * Math.cos(theta);
      const lon   = siteLon + r * Math.sin(theta) / Math.cos(siteLat * Math.PI / 180);
      const proximityFactor = 1 - (r / plumeRadius_deg);
      const pm25  = basePm25 + proximityFactor * 12;  // up to +12 µg/m³ near site
      features.push({
        type: 'Feature',
        properties: { weight: pm25 / 25, pm25, plume: true },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      });
    }
  }

  return features;
}

/* ── Main render ── */
export async function render(state) {
  const map = getMap();
  if (!map) return;

  const t       = state.massing?.transform || {};
  const siteLat = t.anchor_lat ?? 40.7539;
  const siteLon = t.anchor_lon ?? -74.0063;

  /* Fetch live PM2.5 */
  const airData = await fetchAirQuality(siteLat, siteLon);
  const basePm25 = airData.pm25;

  const footprintR_m = state.massing?.geometry?.footprint_m2
    ? Math.sqrt(state.massing.geometry.footprint_m2 / Math.PI)
    : 30;

  const features = buildHeatmapFeatures(basePm25, state.timeStep, siteLat, siteLon, footprintR_m);
  const srcId    = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  /* Heatmap — blue (good) → cyan → green → yellow → orange → red (unhealthy) */
  ensureLayer({
    id:     `${P}-heat`,
    type:   'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 13, 1.5, 18, 3],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 8, 25, 13, 50, 18, 90],
      'heatmap-opacity':   state.timeStep > 0 ? 0.82 : 0.65,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.10, '#0050ff',   // blue       — good  (< 5 µg/m³)
        0.25, '#00ccff',   // cyan
        0.45, '#00dd88',   // green
        0.60, '#ffee00',   // yellow
        0.80, '#ff8800',   // orange     — unhealthy for sensitive
        1.0,  '#cc0000',   // red        — unhealthy (> 25 µg/m³)
      ],
    },
  });

  /* Show/remove after-mode plume highlight ring */
  const plumeSrcId = `${P}-plume-src`;
  if (state.timeStep === 1) {
    const plumeCircle = turf.circle([siteLon, siteLat], 0.2, { units: 'kilometers', steps: 48 });
    ensureSource(plumeSrcId, { type: 'FeatureCollection', features: [plumeCircle] });
    ensureLayer({
      id:     `${P}-plume-ring`,
      type:   'line',
      source: plumeSrcId,
      paint: {
        'line-color':     '#ff8800',
        'line-width':     1.5,
        'line-dasharray': [4, 3],
        'line-opacity':   0.75,
      },
    });
  } else {
    removeLayer(`${P}-plume-ring`);
    removeSource(plumeSrcId);
  }

  /* Legend */
  const result  = state.impactResults?.air;
  const pm25Str = basePm25.toFixed(1);
  showLegend({
    title: `AIR QUALITY — PM2.5${state.timeStep > 0 ? ' + PLUME' : ' BASELINE'}`,
    gradient: {
      stops: [
        { color: '#0050ff', at: 0 },
        { color: '#00ccff', at: 0.2 },
        { color: '#00dd88', at: 0.45 },
        { color: '#ffee00', at: 0.65 },
        { color: '#ff8800', at: 0.82 },
        { color: '#cc0000', at: 1 },
      ],
      min: '< 5', max: '> 25', unit: 'µg/m³ PM2.5',
    },
    items: [
      { color: '#0050ff', label: 'GOOD',             value: '< 5 µg/m³' },
      { color: '#00dd88', label: 'MODERATE',          value: '5–12' },
      { color: '#ffee00', label: 'SENSITIVE',         value: '12–25' },
      { color: '#cc0000', label: 'UNHEALTHY',         value: '> 25' },
    ],
    note: state.timeStep > 0
      ? `Site: ${pm25Str} µg/m³ baseline · +construction plume (200 m radius)`
      : `Live reading at site: ${pm25Str} µg/m³ · WHO guideline 5 µg/m³`,
  });
}

export function clear() {
  [`${P}-heat`, `${P}-plume-ring`].forEach(removeLayer);
  [`${P}-src`, `${P}-plume-src`].forEach(removeSource);
  hideLegend();
}
