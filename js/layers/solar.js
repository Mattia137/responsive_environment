/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/solar.js
   Solar access analysis — shadow polygon + irradiance ring.
   BEFORE: no shadow (site is empty); irradiance ring only.
   AFTER:  shadow polygon from massing cast on adjacent areas.
   Uses: global SunCalc, global turf.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-solar';

/* ── Shadow polygon from building footprint bbox ── */
function computeShadowPolygon(siteLat, siteLon, height_m, footprint_m2, date) {
  if (typeof SunCalc === 'undefined') return null;

  const pos = SunCalc.getPosition(date, siteLat, siteLon);
  const altitude = pos.altitude;  // radians above horizon

  /* Below horizon or very low → no valid shadow (limit to 500 m) */
  if (altitude < 0.017) return null;  // < ~1°

  const shadowLen_m  = Math.min(height_m / Math.tan(altitude), 500);
  /* Shadow falls opposite the sun direction */
  const shadowDir    = (pos.azimuth + Math.PI) % (2 * Math.PI);

  /* Building bbox half-side in degrees */
  const halfSide_m   = Math.sqrt(footprint_m2) / 2;
  const halfSideDeg  = halfSide_m / 111111;
  const halfSideLon  = halfSideDeg / Math.cos(siteLat * Math.PI / 180);

  /* Four corners of the footprint (bottom of shadow) */
  const corners = [
    [siteLon - halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat + halfSideDeg],
    [siteLon - halfSideLon, siteLat + halfSideDeg],
  ];

  /* Offset in shadow direction */
  const dx_deg = (shadowLen_m / 111111) * Math.sin(shadowDir) / Math.cos(siteLat * Math.PI / 180);
  const dy_deg = (shadowLen_m / 111111) * Math.cos(shadowDir);

  /* Shadow polygon: footprint corners + shifted footprint corners */
  const shifted = corners.map(([x, y]) => [x + dx_deg, y + dy_deg]);

  const ring = [
    ...corners,
    ...shifted.reverse(),
    corners[0],  // close ring
  ];

  return {
    type: 'Feature',
    properties: { shadowLen_m: Math.round(shadowLen_m), altitude_deg: (altitude * 180 / Math.PI).toFixed(1) },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

/* ── Irradiance ring (approx shortwave potential by latitude) ── */
function buildIrradianceRings(siteLat, siteLon) {
  /* Rough annual GHI estimate: peaks ~2000 kWh/m²·yr at equator, ~1000 at 50° */
  const latFactor = Math.max(0.3, Math.cos(siteLat * Math.PI / 180));
  const ghi       = Math.round(1950 * latFactor);
  const rings = [
    { r: 100, opacity: 0.25, ghi },
    { r: 250, opacity: 0.15, ghi: Math.round(ghi * 0.9) },
    { r: 500, opacity: 0.08, ghi: Math.round(ghi * 0.8) },
  ];
  return rings.map(rb => ({
    type: 'Feature',
    properties: { ghi: rb.ghi, opacity: rb.opacity },
    geometry: turf.circle([siteLon, siteLat], rb.r / 1000, { units: 'kilometers', steps: 48 }).geometry,
  }));
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const t        = state.massing?.transform || {};
  const siteLat  = t.anchor_lat ?? 40.7539;
  const siteLon  = t.anchor_lon ?? -74.0063;
  const geo      = state.massing?.geometry || {};
  const height   = geo.height_m       ?? 30;
  const footprint = geo.footprint_m2  ?? 1000;
  const loaded   = state.massing?.loaded ?? false;

  /* ── Irradiance rings (always shown) ── */
  const ringFeatures = buildIrradianceRings(siteLat, siteLon);
  const ringSrcId    = `${P}-irr-src`;
  ensureSource(ringSrcId, { type: 'FeatureCollection', features: ringFeatures });

  ensureLayer({
    id:     `${P}-irr-fill`,
    type:   'fill',
    source: ringSrcId,
    paint: {
      'fill-color':   '#ffdd00',
      'fill-opacity': ['get', 'opacity'],
    },
  });
  ensureLayer({
    id:     `${P}-irr-line`,
    type:   'line',
    source: ringSrcId,
    paint: {
      'line-color':     '#ffcc00',
      'line-width':     1,
      'line-dasharray': [5, 4],
      'line-opacity':   0.55,
    },
  });

  /* ── Shadow polygon (after mode + massing loaded) ── */
  const shadowSrcId = `${P}-shadow-src`;

  if (state.timeStep > 0 && loaded) {
    const now    = new Date();
    const shadow = computeShadowPolygon(siteLat, siteLon, height, footprint, now);

    const shadowFeatures = shadow ? [shadow] : [];
    ensureSource(shadowSrcId, { type: 'FeatureCollection', features: shadowFeatures });

    ensureLayer({
      id:     `${P}-shadow-fill`,
      type:   'fill',
      source: shadowSrcId,
      paint: {
        'fill-color':   'rgba(0,0,0,0)',
        'fill-opacity': 1,
        /* MapLibre doesn't support rgba in fill-color via expression cleanly,
           so set the opacity directly */
      },
    });
    /* Re-add as correct dark overlay */
    removeLayer(`${P}-shadow-fill`);
    ensureLayer({
      id:     `${P}-shadow-fill`,
      type:   'fill',
      source: shadowSrcId,
      paint: {
        'fill-color':   '#000000',
        'fill-opacity': 0.45,
      },
    });
    ensureLayer({
      id:     `${P}-shadow-line`,
      type:   'line',
      source: shadowSrcId,
      paint: {
        'line-color':     '#333366',
        'line-width':     1.5,
        'line-opacity':   0.70,
      },
    });

    /* Legend shadow note */
    const altStr = shadow?.properties?.altitude_deg ?? '—';
    const lenStr = shadow?.properties?.shadowLen_m  ?? '—';
    showLegend({
      title: 'SOLAR ACCESS — SHADOW CAST',
      gradient: {
        stops: [
          { color: '#ffdd00', at: 0 },
          { color: '#ff8800', at: 0.5 },
          { color: '#000000', at: 1 },
        ],
        min: 'HIGH', max: 'SHADOW', unit: 'irradiance / shadow',
      },
      items: [
        { color: '#ffdd00', label: 'SOLAR POTENTIAL',   value: `${Math.round(1950 * Math.max(0.3, Math.cos(siteLat * Math.PI / 180)))} kWh/m²·yr` },
        { color: '#000000', label: 'SHADOW FOOTPRINT',  value: lenStr !== '—' ? `${lenStr} m` : 'below horizon' },
      ],
      note: `Sun altitude: ${altStr}° · Shadow length: ${lenStr} m (current time)`,
    });
  } else {
    /* Before mode: remove shadow layers */
    removeLayer(`${P}-shadow-fill`);
    removeLayer(`${P}-shadow-line`);
    removeSource(shadowSrcId);

    const latFactor = Math.max(0.3, Math.cos(siteLat * Math.PI / 180));
    const ghi       = Math.round(1950 * latFactor);
    showLegend({
      title: 'SOLAR ACCESS — BASELINE',
      gradient: {
        stops: [
          { color: '#ffdd00', at: 0 },
          { color: '#ff8800', at: 0.5 },
          { color: '#cc4400', at: 1 },
        ],
        min: 'LOW', max: 'HIGH', unit: 'irradiance potential',
      },
      items: [
        { color: '#ffdd00', label: 'SITE POTENTIAL',    value: `~${ghi} kWh/m²·yr` },
        { color: '#888888', label: 'NO MASSING',        value: 'shadow: none' },
      ],
      note: `Lat ${siteLat.toFixed(2)}° · no obstruction in before mode`,
    });
  }
}

export function clear() {
  [
    `${P}-irr-fill`, `${P}-irr-line`,
    `${P}-shadow-fill`, `${P}-shadow-line`,
  ].forEach(removeLayer);
  [`${P}-irr-src`, `${P}-shadow-src`].forEach(removeSource);
  hideLegend();
}
