/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/biodiversity.js
   Biodiversity — GBIF occurrence data (free, global, no key).
   BEFORE: all occurrences around site, coloured by taxonomic class.
   AFTER:  same + occurrences within massing footprint flagged as displaced.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-biodiversity';

/* Colour by taxonomic class */
const CLASS_COLORS = {
  Aves:        '#66ddff',   // birds     — sky blue
  Mammalia:    '#ffcc66',   // mammals   — warm yellow
  Plantae:     '#44ff88',   // plants    — green  (kingdom level)
  Insecta:     '#ff88ff',   // insects   — pink/magenta
  Reptilia:    '#88ff44',   // reptiles  — lime
  Amphibia:    '#44ffcc',   // amphibia  — teal
  Fungi:       '#ffaa44',   // fungi     — orange
  default:     '#ffffff',   // all others — white
};

function classColor(props) {
  const cls = props.class || '';
  const kingdom = props.kingdom || '';
  if (CLASS_COLORS[cls])     return CLASS_COLORS[cls];
  if (kingdom === 'Plantae') return CLASS_COLORS.Plantae;
  return CLASS_COLORS.default;
}

/* Module-level cache keyed by bbox string */
let _gbifCache    = null;
let _gbifCacheKey = '';

/* Build WKT polygon for GBIF bbox query */
function bboxWkt(lat, lon, delta) {
  const w = lon - delta, e = lon + delta;
  const s = lat - delta, n = lat + delta;
  return `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
}

async function fetchGbif(siteLat, siteLon, delta = 0.01) {
  const key = `${siteLat.toFixed(4)}_${siteLon.toFixed(4)}_${delta}`;
  if (_gbifCacheKey === key && _gbifCache !== null) return _gbifCache;

  const wkt = bboxWkt(siteLat, siteLon, delta);
  const url = `https://api.gbif.org/v1/occurrence/search` +
    `?geometry=${encodeURIComponent(wkt)}&limit=300&hasCoordinate=true`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _gbifCache    = data.results || [];
    _gbifCacheKey = key;
    return _gbifCache;
  } catch (e) {
    console.warn('[biodiversity] GBIF fetch failed:', e.message);
    _gbifCache    = [];
    _gbifCacheKey = key;
    return _gbifCache;
  }
}

/* Is a point inside a square footprint bbox? */
function inFootprint(lon, lat, siteLon, siteLat, footprint_m2) {
  const halfSide_m  = Math.sqrt(footprint_m2) / 2;
  const halfSideDeg = halfSide_m / 111111;
  const halfSideLon = halfSideDeg / Math.cos(siteLat * Math.PI / 180);
  return (
    Math.abs(lon - siteLon) <= halfSideLon &&
    Math.abs(lat - siteLat) <= halfSideDeg
  );
}

/* Tally occurrences by class */
function tallyCounts(records) {
  const counts = {};
  records.forEach(r => {
    const key = r.class || r.kingdom || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export async function render(state) {
  const map = getMap();
  if (!map) return;

  const t        = state.massing?.transform || {};
  const siteLat  = t.anchor_lat ?? 40.7539;
  const siteLon  = t.anchor_lon ?? -74.0063;
  const geo      = state.massing?.geometry || {};
  const footprint = geo.footprint_m2 ?? 1000;
  const loaded   = state.massing?.loaded ?? false;

  /* Fetch GBIF occurrences (±0.01° ≈ 1 km box) */
  let records = await fetchGbif(siteLat, siteLon, 0.01);

  /* Supplement from state cache if available */
  if (state.baselineData?.gbif?.results?.length) {
    const existing = new Set(records.map(r => r.key));
    const extra    = state.baselineData.gbif.results.filter(r => !existing.has(r.key));
    records = [...records, ...extra];
  }

  /* Build GeoJSON features */
  const features = records
    .filter(r => r.decimalLongitude != null && r.decimalLatitude != null)
    .map(r => {
      const color = classColor(r);
      const displaced = state.timeStep > 0 && loaded &&
        inFootprint(r.decimalLongitude, r.decimalLatitude, siteLon, siteLat, footprint);

      return {
        type: 'Feature',
        properties: {
          color,
          displaced,
          class:   r.class    || '',
          kingdom: r.kingdom  || '',
          species: r.species  || r.scientificName || 'Unknown',
        },
        geometry: {
          type: 'Point',
          coordinates: [r.decimalLongitude, r.decimalLatitude],
        },
      };
    });

  const srcId = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  /* Normal occurrence circles */
  ensureLayer({
    id:     `${P}-circles`,
    type:   'circle',
    source: srcId,
    filter: ['!=', ['get', 'displaced'], true],
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 6],
      'circle-color':        ['get', 'color'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 0.5,
      'circle-opacity':      0.70,
    },
  });

  /* Displaced occurrences (after mode, within footprint) */
  ensureLayer({
    id:     `${P}-displaced`,
    type:   'circle',
    source: srcId,
    filter: ['==', ['get', 'displaced'], true],
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 8],
      'circle-color':        '#ff2222',
      'circle-stroke-color': '#ffaa00',
      'circle-stroke-width': 1.5,
      'circle-opacity':      0.85,
    },
  });

  /* Tally for legend */
  const counts      = tallyCounts(records.filter(r => r.decimalLongitude != null));
  const displacedN  = features.filter(f => f.properties.displaced).length;

  const legendItems = Object.entries(CLASS_COLORS)
    .filter(([cls]) => cls !== 'default' && counts[cls])
    .map(([cls, color]) => ({ color, label: cls.toUpperCase(), value: `${counts[cls]}` }));

  if (displacedN > 0) {
    legendItems.push({ color: '#ff2222', label: 'DISPLACED', value: `${displacedN}` });
  }

  showLegend({
    title: `BIODIVERSITY — GBIF OCCURRENCES${state.timeStep > 0 ? ' (IMPACT)' : ''}`,
    items: legendItems.length ? legendItems : [{ color: '#ffffff', label: 'NO DATA', value: '0' }],
    note: `${features.length} records · ±1 km bbox · GBIF.org · ${displacedN} potentially displaced`,
  });
}

export function clear() {
  [`${P}-circles`, `${P}-displaced`].forEach(removeLayer);
  [`${P}-src`].forEach(removeSource);
  hideLegend();
}
