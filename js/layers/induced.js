/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/induced.js
   Induced demand — real OSM amenities within 1 km (Overpass API).
   BEFORE: existing restaurants / retail / services / entertainment as dots.
   AFTER:  same + projected new venues (labeled) where supply gaps appear.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';
import { fetchAmenitiesOSM } from '../data-loader.js';

const P = 'allspark-induced';

/* Category definitions */
const CATS = {
  food:          { color: '#ff8c00', label: 'FOOD & DRINK'   },
  retail:        { color: '#5b9bd5', label: 'RETAIL'         },
  services:      { color: '#7fb069', label: 'SERVICES'       },
  entertainment: { color: '#b833ad', label: 'ENTERTAINMENT'  },
  hotel:         { color: '#e06c75', label: 'HOTEL'          },
};

function osm2cat(tags = {}) {
  const a = tags.amenity || '', s = tags.shop || '', l = tags.leisure || '', to = tags.tourism || '';
  if (/restaurant|cafe|bar|fast_food|bakery|food_court/.test(a)) return 'food';
  if (/cinema|theatre|fitness_centre|museum|gallery|sports/.test(l)) return 'entertainment';
  if (/hotel|hostel/.test(to)) return 'hotel';
  if (/pharmacy|bank|atm|post_office|library|community/.test(a)) return 'services';
  if (s) return 'retail';
  return 'services';
}

/* Demand gap analysis: given annual visitors and existing supply, return needed new venues per category */
function computeGaps(visitorsPerYear, existing) {
  const counts = {};
  Object.keys(CATS).forEach(k => { counts[k] = 0; });
  existing.forEach(f => { if (f.properties?.cat) counts[f.properties.cat] = (counts[f.properties.cat] || 0) + 1; });

  // Industry rule-of-thumb: 1 restaurant per ~1800 daily visitors (NYC restaurant density)
  const dailyVisitors = visitorsPerYear / 365;
  const needed = {
    food:          Math.max(0, Math.round(dailyVisitors / 1800) - (counts.food || 0)),
    retail:        Math.max(0, Math.round(dailyVisitors / 3500) - (counts.retail || 0)),
    services:      Math.max(0, Math.round(dailyVisitors / 5000) - (counts.services || 0)),
    entertainment: Math.max(0, Math.round(dailyVisitors / 8000) - (counts.entertainment || 0)),
    hotel:         Math.max(0, Math.round(dailyVisitors / 12000) - (counts.hotel || 0)),
  };
  return { counts, needed };
}

/* Place projected new points near site in vacant gaps */
function generateNeededPoints(siteLat, siteLon, needed) {
  const pts = [];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315].map(d => d * Math.PI / 180);
  let ai = 0;
  Object.entries(needed).forEach(([cat, n]) => {
    for (let i = 0; i < Math.min(n, 6); i++) {
      const d = 0.001 + Math.random() * 0.003;
      const a = angles[(ai++) % angles.length] + (Math.random() - 0.5) * 0.3;
      pts.push({
        type: 'Feature',
        properties: {
          cat,
          label: `+ ${CATS[cat]?.label || cat.toUpperCase()} NEEDED`,
          projected: true,
          color: CATS[cat]?.color || '#aaa',
        },
        geometry: { type: 'Point', coordinates: [siteLon + d * Math.cos(a), siteLat + d * Math.sin(a)] },
      });
    }
  });
  return pts;
}

let _osmCache    = null;
let _osmCacheKey = '';

