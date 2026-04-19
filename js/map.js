/* =========================================================================
   ALLSPARK // IMPACT  ·  js/map.js
   MapTiler GL JS initialization + theme-aware style swap
   ========================================================================= */

import { CONFIG } from '../config.js';

let map = null;
let _onReadyCallbacks = [];
let _ready = false;

const getMapStyle = (theme) => {
  const key = CONFIG.MAPTILER_KEY;
  return theme === 'light' 
    ? `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${key}`
    : `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`;
};

export function initMap(state) {
  maptilersdk.config.apiKey = CONFIG.MAPTILER_KEY;

  map = new maptilersdk.Map({
    container: 'map',
    style: getMapStyle(state.theme || 'dark'),
    center: CONFIG.DEFAULT_CENTER,
    zoom:   CONFIG.DEFAULT_ZOOM,
    pitch:  CONFIG.DEFAULT_PITCH,
    bearing: CONFIG.DEFAULT_BEARING,
    antialias: true,
    hash: true,
  });

  map.on('load', () => {
    _applyThemeBaseStyling();
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
  const styleUrl = getMapStyle(theme);
  const customLayers = _snapshotCustomLayers();
  map.setStyle(styleUrl);
  map.once('styledata', () => {
    _applyThemeBaseStyling();
    _restoreCustomLayers(customLayers);
  });
}

function _applyThemeBaseStyling() {
  const mapStyle = map.getStyle();
  if (!mapStyle || !mapStyle.layers) return;
  
  // 1. Strip all text/labels
  mapStyle.layers.forEach(l => {
    if (l.type === 'symbol') {
      try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (e) {}
    }
  });

  // 2. Add 3D Extruded Buildings (if not present) with theme-aware colors
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  
  const has3D = mapStyle.layers.some(l => l['source-layer'] === 'building' && l.type === 'fill-extrusion');
  if (!has3D) {
    const bColor = isLight ? '#eeeeee' : '#1a1a1a';
    map.addLayer({
      id: 'buildings-3d-fallback',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': bColor,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
        'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    }, mapStyle.layers.find(l => l.type === 'symbol')?.id); // Attempt to insert under symbols if any remained
  }

  // 3. Force Black/White Base Maps
  mapStyle.layers.forEach(l => {
    if (l.type === 'fill' && l.id.includes('water')) {
      try { map.setPaintProperty(l.id, 'fill-color', isLight ? '#e0e0e0' : '#000000'); } catch(e){}
    }
    if (l.type === 'fill' && l.id.includes('background')) {
      try { map.setPaintProperty(l.id, 'fill-color', isLight ? '#ffffff' : '#121212'); } catch(e){}
    }
    if (l.type === 'line' && l.id.includes('road')) {
      try { map.setPaintProperty(l.id, 'line-color', isLight ? '#cccccc' : '#222222'); } catch(e){}
    }
  });
}

function wireCameraReadouts() {
  const update = () => {
    const zoomEl = document.getElementById('zoom-readout');
    const pitchEl = document.getElementById('pitch-readout');
    const bearingEl = document.getElementById('bearing-readout');
    if (zoomEl)    zoomEl.textContent    = map.getZoom().toFixed(1);
    if (pitchEl)   pitchEl.textContent   = map.getPitch().toFixed(0) + '°';
    if (bearingEl) bearingEl.textContent = map.getBearing().toFixed(0) + '°';
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
