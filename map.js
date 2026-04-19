/* =========================================================================
   ALLSPARK // IMPACT  ·  map.js
   MapTiler GL JS initialization + theme-aware style swap
   ========================================================================= */

import { CONFIG } from '../config.js';

let map = null;
let _onReadyCallbacks = [];
let _ready = false;

const MAP_STYLES = {
  dark:  `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${CONFIG.MAPTILER_KEY}`,
  light: `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${CONFIG.MAPTILER_KEY}`,
};

export function initMap(state) {
  // MapTiler SDK exposes the full MapLibre API
  maptilersdk.config.apiKey = CONFIG.MAPTILER_KEY;

  map = new maptilersdk.Map({
    container: 'map',
    style: MAP_STYLES[state.theme || 'dark'],
    center: CONFIG.DEFAULT_CENTER,
    zoom:   CONFIG.DEFAULT_ZOOM,
    pitch:  CONFIG.DEFAULT_PITCH,
    bearing: CONFIG.DEFAULT_BEARING,
    antialias: true,
    hash: true, // persist camera position in URL
  });

  map.on('load', () => {
    add3DBuildings();
    wireCameraReadouts();
    _ready = true;
    _onReadyCallbacks.forEach(cb => cb());
    _onReadyCallbacks = [];
  });

  return map;
}

export function getMap() { return map; }
export function onMapReady(cb) { if (_ready) cb(); else _onReadyCallbacks.push(cb); }

export function setTheme(theme) {
  if (!map) return;
  const styleUrl = MAP_STYLES[theme];
  // Before swapping, capture existing custom layers + sources so we can re-add
  const customLayers = _snapshotCustomLayers();
  map.setStyle(styleUrl);
  map.once('styledata', () => {
    add3DBuildings();
    _restoreCustomLayers(customLayers);
  });
}

/* --- 3D buildings from the MapTiler style (OSM extrusions) --- */
function add3DBuildings() {
  // MapTiler 'streets-v2' styles already include 3D buildings under
  // a layer named 'Building 3D' or similar. If not visible, add fallback:
  const layers = map.getStyle().layers || [];
  const has3D = layers.some(l => l['source-layer'] === 'building' && l.type === 'fill-extrusion');
  if (has3D) return;
  // Fallback: add MapTiler OpenMapTiles extrusion
  map.addLayer({
    id: 'buildings-3d-fallback',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
        0, '#1a1a1a', 50, '#2a2a2a', 200, '#3a3a3a'],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
      'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    },
  });
}

function wireCameraReadouts() {
  const update = () => {
    document.getElementById('zoom-readout').textContent    = map.getZoom().toFixed(1);
    document.getElementById('pitch-readout').textContent   = map.getPitch().toFixed(0) + '°';
    document.getElementById('bearing-readout').textContent = map.getBearing().toFixed(0) + '°';
  };
  map.on('move', update);
  update();
}

/* --- Custom layer snapshot/restore helpers for style swaps --- */
function _snapshotCustomLayers() {
  if (!map) return [];
  const out = [];
  const style = map.getStyle();
  style.layers.forEach(l => {
    // Only snapshot layers we added (prefix 'allspark-')
    if (l.id.startsWith('allspark-')) {
      const src = style.sources[l.source];
      out.push({ layer: l, sourceId: l.source, source: src });
    }
  });
  return out;
}
function _restoreCustomLayers(snapshot) {
  snapshot.forEach(({ layer, sourceId, source }) => {
    if (!map.getSource(sourceId)) map.addSource(sourceId, source);
    if (!map.getLayer(layer.id))  map.addLayer(layer);
  });
}

/* --- Helper: add a GeoJSON source + layer by convention --- */
export function ensureSource(id, geojson) {
  if (!map) return;
  if (map.getSource(id)) {
    map.getSource(id).setData(geojson);
  } else {
    map.addSource(id, { type: 'geojson', data: geojson });
  }
}
export function ensureLayer(spec) {
  if (!map) return;
  if (!map.getLayer(spec.id)) map.addLayer(spec);
}
export function removeLayer(id) {
  if (map && map.getLayer(id)) map.removeLayer(id);
}
export function removeSource(id) {
  if (map && map.getSource(id)) map.removeSource(id);
}
