/* =========================================================================
   ALLSPARK // IMPACT  ·  js/map.js
   MapTiler GL JS initialization + theme-aware style swap
   ========================================================================= */

import { CONFIG } from '../config.js';

let map = null;
let _onReadyCallbacks = [];
let _ready = false;
const _styleLoadCallbacks = [];

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
    navigationControl: false,
    geolocateControl: false,
    attributionControl: false,
    logoControl: false,
    maptilerLogo: false,
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

/* Register a callback fired after every style reload (used by massing.js to re-attach three.js layer) */
export function onStyleLoad(cb) { _styleLoadCallbacks.push(cb); }

export function setTheme(theme) {
  if (!map) return;
  const styleUrl = getMapStyle(theme);
  const dataLayers = _snapshotDataLayers();
  map.setStyle(styleUrl);
  map.once('styledata', () => {
    _applyThemeBaseStyling();
    _restoreDataLayers(dataLayers);
    _styleLoadCallbacks.forEach(cb => cb());
  });
}

function _applyThemeBaseStyling() {
  const mapStyle = map.getStyle();
  if (!mapStyle || !mapStyle.layers) return;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const landColor   = isLight ? '#f0ede4' : '#080808';
  const waterColor  = isLight ? '#d8d4cc' : '#000000';
  const streetColor = isLight ? '#e0dbd0' : '#111111';
  const buildColor  = isLight ? '#c8c2b2' : '#1a1a1a'; // clear contrast in both themes

  mapStyle.layers.forEach(l => {
    // Kill all symbol/label layers
    if (l.type === 'symbol') {
      try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (e) {}
      return;
    }

    const id = l.id;
    const type = l.type;

    if (type === 'background') {
      try { map.setPaintProperty(id, 'background-color', landColor); } catch (e) {}
      return;
    }

    if (type === 'fill') {
      const color = id.includes('water') ? waterColor
                  : id.includes('building') ? buildColor
                  : landColor;
      try { map.setPaintProperty(id, 'fill-color', color); } catch (e) {}
      try { map.setPaintProperty(id, 'fill-outline-color', isLight ? '#d0c8b8' : '#1a1a1a'); } catch (e) {}
      return;
    }

    if (type === 'fill-extrusion') {
      try {
        map.setPaintProperty(id, 'fill-extrusion-color', buildColor);
        map.setPaintProperty(id, 'fill-extrusion-opacity', 0.85);
      } catch (e) {}
      return;
    }

    if (type === 'line') {
      const color = id.includes('water') ? waterColor : streetColor;
      try { map.setPaintProperty(id, 'line-color', color); } catch (e) {}
      return;
    }
  });

  // Ensure 3D buildings exist — add fallback if the base style lacks extrusions
  const has3D = mapStyle.layers.some(l => l.type === 'fill-extrusion');
  if (!has3D) {
    try {
      map.addLayer({
        id: 'buildings-3d-allspark',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color':   buildColor,
          'fill-extrusion-height':  ['coalesce', ['get', 'render_height'], 10],
          'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      });
    } catch (e) {}
  }
}

function wireCameraReadouts() {
  const update = () => {
    const zoomEl    = document.getElementById('zoom-readout');
    const pitchEl   = document.getElementById('pitch-readout');
    const bearingEl = document.getElementById('bearing-readout');
    if (zoomEl)    zoomEl.textContent    = map.getZoom().toFixed(1);
    if (pitchEl)   pitchEl.textContent   = map.getPitch().toFixed(0) + '°';
    if (bearingEl) bearingEl.textContent = map.getBearing().toFixed(0) + '°';
  };
  map.on('move', update);
  update();
}

/* --- Snapshot only serialisable GeoJSON data layers (skip custom/three.js layers) --- */
function _snapshotDataLayers() {
  if (!map) return [];
  const out = [];
  const style = map.getStyle();
  style.layers.forEach(l => {
    if (!l.id.startsWith('allspark-')) return;
    if (l.type === 'custom') return; // handled by onStyleLoad callbacks
    const src = style.sources[l.source];
    if (src) out.push({ layer: l, sourceId: l.source, source: src });
  });
  return out;
}

function _restoreDataLayers(snapshot) {
  snapshot.forEach(({ layer, sourceId, source }) => {
    try {
      if (!map.getSource(sourceId)) map.addSource(sourceId, source);
      if (!map.getLayer(layer.id))  map.addLayer(layer);
    } catch (e) {}
  });
}

/* --- Helper: add/update a GeoJSON source --- */
export function ensureSource(id, geojson) {
  if (!map) return;
  if (map.getSource(id)) {
    map.getSource(id).setData(geojson);
  } else {
    map.addSource(id, { type: 'geojson', data: geojson });
  }
}

/* Always replace a layer so paint properties update on theme/mode change */
export function ensureLayer(spec) {
  if (!map) return;
  try {
    if (map.getLayer(spec.id)) map.removeLayer(spec.id);
    map.addLayer(spec);
  } catch (e) {}
}

export function removeLayer(id) {
  if (map && map.getLayer(id)) try { map.removeLayer(id); } catch (e) {}
}
export function removeSource(id) {
  if (map && map.getSource(id)) try { map.removeSource(id); } catch (e) {}
}
