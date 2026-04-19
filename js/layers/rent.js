/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/rent.js
   Rent & property value — heatmap draped over 3D buildings.
   BEFORE: baseline rent distribution (flat reference layer).
   AFTER:  anchor-effect uplift gradient around site.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';
import { COEFFICIENTS } from '../impact-model.js';

const P = 'allspark-rent';

/* Build a dense grid of weighted points so the heatmap drapes over buildings */
function buildRentFeatures(siteLat, siteLon, scaleFactor, mode) {
  const features = [];

  // Fine-grained grid covering ~1.2 km around site
  const spread = 0.011; // ~1.2 km
  const n = 28;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const lat = siteLat - spread + (i / n) * spread * 2;
      const lon = siteLon - spread + (j / n) * spread * 2;
      const d   = Math.sqrt((lat - siteLat) ** 2 + (lon - siteLon) ** 2);
      const d_m = d * 111320; // approx metres

      let uplift = 0;
      if (mode === 'after') {
        // Furman Center anchor-effect model
        for (const band of COEFFICIENTS.ANCHOR_RENT_UPLIFT) {
          if (d_m <= band.radius_m) {
            uplift = band.pct * scaleFactor;
            break;
          }
        }
      }

      const baseRent = 4200; // $/month, Hudson Yards median 2024
      const projRent = baseRent * (1 + uplift);

      features.push({
        type: 'Feature',
        properties: {
          value:   uplift,
          baseRent,
          projRent: Math.round(projRent),
          weight:  mode === 'after' ? uplift * 5 + 0.05 : 0.08,
        },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      });
    }
  }
  return features;
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const t          = state.massing?.transform || {};
  const siteLat    = t.anchor_lat ?? 40.7539;
  const siteLon    = t.anchor_lon ?? -74.0063;
  const gfa        = state.massing?.geometry?.total_gfa ?? state.program?.gfa_m2 ?? 13750;
  const scaleFactor = Math.sqrt(gfa / 15000);
  const isAfter    = state.mode === 'after';

  const features = buildRentFeatures(siteLat, siteLon, scaleFactor, state.mode);
  const srcId    = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  /* Heatmap — overlaid on top of 3D buildings */
  ensureLayer({
    id: `${P}-heat`,
    type: 'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 0.18, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 2.5, 18, 4],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 12, 25, 15, 40, 18, 70],
      'heatmap-opacity':   isAfter ? 0.72 : 0.45,
      'heatmap-color': isAfter
        ? [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.15, '#3690c0',   // cool blue — no change
            0.35, '#a8ddb5',   // green — slight uplift
            0.55, '#fed976',   // yellow
            0.75, '#fd8d3c',   // orange
            1.0,  '#cc0000',   // red — max uplift 18%
          ]
        : [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.3, '#3690c0',
            0.7, '#74a9cf',
            1.0, '#0570b0',
          ],
    },
  });

  /* Concentric uplift ring outlines */
  if (isAfter) {
    const ringFeatures = COEFFICIENTS.ANCHOR_RENT_UPLIFT.map(b => ({
      type: 'Feature',
      properties: { pct: b.pct, radius_m: b.radius_m, label: `+${(b.pct * scaleFactor * 100).toFixed(0)}%` },
      geometry: turf.circle([siteLon, siteLat], b.radius_m / 1000, { units: 'kilometers', steps: 64 }).geometry,
    }));
    const ringSrcId = `${P}-rings-src`;
    ensureSource(ringSrcId, { type: 'FeatureCollection', features: ringFeatures });
    ensureLayer({
      id: `${P}-rings`,
      type: 'line',
      source: ringSrcId,
      paint: {
        'line-color':     '#cc0000',
        'line-dasharray': [3, 3],
        'line-width':     1,
        'line-opacity':   0.7,
      },
    });
    /* Ring labels */
    ensureLayer({
      id: `${P}-ring-labels`,
      type: 'symbol',
      source: ringSrcId,
      layout: {
        'text-field':   ['get', 'label'],
        'text-font':    ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size':    9,
        'text-anchor':  'top',
        'symbol-placement': 'line',
        'symbol-spacing': 200,
      },
      paint: {
        'text-color':      '#cc0000',
        'text-halo-color': '#0a0a0a',
        'text-halo-width': 1.5,
        'text-opacity':    ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
      },
    });
  } else {
    [`${P}-rings`, `${P}-ring-labels`].forEach(removeLayer);
    [`${P}-rings-src`].forEach(removeSource);
  }

  const maxUplift = (COEFFICIENTS.ANCHOR_RENT_UPLIFT[0].pct * scaleFactor * 100).toFixed(0);
  showLegend({
    title: `RENT & PROPERTY VALUE${isAfter ? ' — PROJECTED 5YR' : ' — BASELINE'}`,
    gradient: isAfter
      ? {
          stops: [
            { color: '#3690c0', at: 0 },
            { color: '#a8ddb5', at: 0.35 },
            { color: '#fed976', at: 0.6 },
            { color: '#cc0000', at: 1 },
          ],
          min: '0%', max: `+${maxUplift}%`, unit: 'rent uplift',
        }
      : {
          stops: [
            { color: '#74a9cf', at: 0 },
            { color: '#0570b0', at: 1 },
          ],
          min: 'LOW', max: 'HIGH', unit: '$/sqft',
        },
    items: isAfter
      ? COEFFICIENTS.ANCHOR_RENT_UPLIFT.map(b => ({
          color: ['#3690c0','#a8ddb5','#fd8d3c','#cc0000'][COEFFICIENTS.ANCHOR_RENT_UPLIFT.indexOf(b)],
          label: `${b.radius_m}m ring`,
          value: `+${(b.pct * scaleFactor * 100).toFixed(1)}%`,
        }))
      : [],
    note: `Hudson Yards median ~$4,200/mo · Furman Center anchor-effect model`,
  });
}

export function clear() {
  [`${P}-heat`, `${P}-rings`, `${P}-ring-labels`].forEach(removeLayer);
  [`${P}-src`, `${P}-rings-src`].forEach(removeSource);
  hideLegend();
}
