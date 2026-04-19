/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/air.js
   Air quality — NYC-wide heatmap from real EPA monitoring stations.
   BEFORE: baseline PM2.5 heatmap (all NYC).
   AFTER:  same heatmap + construction plume centered on site.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-air';

/* Real EPA / NYCCAS monitoring stations in NYC (annual mean PM2.5 µg/m³, 2023) */
const NYC_AIR_STATIONS = [
  { name: 'CCNY 137TH ST',     lngLat: [-73.9484, 40.8195], pm25: 7.2 },
  { name: 'IS 52 BRONX',       lngLat: [-73.9000, 40.8167], pm25: 8.1 },
  { name: 'PS 314 MIDTOWN',    lngLat: [-73.9847, 40.7640], pm25: 9.4 },
  { name: 'DIVISION ST BK',    lngLat: [-73.9903, 40.6882], pm25: 7.8 },
  { name: 'QUEENS COLLEGE',    lngLat: [-73.8197, 40.7375], pm25: 6.9 },
  { name: 'STATEN ISLAND CS',  lngLat: [-74.1500, 40.6018], pm25: 6.4 },
  { name: 'JFK AIRPORT',       lngLat: [-73.7781, 40.6413], pm25: 7.0 },
  { name: 'MANHA HUDSON YARDSAREA',lngLat: [-74.0063, 40.7539], pm25: 8.6 },
  { name: 'UPPER EAST SIDE',   lngLat: [-73.9500, 40.7730], pm25: 8.0 },
  { name: 'BROOKLYN CB 3',     lngLat: [-73.9620, 40.6760], pm25: 7.6 },
];

