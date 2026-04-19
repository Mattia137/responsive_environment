/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/power.js
   Power supply — NYC power plants + Con Edison substations + site demand.
   Uses 5 m floor-sliced GFA from massing geometry when available.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';
import { COEFFICIENTS } from '../impact-model.js';

const P = 'allspark-power';

/* Con Edison substations near Hudson Yards (approx from public load maps) */
const SUBSTATIONS = [
  { name: 'CHELSEA–PENN',   lngLat: [-73.9997, 40.7498], kv: 138 },
  { name: 'WEST SIDE',      lngLat: [-74.0050, 40.7520], kv: 138 },
  { name: 'HELL GATE',      lngLat: [-73.9297, 40.7954], kv: 345 },
  { name: '34TH ST LOOP',   lngLat: [-73.9860, 40.7490], kv:  69 },
];

function nearestSubstation(siteLon, siteLat) {
  return SUBSTATIONS.reduce((best, s) => {
    const d = (s.lngLat[0] - siteLon) ** 2 + (s.lngLat[1] - siteLat) ** 2;
    return d < best.d ? { s, d } : best;
  }, { s: SUBSTATIONS[0], d: Infinity }).s;
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const plants = state.baselineData?.powerPlants || [];
  const t      = state.massing?.transform || {};
  const siteLat = t.anchor_lat  ?? 40.7539;
  const siteLon = t.anchor_lon  ?? -74.0063;

  /* GFA from floor-sliced geometry or program input */
  const geo    = state.massing?.geometry;
  const gfa_m2 = geo?.total_gfa ?? state.program?.gfa_m2 ?? 13750;
  const floorAreas = geo?.floor_areas ?? [];
  const eui    = COEFFICIENTS.EUI_BY_PROGRAM[state.program?.type] ?? 300;
  const annualKwh  = gfa_m2 * eui;
  const peakMW     = annualKwh * 0.00032 / 1000;

  const nearest = nearestSubstation(siteLon, siteLat);

  /* --- build GeoJSON features --- */
  const features = [];

  // Power plant dots
  plants.forEach(p => {
    features.push({
      type: 'Feature',
      properties: { kind: 'plant', name: p.name, mw: p.mw, fuel: p.fuel, label: p.name },
      geometry: { type: 'Point', coordinates: p.lngLat },
    });
  });

  // Substation dots
  SUBSTATIONS.forEach(s => {
    features.push({
      type: 'Feature',
      properties: { kind: 'sub', name: s.name, kv: s.kv, label: s.name },
      geometry: { type: 'Point', coordinates: s.lngLat },
    });
  });

  // Feeder line from site to nearest substation
  features.push({
    type: 'Feature',
    properties: { kind: 'feeder', peakMW, label: `${peakMW.toFixed(2)} MW` },
    geometry: { type: 'LineString', coordinates: [[siteLon, siteLat], nearest.lngLat] },
  });

  // Site demand circle
  if (state.mode === 'after') {
    features.push({
      type: 'Feature',
      properties: { kind: 'site', mw: peakMW, label: `${(annualKwh / 1000).toFixed(0)} MWh/yr` },
      geometry: { type: 'Point', coordinates: [siteLon, siteLat] },
    });
  }

  const srcId = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  /* Power plant circles (sized by MW) */
  ensureLayer({
    id: `${P}-plants`,
    type: 'circle',
    source: srcId,
    filter: ['==', ['get', 'kind'], 'plant'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'mw'], 100, 6, 2500, 20],
      'circle-color':  '#ff8c00',
      'circle-stroke-color': '#ffcc00',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.85,
    },
  });

  /* Substation diamonds */
  ensureLayer({
    id: `${P}-subs`,
    type: 'circle',
    source: srcId,
    filter: ['==', ['get', 'kind'], 'sub'],
    paint: {
      'circle-radius':       5,
      'circle-color':        '#5b9bd5',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      'circle-opacity':      0.9,
    },
  });

  /* Feeder line */
  ensureLayer({
    id: `${P}-feeder`,
    type: 'line',
    source: srcId,
    filter: ['==', ['get', 'kind'], 'feeder'],
    paint: {
      'line-color':     state.mode === 'after' ? '#ff5a1f' : '#d4a857',
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 1.5, 18, 4],
      'line-dasharray': [5, 3],
      'line-opacity':   state.mode === 'after' ? 0.9 : 0.4,
    },
  });

  /* Site demand circle (after only) */
  ensureLayer({
    id: `${P}-site`,
    type: 'circle',
    source: srcId,
    filter: ['==', ['get', 'kind'], 'site'],
    paint: {
      'circle-radius': Math.max(6, Math.min(24, peakMW * 60)),
      'circle-color':  '#ff5a1f',
      'circle-stroke-color': '#ffcc00',
      'circle-stroke-width': 2,
      'circle-opacity': 0.7,
    },
  });

  /* Labels */
  ensureLayer({
    id: `${P}-labels`,
    type: 'symbol',
    source: srcId,
    filter: ['any', ['==', ['get', 'kind'], 'plant'], ['==', ['get', 'kind'], 'sub']],
    layout: {
      'text-field':  ['get', 'label'],
      'text-font':   ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':   9,
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
    },
    paint: {
      'text-color':      '#f0eee6',
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
    },
  });

  /* Floor breakdown note */
  const floorNote = floorAreas.length
    ? `${floorAreas.length} floors × avg ${Math.round(floorAreas.reduce((s,f)=>s+f.area_m2,0)/floorAreas.length)} m² = ${Math.round(gfa_m2).toLocaleString()} m² GFA`
    : `Est. GFA: ${Math.round(gfa_m2).toLocaleString()} m²`;

  showLegend({
    title: `POWER SUPPLY${state.mode === 'after' ? ' — PROJECTED LOAD' : ' — NYC GRID'}`,
    items: [
      { color: '#ff8c00', label: 'POWER PLANT', value: `${plants.length} sites` },
      { color: '#5b9bd5', label: 'SUBSTATION',  value: `${SUBSTATIONS.length} nearby` },
      { color: '#ff5a1f', label: 'SITE DEMAND', value: state.mode === 'after' ? `${peakMW.toFixed(2)} MW peak` : '—' },
      { color: '#d4a857', label: 'FEEDER LINE', value: `→ ${nearest.name}` },
    ],
    note: floorNote + (state.mode === 'after' ? `\nEUI: ${eui} kWh/m²/yr → ${(annualKwh/1000).toFixed(0)} MWh/yr` : ''),
  });
}

export function clear() {
  [`${P}-plants`, `${P}-subs`, `${P}-feeder`, `${P}-site`, `${P}-labels`].forEach(removeLayer);
  removeSource(`${P}-src`);
  hideLegend();
}
