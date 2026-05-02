/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/shadow.js
   Shadow impact on adjacent properties — multi-time shadow contours.
   BEFORE: no shadows (site is empty).
   AFTER:  shadow polygon outlines at 09:00, 12:00, 15:00 local time.
   Uses: global SunCalc.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-shadow';

/* Times and styling for each shadow pass */
const SHADOW_PASSES = [
  { hour: 9,  label: '09:00', fillColor: 'rgba(120,120,255,0.25)', lineColor: '#7878ff', dashArray: [6, 4] },
  { hour: 12, label: '12:00', fillColor: 'rgba(255,120,0,0.25)',   lineColor: '#ff7800', dashArray: [4, 4] },
  { hour: 15, label: '15:00', fillColor: 'rgba(255,255,0,0.25)',   lineColor: '#ffff00', dashArray: [3, 4] },
];

/* Approximate local solar noon date for a given hour and longitude */
function localDate(hour, siteLon) {
  const now       = new Date();
  const utcOffset = siteLon / 15;   // rough UTC offset from longitude (hours)
  const utcHour   = hour - utcOffset;
  const d         = new Date(now);
  d.setUTCHours(Math.round(utcHour), 0, 0, 0);
  return d;
}

/* Compute a shadow polygon for a given time */
function computeShadowPolygon(siteLat, siteLon, height_m, halfSideDeg, halfSideLon, hour) {
  if (typeof SunCalc === 'undefined') return null;

  const date = localDate(hour, siteLon);
  const pos  = SunCalc.getPosition(date, siteLat, siteLon);
  const altitude = pos.altitude;  // radians

  /* Sun below horizon → no shadow */
  if (altitude < 0.017) return null;  // < ~1°

  const shadowLen_m = Math.min(height_m / Math.tan(altitude), 500);
  /* Shadow direction = opposite of sun azimuth */
  const shadowDir   = (pos.azimuth + Math.PI) % (2 * Math.PI);

  const dx_deg = (shadowLen_m / 111111) * Math.sin(shadowDir) / Math.cos(siteLat * Math.PI / 180);
  const dy_deg = (shadowLen_m / 111111) * Math.cos(shadowDir);

  /* Footprint corners */
  const corners = [
    [siteLon - halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat + halfSideDeg],
    [siteLon - halfSideLon, siteLat + halfSideDeg],
  ];

  /* Shifted corners (tip of shadow) */
  const shifted = corners.map(([x, y]) => [x + dx_deg, y + dy_deg]);

  /* Convex hull of both rows gives the full shadow polygon */
  const ring = [
    ...corners,
    ...shifted.reverse(),
    corners[0],
  ];

  return {
    type: 'Feature',
    properties: {
      hour,
      shadowLen_m: Math.round(shadowLen_m),
      altitude_deg: (altitude * 180 / Math.PI).toFixed(1),
      azimuth_deg:  (pos.azimuth * 180 / Math.PI).toFixed(1),
    },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const t        = state.massing?.transform || {};
  const siteLat  = t.anchor_lat ?? 40.7539;
  const siteLon  = t.anchor_lon ?? -74.0063;
  const geo      = state.massing?.geometry || {};
  const height   = geo.height_m      ?? 30;
  const footprint = geo.footprint_m2 ?? 1000;
  const loaded   = state.massing?.loaded ?? false;

  /* ── BEFORE mode: clear all shadow layers ── */
  if (state.timeStep === 0) {
    SHADOW_PASSES.forEach(({ label }) => {
      const slug = label.replace(':', '');
      removeLayer(`${P}-fill-${slug}`);
      removeLayer(`${P}-line-${slug}`);
      removeSource(`${P}-src-${slug}`);
    });
    showLegend({
      title: 'SHADOW IMPACT — BEFORE (VACANT)',
      items: [{ color: '#444444', label: 'NO MASSING', value: 'no shadow' }],
      note:  'Site is empty — no shadow cast on adjacent properties.',
    });
    return;
  }

  /* ── AFTER mode: compute shadows for each time ── */
  const halfSide_m   = Math.sqrt(footprint) / 2;
  const halfSideDeg  = halfSide_m / 111111;
  const halfSideLon  = halfSideDeg / Math.cos(siteLat * Math.PI / 180);

  const legendItems = [];

  SHADOW_PASSES.forEach(({ hour, label, fillColor, lineColor, dashArray }) => {
    const slug = label.replace(':', '');
    const srcId = `${P}-src-${slug}`;

    if (!loaded) {
      /* No massing yet — clear this pass */
      removeLayer(`${P}-fill-${slug}`);
      removeLayer(`${P}-line-${slug}`);
      removeSource(srcId);
      return;
    }

    const shadow = computeShadowPolygon(siteLat, siteLon, height, halfSideDeg, halfSideLon, hour);
    const features = shadow ? [shadow] : [];

    ensureSource(srcId, { type: 'FeatureCollection', features });

    /* Filled polygon (semi-transparent) */
    ensureLayer({
      id:     `${P}-fill-${slug}`,
      type:   'fill',
      source: srcId,
      paint: {
        'fill-color':   lineColor,
        'fill-opacity': 0.18,
      },
    });

    /* Dashed outline */
    ensureLayer({
      id:     `${P}-line-${slug}`,
      type:   'line',
      source: srcId,
      paint: {
        'line-color':     lineColor,
        'line-width':     1.5,
        'line-dasharray': dashArray,
        'line-opacity':   0.80,
      },
    });

    if (shadow) {
      legendItems.push({
        color: lineColor,
        label: `${label}`,
        value: `${shadow.properties.shadowLen_m} m`,
      });
    } else {
      legendItems.push({ color: '#444444', label, value: 'below horizon' });
    }
  });

  /* ── Legend ── */
  showLegend({
    title: `SHADOW IMPACT — ADJACENT PROPERTIES (${height} m)`,
    items: legendItems,
    note:  `Shadow length = height / tan(altitude) · capped at 500 m · SunCalc`,
  });
}

export function clear() {
  SHADOW_PASSES.forEach(({ label }) => {
    const slug = label.replace(':', '');
    removeLayer(`${P}-fill-${slug}`);
    removeLayer(`${P}-line-${slug}`);
    removeSource(`${P}-src-${slug}`);
  });
  hideLegend();
}