export async function render(state) {
  const map = getMap();
  if (!map) return;

  const t       = state.massing?.transform || {};
  const siteLat = t.anchor_lat ?? 40.7539;
  const siteLon = t.anchor_lon ?? -74.0063;
  const cacheKey = `${siteLat.toFixed(4)}_${siteLon.toFixed(4)}`;

  /* Fetch real OSM amenities (cached per location) */
  let osmElements = state.baselineData?.amenities?.elements;
  if (!osmElements) {
    if (_osmCacheKey !== cacheKey || !_osmCache) {
      try {
        const raw = await fetchAmenitiesOSM(siteLat, siteLon, 1000);
        _osmCache    = raw.elements || [];
        _osmCacheKey = cacheKey;
        // Save back to baseline so it persists
        if (state.baselineData) { state.baselineData.amenities = raw; }
      } catch (e) {
        console.warn('[induced] OSM fallback:', e.message);
        _osmCache    = [];
        _osmCacheKey = cacheKey;
      }
    }
    osmElements = _osmCache;
  }

  /* Convert OSM elements to GeoJSON features */
  const existingFeatures = (osmElements || [])
    .filter(el => el.lat && el.lon && el.tags)
    .map(el => {
      const cat = osm2cat(el.tags);
      return {
        type: 'Feature',
        properties: {
          cat,
          label: el.tags.name || CATS[cat]?.label || 'AMENITY',
          projected: false,
          color: CATS[cat]?.color || '#aaa',
        },
        geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      };
    });

  const result       = state.impactResults?.induced;
  const annualVis    = (state.program?.gfa_m2 ?? 13750) * 65;
  const { counts, needed } = computeGaps(annualVis, existingFeatures);

  let features = [...existingFeatures];
  if (state.mode === 'after') {
    features = features.concat(generateNeededPoints(siteLat, siteLon, needed));
  }

  const srcId = `${P}-src`;
  ensureSource(srcId, { type: 'FeatureCollection', features });

  /* Existing venue dots — colored by category */
  ensureLayer({
    id: `${P}-existing`,
    type: 'circle',
    source: srcId,
    filter: ['!=', ['get', 'projected'], true],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 6],
      'circle-color': [
        'match', ['get', 'cat'],
        'food',          CATS.food.color,
        'retail',        CATS.retail.color,
        'services',      CATS.services.color,
        'entertainment', CATS.entertainment.color,
        'hotel',         CATS.hotel.color,
        '#aaaaaa',
      ],
      'circle-stroke-color': '#000000',
      'circle-stroke-width': 0.5,
      'circle-opacity': state.mode === 'after' ? 0.7 : 0.9,
    },
  });

  /* Projected new venue dots — pulsing ring effect */
  if (state.mode === 'after') {
    ensureLayer({
      id: `${P}-projected`,
      type: 'circle',
      source: srcId,
      filter: ['==', ['get', 'projected'], true],
      paint: {
        'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 10],
        'circle-color':        ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity':      0.85,
      },
    });
    ensureLayer({
      id: `${P}-proj-labels`,
      type: 'symbol',
      source: srcId,
      filter: ['==', ['get', 'projected'], true],
      layout: {
        'text-field':     ['get', 'label'],
        'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size':      9,
        'text-offset':    [0, 1.5],
        'text-anchor':    'top',
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color':      '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
        'text-opacity':    ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
      },
    });
  } else {
    [`${P}-projected`, `${P}-proj-labels`].forEach(removeLayer);
  }

  const totalExisting = existingFeatures.length;
  const totalNeeded   = Object.values(needed).reduce((s, n) => s + n, 0);
  showLegend({
    title: `INDUCED DEMAND${state.mode === 'after' ? ' — GAPS' : ' — EXISTING SUPPLY'}`,
    items: [
      { color: CATS.food.color,          label: 'FOOD & DRINK',  value: `${counts.food ?? 0} exist${state.mode === 'after' && needed.food ? ` +${needed.food} needed` : ''}` },
      { color: CATS.retail.color,        label: 'RETAIL',        value: `${counts.retail ?? 0} exist${state.mode === 'after' && needed.retail ? ` +${needed.retail} needed` : ''}` },
      { color: CATS.services.color,      label: 'SERVICES',      value: `${counts.services ?? 0} exist` },
      { color: CATS.entertainment.color, label: 'ENTERTAINMENT', value: `${counts.entertainment ?? 0} exist${state.mode === 'after' && needed.entertainment ? ` +${needed.entertainment} needed` : ''}` },
      { color: CATS.hotel.color,         label: 'HOTEL',         value: `${counts.hotel ?? 0} exist` },
    ],
    note: state.mode === 'after'
      ? `${totalExisting} existing within 1 km · ${totalNeeded} new venues projected (white ring = gap)`
      : `${totalExisting} OSM amenities within 1 km radius · source: OpenStreetMap`,
  });
}

export function clear() {
  [`${P}-existing`, `${P}-projected`, `${P}-proj-labels`].forEach(removeLayer);
  removeSource(`${P}-src`);
  hideLegend();
}