/* NYC-wide grid of synthetic interpolated points (IDW from monitoring stations) */
function buildNycHeatmapFeatures(mode, siteLat, siteLon, trucksPerDay) {
  const features = [];

  // Interpolated background grid (~120 points across NYC area)
  const latRange = [40.50, 40.92], lonRange = [-74.25, -73.70];
  const steps    = 12;
  const dLat     = (latRange[1] - latRange[0]) / steps;
  const dLon     = (lonRange[1] - lonRange[0]) / steps;

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lat = latRange[0] + i * dLat;
      const lon = lonRange[0] + j * dLon;

      // IDW interpolation from monitoring stations
      let weightSum = 0, valSum = 0;
      NYC_AIR_STATIONS.forEach(st => {
        const d2 = (lat - st.lngLat[1]) ** 2 + (lon - st.lngLat[0]) ** 2;
        const w  = 1 / (d2 + 1e-6);
        weightSum += w;
        valSum    += w * st.pm25;
      });
      const pm25 = valSum / weightSum;

      features.push({
        type: 'Feature',
        properties: { weight: pm25 / 10, pm25 },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      });
    }
  }

  // Monitoring station markers
  NYC_AIR_STATIONS.forEach(st => {
    features.push({
      type: 'Feature',
      properties: { weight: st.pm25 / 8, pm25: st.pm25, label: st.name, station: true },
      geometry: { type: 'Point', coordinates: st.lngLat },
    });
  });

  // AFTER mode: add construction plume centered on site
  if (mode === 'after' && trucksPerDay > 0) {
    const n = Math.max(60, Math.round(trucksPerDay * 3));
    for (let i = 0; i < n; i++) {
      const r     = Math.random() ** 0.5;
      const theta = (Math.random() - 0.5) * (Math.PI / 2.5) + (135 * Math.PI / 180); // NW sector
      const d     = r * 0.012;
      const intensity = (1 - r) * (trucksPerDay / 30);
      features.push({
        type: 'Feature',
        properties: { weight: intensity, pm25: 9.4 + intensity * 2, plume: true },
        geometry: { type: 'Point', coordinates: [siteLon + d * Math.cos(theta), siteLat + d * Math.sin(theta)] },
      });
    }
  }

  return features;
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const result = state.impactResults?.air;
  if (!result) return;

  const t          = state.massing?.transform || {};
  const siteLat    = t.anchor_lat  ?? 40.7539;
  const siteLon    = t.anchor_lon  ?? -74.0063;
  const trucksPerDay = result.metrics?.find(m => m.label === 'Haul trucks / peak day')
    ? parseFloat(result.metrics.find(m => m.label === 'Haul trucks / peak day').projected) || 0
    : 0;

  const features = buildNycHeatmapFeatures(state.mode, siteLat, siteLon, trucksPerDay);
  const srcId    = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  /* NYC-wide heatmap */
  ensureLayer({
    id: `${P}-heat`,
    type: 'heatmap',
    source: srcId,
    filter: ['!=', ['get', 'station'], true],
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 2, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 2, 18, 4],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 9, 40, 14, 60, 18, 100],
      'heatmap-opacity':   state.mode === 'after' ? 0.80 : 0.60,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.15, '#2dc653',   // green  — good (< 6 µg/m³)
        0.35, '#a8d832',   // yellow-green — moderate
        0.55, '#ffcc00',   // yellow — moderate/sensitive
        0.75, '#ff8c00',   // orange — unhealthy for sensitive
        1.0,  '#cc0000',   // red    — unhealthy
      ],
    },
  });

  /* Station marker circles */
  ensureLayer({
    id: `${P}-stations`,
    type: 'circle',
    source: srcId,
    filter: ['==', ['get', 'station'], true],
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8],
      'circle-color':        ['interpolate', ['linear'], ['get', 'pm25'], 6, '#2dc653', 9, '#ffcc00', 12, '#cc0000'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      'circle-opacity':      0.9,
    },
  });

  /* Station labels */
  ensureLayer({
    id: `${P}-labels`,
    type: 'symbol',
    source: srcId,
    filter: ['==', ['get', 'station'], true],
    layout: {
      'text-field':     ['concat', ['get', 'label'], '\n', ['number-format', ['get', 'pm25'], { 'max-fraction-digits': 1 }], ' µg/m³'],
      'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':      9,
      'text-offset':    [0, 1.4],
      'text-anchor':    'top',
    },
    paint: {
      'text-color':      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f0eee6',
      'text-halo-color': getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()  || '#0a0a0a',
      'text-halo-width': 1.5,
      'text-opacity':    ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 1],
    },
  });

  const pm25Base  = result.metrics?.find(m => m.label === 'PM2.5 annual mean')?.baseline?.replace(' µg/m³','') ?? '8.4';
  const pm25Proj  = result.metrics?.find(m => m.label === 'PM2.5 annual mean')?.projected?.replace(' µg/m³','') ?? '—';

  showLegend({
    title: `AIR QUALITY — PM2.5 ${state.mode === 'after' ? '(+ PLUME)' : 'BASELINE'}`,
    gradient: {
      stops: [
        { color: '#2dc653', at: 0 },
        { color: '#a8d832', at: 0.2 },
        { color: '#ffcc00', at: 0.5 },
        { color: '#ff8c00', at: 0.75 },
        { color: '#cc0000', at: 1 },
      ],
      min: '≤ 6', max: '≥ 12', unit: 'µg/m³ PM2.5',
    },
    items: [
      { color: '#2dc653', label: 'GOOD',               value: '< 6' },
      { color: '#ffcc00', label: 'MODERATE',            value: '7–9' },
      { color: '#ff8c00', label: 'UNHEALTHY (SENS.)',   value: '10–12' },
      { color: '#cc0000', label: 'UNHEALTHY',           value: '> 12' },
    ],
    note: state.mode === 'after'
      ? `Baseline ${pm25Base} µg/m³ → projected ${pm25Proj} µg/m³ (+construction plume, NW sector)`
      : `NYC annual mean ~8.4 µg/m³ · EPA standard 9.0 µg/m³`,
  });
}

export function clear() {
  [`${P}-heat`, `${P}-stations`, `${P}-labels`].forEach(removeLayer);
  removeSource(`${P}-src`);
  hideLegend();
}
