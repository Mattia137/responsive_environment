/* =========================================================================
   ALLSPARK // IMPACT  ·  js/geometry.js
   Pure functions for impact geometry: euclidean rings, walking isochrones,
   and drawn polygons. Also manages interactive draw mode on the map.
   Isochrone via Valhalla public endpoint (no key required).
   ========================================================================= */

import { getMap } from './map.js';

/* ---------------------------------------------------------------- rings -- */

/** Approximate circle as a closed GeoJSON Polygon (WGS84). */
export function makeRing(lng, lat, radius_m, steps = 64) {
  const R    = 6371000; // Earth radius in metres
  const dLat = (radius_m / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);

  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return {
    type: 'Feature',
    properties: { mode: 'euclidean' },
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

/* ---------------------------------------------------------- isochrones -- */

const _isoCache = new Map();

/**
 * Fetch a walking-time isochrone from the public Valhalla instance.
 * Returns a GeoJSON Feature or null on failure. Results are session-cached.
 *
 * API: https://valhalla1.openstreetmap.de (OSM-hosted, free, no key)
 */
export async function fetchIsochrone(lng, lat, minutes = 15) {
  const key = `${lng.toFixed(5)},${lat.toFixed(5)},${minutes}`;
  if (_isoCache.has(key)) return _isoCache.get(key);

  try {
    const res = await fetch('https://valhalla1.openstreetmap.de/isochrone', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        locations: [{ lon: lng, lat }],
        costing:   'pedestrian',
        contours:  [{ time: minutes }],
        polygons:  true,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data    = await res.json();
    const feature = data.features?.[0] ?? null;
    if (feature) {
      feature.properties = { ...(feature.properties ?? {}), mode: 'isochrone', minutes };
      _isoCache.set(key, feature);
    }
    return feature;
  } catch (e) {
    console.warn('[geometry] isochrone fetch failed:', e.message);
    return null;
  }
}

/* ---------------------------------------------------------- drawn poly -- */

/** Wrap an array of [lng, lat] vertices into a closed GeoJSON Polygon Feature. */
export function makeDrawnPolygon(vertices) {
  if (!vertices || vertices.length < 3) return null;
  const coords = [...vertices];
  const first = coords[0], last = coords.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
  return {
    type: 'Feature',
    properties: { mode: 'drawn' },
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

/* ---------------------------------------------------------- draw mode  -- */

let _drawActive      = false;
let _drawVertices    = [];
let _onComplete      = null;
let _onCancel        = null;
let _clickHandler    = null;
let _dblClickHandler = null;
let _escHandler      = null;

export function startDrawMode(onComplete, onCancel) {
  const map = getMap();
  if (!map) return;
  if (_drawActive) stopDrawMode();

  _drawActive   = true;
  _drawVertices = [];
  _onComplete   = onComplete;
  _onCancel     = onCancel ?? null;

  map.getCanvas().style.cursor = 'crosshair';

  _clickHandler = (e) => {
    _drawVertices.push([e.lngLat.lng, e.lngLat.lat]);
    _updateDrawPreview(map);
  };

  _dblClickHandler = (e) => {
    e.originalEvent.preventDefault();
    // click fires before dblclick — remove the duplicate last vertex
    if (_drawVertices.length > 3) _drawVertices.pop();
    if (_drawVertices.length >= 3) {
      const poly = makeDrawnPolygon(_drawVertices);
      const cb   = _onComplete;
      stopDrawMode();
      if (cb) cb(poly);
    }
  };

  _escHandler = (e) => {
    if (e.key === 'Escape') {
      const cb = _onCancel;
      stopDrawMode();
      if (cb) cb();
    }
  };

  map.on('click',    _clickHandler);
  map.on('dblclick', _dblClickHandler);
  document.addEventListener('keydown', _escHandler, { capture: true });
}

export function stopDrawMode() {
  const map = getMap();
  if (!map) return;

  _drawActive = false;
  _onComplete = null;
  _onCancel   = null;

  map.getCanvas().style.cursor = '';

  if (_clickHandler)    { map.off('click',    _clickHandler);    _clickHandler    = null; }
  if (_dblClickHandler) { map.off('dblclick', _dblClickHandler); _dblClickHandler = null; }
  if (_escHandler)      { document.removeEventListener('keydown', _escHandler, { capture: true }); _escHandler = null; }

  _clearDrawPreview(map);
  _drawVertices = [];
}

function _updateDrawPreview(map) {
  const pts = _drawVertices;
  if (!pts.length) return;

  const features = [
    ...pts.map(([lng, lat]) => ({
      type: 'Feature', properties: { kind: 'pt' },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })),
    ...(pts.length >= 2 ? [{
      type: 'Feature', properties: { kind: 'line' },
      geometry: { type: 'LineString', coordinates: pts },
    }] : []),
  ];

  const srcId = 'allspark-draw-preview-src';
  if (map.getSource(srcId)) {
    map.getSource(srcId).setData({ type: 'FeatureCollection', features });
    return;
  }
  map.addSource(srcId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: 'allspark-draw-preview-line', type: 'line', source: srcId,
    filter: ['==', ['get', 'kind'], 'line'],
    paint: { 'line-color': '#ff5a1f', 'line-width': 1.5, 'line-dasharray': [4, 2] },
  });
  map.addLayer({
    id: 'allspark-draw-preview-pts', type: 'circle', source: srcId,
    filter: ['==', ['get', 'kind'], 'pt'],
    paint: { 'circle-radius': 4, 'circle-color': '#ff5a1f', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
  });
}

function _clearDrawPreview(map) {
  ['allspark-draw-preview-line', 'allspark-draw-preview-pts'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) {}
  });
  try { if (map.getSource('allspark-draw-preview-src')) map.removeSource('allspark-draw-preview-src'); } catch (e) {}
}

/* ----------------------------------------------------- GeoJSON helpers -- */

/** Wrap a Feature (or null) into a FeatureCollection for MapLibre sources. */
export function asFeatureCollection(feature) {
  return { type: 'FeatureCollection', features: feature ? [feature] : [] };
}
