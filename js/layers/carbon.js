/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/carbon.js
   Carbon footprint — embodied + operational carbon visualisation.
   BEFORE: no building → zero carbon overlay.
   AFTER:  filled footprint polygon (red-orange gradient by intensity)
           + influence rings at 100 m / 250 m / 500 m.
   Global: works for any lat/lon.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-carbon';

/* Structural system → embodied carbon intensity (kgCO2e/m³) */
const CARBON_INTENSITY = {
  concrete_heavy: 420,
  steel_frame:    310,
  hybrid:         365,
  mass_timber:    160,
};
const DEFAULT_INTENSITY = 365;

/* Approximate grid carbon intensity by latitude band (kgCO2e/kWh) */
function gridCarbonFactor(lat) {
  const absLat = Math.abs(lat);
  if (absLat < 15) return 0.55;   // tropical — often coal-heavy
  if (absLat < 35) return 0.48;   // sub-tropical
  if (absLat < 50) return 0.38;   // temperate (EU, N America avg)
  return 0.28;                    // high latitude — often hydro/nuclear mix
}

/* Build a square footprint polygon centred on anchor */
function buildFootprintPolygon(siteLon, siteLat, footprint_m2) {
  const halfSide_m   = Math.sqrt(footprint_m2) / 2;
  const halfSideDeg  = halfSide_m / 111111;
  const halfSideLon  = halfSideDeg / Math.cos(siteLat * Math.PI / 180);

  const ring = [
    [siteLon - halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat + halfSideDeg],
    [siteLon - halfSideLon, siteLat + halfSideDeg],
    [siteLon - halfSideLon, siteLat - halfSideDeg],
  ];

  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const t        = state.massing?.transform || {};
  const siteLat  = t.anchor_lat ?? 40.7539;
  const siteLon  = t.anchor_lon ?? -74.0063;
  const geo      = state.massing?.geometry || {};
  const prog     = state.program          || {};
  const loaded   = state.massing?.loaded  ?? false;

  /* ── BEFORE mode: clear everything and bail ── */
  if (state.timeStep === 0) {
    [`${P}-footprint`, `${P}-rings`, `${P}-rings-line`].forEach(removeLayer);
    [`${P}-footprint-src`, `${P}-rings-src`].forEach(removeSource);
    showLegend({
      title: 'CARBON — BEFORE (VACANT SITE)',
      items: [{ color: '#444444', label: 'NO BUILDING', value: '0 tCO₂e' }],
      note:  'No massing → no embodied or operational carbon.',
    });
    return;
  }

  /* ── AFTER mode: compute carbon ── */
  const structSys  = prog.structural_system || 'hybrid';
  const carbonInt  = CARBON_INTENSITY[structSys] ?? DEFAULT_INTENSITY;
  const volume_m3  = geo.volume_m3     ?? ((geo.footprint_m2 ?? 1000) * (geo.height_m ?? 30));
  const footprint  = geo.footprint_m2  ?? 1000;
  const gfa        = prog.gfa_m2       ?? (geo.total_gfa ?? footprint * (geo.num_floors_est ?? 5));
  const renewables = (prog.renewables_pct ?? 0) / 100;

  const embodied_tCO2e     = (volume_m3 * carbonInt) / 1000;
  const EUI_kWh_m2yr       = 180;  // typical office/cultural EUI
  const gridFactor         = gridCarbonFactor(siteLat);
  const operational_tCO2e  = (gfa * EUI_kWh_m2yr * gridFactor * (1 - renewables)) / 1000;
  const construction_tCO2e = (footprint * 50) / 1000;  // 50 kgCO2e/m² construction activity
  const total_tCO2e        = embodied_tCO2e + operational_tCO2e + construction_tCO2e;

  /* Normalised intensity for colour scale (0–1 mapped to 0–1000 tCO2e) */
  const normalised = Math.min(total_tCO2e / 1000, 1);

  /* ── Footprint polygon ── */
  let footprintFeat;
  if (loaded && geo.footprintPolygon) {
    footprintFeat = geo.footprintPolygon;
  } else {
    footprintFeat = buildFootprintPolygon(siteLon, siteLat, footprint);
  }
  footprintFeat = { ...footprintFeat, properties: { ...footprintFeat.properties, intensity: normalised, tCO2e: Math.round(total_tCO2e) } };

  ensureSource(`${P}-footprint-src`, { type: 'FeatureCollection', features: [footprintFeat] });

  /* Red-orange gradient fill by carbon intensity */
  ensureLayer({
    id:     `${P}-footprint`,
    type:   'fill',
    source: `${P}-footprint-src`,
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#ff6600',
        0.5,  '#ff2200',
        1,    '#880000',
      ],
      'fill-opacity': 0.70,
    },
  });

  /* ── Influence rings at 100 m, 250 m, 500 m ── */
  const radii  = [100, 250, 500];
  const opacities = [0.35, 0.20, 0.08];
  const ringFeatures = radii.map((r, i) => ({
    type: 'Feature',
    properties: { radius_m: r, opacity: opacities[i] },
    geometry: turf.circle([siteLon, siteLat], r / 1000, { units: 'kilometers', steps: 48 }).geometry,
  }));

  ensureSource(`${P}-rings-src`, { type: 'FeatureCollection', features: ringFeatures });

  ensureLayer({
    id:     `${P}-rings`,
    type:   'fill',
    source: `${P}-rings-src`,
    paint: {
      'fill-color':   '#ff4400',
      'fill-opacity': ['get', 'opacity'],
    },
  });
  ensureLayer({
    id:     `${P}-rings-line`,
    type:   'line',
    source: `${P}-rings-src`,
    paint: {
      'line-color':     '#ff6600',
      'line-width':     1,
      'line-dasharray': [3, 3],
      'line-opacity':   0.60,
    },
  });

  /* ── Legend ── */
  showLegend({
    title: `CARBON FOOTPRINT — ${structSys.replace('_', ' ').toUpperCase()}`,
    gradient: {
      stops: [
        { color: '#ff6600', at: 0 },
        { color: '#ff2200', at: 0.5 },
        { color: '#880000', at: 1 },
      ],
      min: 'LOW', max: 'HIGH', unit: 'tCO₂e intensity',
    },
    items: [
      { color: '#ff6600', label: 'EMBODIED',     value: `${Math.round(embodied_tCO2e)} tCO₂e` },
      { color: '#ff2200', label: 'OPERATIONAL',  value: `${Math.round(operational_tCO2e)} tCO₂e/yr` },
      { color: '#884400', label: 'CONSTRUCTION', value: `${Math.round(construction_tCO2e)} tCO₂e` },
    ],
    note: `Total: ${Math.round(total_tCO2e)} tCO₂e · ${carbonInt} kgCO₂e/m³ · ${Math.round((1 - renewables) * 100)}% grid`,
  });
}

export function clear() {
  [`${P}-footprint`, `${P}-rings`, `${P}-rings-line`].forEach(removeLayer);
  [`${P}-footprint-src`, `${P}-rings-src`].forEach(removeSource);
  hideLegend();
}
