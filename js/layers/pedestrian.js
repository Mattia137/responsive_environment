/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/pedestrian.js
   Pedestrian traffic — road-overlay heatmap (green → red) like Maps traffic.
   BEFORE: baseline foot-traffic density on streets near the site.
   AFTER:  same heatmap boosted by projected museum visitors on key corridors.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-ped';

/* Key pedestrian corridors near Hudson Yards — each entry becomes dense point samples */
function buildCorridorPts() {
  const corridors = [
    { from: [-74.010, 40.7542], to: [-73.990, 40.7527], steps: 14, base: 1800 }, // 34th St
    { from: [-74.002, 40.7540], to: [-74.002, 40.7520], steps:  8, base: 2200 }, // HY plaza
    { from: [-74.008, 40.7420], to: [-74.002, 40.7540], steps: 18, base: 1400 }, // High Line
    { from: [-74.002, 40.7470], to: [-74.002, 40.7560], steps: 12, base:  900 }, // 10th Ave
    { from: [-74.009, 40.7460], to: [-74.009, 40.7560], steps: 10, base:  700 }, // 11th Ave
    { from: [-73.994, 40.7420], to: [-73.994, 40.7560], steps: 10, base: 1100 }, // 8th Ave
    { from: [-74.010, 40.7490], to: [-73.993, 40.7497], steps: 12, base:  800 }, // W 30th St
    { from: [-74.006, 40.7462], to: [-73.993, 40.7469], steps: 10, base:  700 }, // W 28th St
    { from: [-73.991, 40.7440], to: [-73.991, 40.7540], steps: 14, base: 2800 }, // 7th Ave
  ];
  const pts = [];
  corridors.forEach(({ from, to, steps, base }) => {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = from[1] + t * (to[1] - from[1]);
      const lon = from[0] + t * (to[0] - from[0]);
      // Scatter 3 points perpendicular (sidewalk width ≈ 0.00015°)
      for (let s = -1; s <= 1; s++) {
        const dx = -(to[1] - from[1]) * 0.00012 * s;
        const dy =  (to[0] - from[0]) * 0.00012 * s;
        pts.push({ lat: lat + dx, lon: lon + dy, base });
      }
    }
  });
  return pts;
}

const CORRIDOR_PTS = buildCorridorPts();

const STATION_ENTRANCES = [
  { lngLat: [-74.0019, 40.7556], boost: 0.9 },
  { lngLat: [-73.9916, 40.7505], boost: 1.0 },
  { lngLat: [-74.0001, 40.7448], boost: 0.6 },
  { lngLat: [-74.0021, 40.7483], boost: 0.5 },
];

export function render(state) {
  const map = getMap();
  if (!map) return;

  const result  = state.impactResults?.pedestrian;
  const t       = state.massing?.transform || {};
  const siteLat = t.anchor_lat ?? 40.7539;
  const siteLon = t.anchor_lon ?? -74.0063;
  const peakHr  = result?.metrics?.find(m => m.label === 'Peak-hour visitors')
    ? parseFloat(result.metrics.find(m => m.label === 'Peak-hour visitors').projected) || 0
    : 0;

  const features = CORRIDOR_PTS.map(({ lat, lon, base }) => {
    let weight = base / 3000;
    if (state.mode === 'after') {
      const d = Math.sqrt((lat - siteLat) ** 2 + (lon - siteLon) ** 2);
      weight = Math.min(1, weight + (peakHr / 100) * Math.exp(-d / 0.003));
    }
    return {
      type: 'Feature',
      properties: { weight },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    };
  });

  STATION_ENTRANCES.forEach(({ lngLat, boost }) => {
    for (let i = 0; i < 12; i++) {
      const r = Math.random() * 0.0008;
      const a = Math.random() * Math.PI * 2;
      const w = Math.min(1, boost * (state.mode === 'after' ? 1 + peakHr / 200 : 1));
      features.push({
        type: 'Feature',
        properties: { weight: w },
        geometry: { type: 'Point', coordinates: [lngLat[0] + r * Math.cos(a), lngLat[1] + r * Math.sin(a)] },
      });
    }
  });

  const srcId = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  ensureLayer({
    id: `${P}-heat`,
    type: 'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 2, 18, 4],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 20, 18, 30],
      'heatmap-opacity':   state.mode === 'after' ? 0.80 : 0.60,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.10, '#1a9641',
        0.30, '#74c476',
        0.50, '#fed976',
        0.70, '#fd8d3c',
        0.90, '#e31a1c',
        1.0,  '#800026',
      ],
    },
  });

  if (state.mode === 'after' && peakHr > 0) {
    const flowSrc = `${P}-flow-src`;
    ensureSource(flowSrc, {
      type: 'FeatureCollection',
      features: STATION_ENTRANCES.map(({ lngLat, boost }) => ({
        type: 'Feature',
        properties: { w: boost },
        geometry: { type: 'LineString', coordinates: [lngLat, [siteLon, siteLat]] },
      })),
    });
    ensureLayer({
      id: `${P}-flow`,
      type: 'line',
      source: flowSrc,
      paint: {
        'line-color':     '#fed976',
        'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 3],
        'line-dasharray': [4, 3],
        'line-opacity':   0.7,
      },
    });
  } else {
    removeLayer(`${P}-flow`);
    removeSource(`${P}-flow-src`);
  }

  const annualVis = result?.metrics?.find(m => m.label === 'Annual visitors')?.projected ?? '—';
  showLegend({
    title: `PEDESTRIAN TRAFFIC${state.mode === 'after' ? ' — PROJECTED' : ' — BASELINE'}`,
    gradient: {
      stops: [
        { color: '#1a9641', at: 0 },
        { color: '#74c476', at: 0.25 },
        { color: '#fed976', at: 0.5 },
        { color: '#fd8d3c', at: 0.75 },
        { color: '#800026', at: 1 },
      ],
      min: 'LOW', max: 'HIGH', unit: 'peds/hr',
    },
    note: state.mode === 'after'
      ? `+${Math.round(peakHr)} peak-hr visitors · ${annualVis}/yr total`
      : 'Corridors weighted by transit proximity',
  });
}

export function clear() {
  [`${P}-heat`, `${P}-flow`].forEach(removeLayer);
  [`${P}-src`, `${P}-flow-src`].forEach(removeSource);
  hideLegend();
}
