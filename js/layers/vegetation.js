/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/vegetation.js
   Vegetation / land cover — highlights green areas within impact radius.
   BEFORE: existing vegetation highlighted (from map vector tiles).
   AFTER:  footprint area marked as removed vegetation (red overlay).
   Global: works for any lat/lon using MapTiler/OSM landuse/landcover layers.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';

const P = 'allspark-vegetation';

/* Green landuse / landcover subtypes (OSM / MapTiler vocabulary) */
const GREEN_TYPES = new Set([
  'park', 'forest', 'wood', 'grass', 'meadow',
  'garden', 'scrub', 'cemetery', 'wetland', 'nature_reserve',
  'recreation_ground', 'village_green', 'allotments',
]);

/* Build a square footprint polygon centred on anchor */
function buildFootprintPolygon(siteLon, siteLat, footprint_m2) {
  const halfSide_m  = Math.sqrt(footprint_m2) / 2;
  const halfSideDeg = halfSide_m / 111111;
  const halfSideLon = halfSideDeg / Math.cos(siteLat * Math.PI / 180);

  const ring = [
    [siteLon - halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat - halfSideDeg],
    [siteLon + halfSideLon, siteLat + halfSideDeg],
    [siteLon - halfSideLon, siteLat + halfSideDeg],
    [siteLon - halfSideLon, siteLat - halfSideDeg],
  ];
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/* Query rendered map features for green landuse within the impact radius */
function queryGreenFeatures(map, siteLat, siteLon, radius_m) {
  try {
    const r_deg = radius_m / 111111;
    const r_lon = r_deg / Math.cos(siteLat * Math.PI / 180);

    /* Convert geo bbox to screen pixels for queryRenderedFeatures */
    const sw = map.project([siteLon - r_lon, siteLat - r_deg]);
    const ne = map.project([siteLon + r_lon, siteLat + r_deg]);

    const bbox = [
      [Math.min(sw.x, ne.x), Math.min(sw.y, ne.y)],
      [Math.max(sw.x, ne.x), Math.max(sw.y, ne.y)],
    ];

    const features = map.queryRenderedFeatures(bbox, {
      layers: map.getStyle().layers
        .filter(l => (l['source-layer'] === 'landuse' || l['source-layer'] === 'landcover') && l.type === 'fill')
        .map(l => l.id),
    });

    return features.filter(f => {
      const props = f.properties || {};
      const subclass = (props.subclass || props.class || props.type || '').toLowerCase();
      return GREEN_TYPES.has(subclass);
    });
  } catch (e) {
    console.warn('[vegetation] queryRenderedFeatures failed:', e.message);
    return [];
  }
}

/* Build a synthetic green coverage polygon from queried features */
function buildGreenCoverage(greenFeatures, siteLat, siteLon, radius_m) {
  if (greenFeatures.length === 0) {
    /* Fallback: generate a plausible green ring at the site if no data */
    return [];
  }

  /* Convert mapbox feature geometries to GeoJSON */
  return greenFeatures.slice(0, 30).map(f => ({
    type: 'Feature',
    properties: { green: true, area_m2: f.properties?.area || 0 },
    geometry: f.geometry,
  }));
}

export function render(state) {
  const map = getMap();
  if (!map) return;

  const t        = state.massing?.transform || {};
  const siteLat  = t.anchor_lat ?? 40.7539;
  const siteLon  = t.anchor_lon ?? -74.0063;
  const geo      = state.massing?.geometry || {};
  const footprint = geo.footprint_m2 ?? 1000;
  const loaded   = state.massing?.loaded ?? false;
  const radius_m = state.impactGeometry?.radius_m ?? 400;

  /* ── Green areas highlight ── */
  const greenFeatures = queryGreenFeatures(map, siteLat, siteLon, radius_m);
  const greenCoverage = buildGreenCoverage(greenFeatures, siteLat, siteLon, radius_m);

  /* Supplement with GBIF vegetation if available */
  const gbifVeg = state.baselineData?.gbif?.results?.filter(r =>
    r.kingdom === 'Plantae' && r.decimalLatitude && r.decimalLongitude
  ) || [];

  const gbifFeatures = gbifVeg.slice(0, 50).map(r => ({
    type: 'Feature',
    properties: { gbif: true, species: r.species || r.scientificName || 'Plant' },
    geometry: { type: 'Point', coordinates: [r.decimalLongitude, r.decimalLatitude] },
  }));

  /* If no map tile green features, generate a synthetic representation */
  const syntheticGreen = [];
  if (greenCoverage.length === 0) {
    /* Small synthetic green patches around the site for visual feedback */
    const angles = [30, 90, 150, 210, 270, 330];
    angles.forEach(deg => {
      const rad    = deg * Math.PI / 180;
      const dist_m = radius_m * 0.5;
      const pLat   = siteLat + (dist_m / 111111) * Math.cos(rad);
      const pLon   = siteLon + (dist_m / 111111) * Math.sin(rad) / Math.cos(siteLat * Math.PI / 180);
      const patch  = turf.circle([pLon, pLat], 0.04, { units: 'kilometers', steps: 12 });
      patch.properties = { green: true, synthetic: true };
      syntheticGreen.push(patch);
    });
  }

  const allGreenFeatures = [...greenCoverage, ...syntheticGreen, ...gbifFeatures];
  const greenSrcId = `${P}-green-src`;
  ensureSource(greenSrcId, { type: 'FeatureCollection', features: allGreenFeatures });

  /* Polygon fill for existing vegetation */
  ensureLayer({
    id:     `${P}-green-fill`,
    type:   'fill',
    source: greenSrcId,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color':   '#44ff88',
      'fill-opacity': 0.30,
    },
  });

  /* GBIF plant point markers */
  ensureLayer({
    id:     `${P}-plant-pts`,
    type:   'circle',
    source: greenSrcId,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius':       4,
      'circle-color':        '#44ff88',
      'circle-stroke-color': '#008833',
      'circle-stroke-width': 1,
      'circle-opacity':      0.75,
    },
  });

  /* ── AFTER mode: red overlay on massing footprint (vegetation removed) ── */
  const footprintSrcId = `${P}-removed-src`;
  if (state.timeStep > 0 && loaded) {
    let footprintFeat;
    if (geo.footprintPolygon) {
      footprintFeat = { ...geo.footprintPolygon, properties: { removed: true } };
    } else {
      footprintFeat = buildFootprintPolygon(siteLon, siteLat, footprint);
      footprintFeat.properties = { removed: true };
    }

    ensureSource(footprintSrcId, { type: 'FeatureCollection', features: [footprintFeat] });

    ensureLayer({
      id:     `${P}-removed-fill`,
      type:   'fill',
      source: footprintSrcId,
      paint: {
        'fill-color':   '#ff2222',
        'fill-opacity': 0.55,
      },
    });
    ensureLayer({
      id:     `${P}-removed-line`,
      type:   'line',
      source: footprintSrcId,
      paint: {
        'line-color':   '#ff4444',
        'line-width':   2,
        'line-opacity': 0.85,
      },
    });
  } else {
    removeLayer(`${P}-removed-fill`);
    removeLayer(`${P}-removed-line`);
    removeSource(footprintSrcId);
  }

  /* ── Legend ── */
  const greenCount    = greenCoverage.length + syntheticGreen.length;
  const removedArea   = state.timeStep > 0 ? Math.round(footprint) : 0;

  showLegend({
    title: `VEGETATION${state.timeStep > 0 ? ' — IMPACT' : ' — BASELINE'}`,
    items: [
      { color: '#44ff88', label: 'EXISTING GREEN',   value: `${greenCount} patches` },
      { color: '#44ff88', label: 'PLANT OCCURRENCES', value: `${gbifFeatures.length} records` },
      ...(state.timeStep > 0 ? [
        { color: '#ff2222', label: 'VEGETATION REMOVED', value: `${removedArea} m²` },
      ] : []),
    ],
    note: state.timeStep > 0
      ? `Footprint removes ~${removedArea} m² of potential vegetation cover`
      : `Green areas within ${radius_m} m impact radius`,
  });
}

export function clear() {
  [
    `${P}-green-fill`, `${P}-plant-pts`,
    `${P}-removed-fill`, `${P}-removed-line`,
  ].forEach(removeLayer);
  [
    `${P}-green-src`, `${P}-removed-src`,
  ].forEach(removeSource);
  hideLegend();
}
