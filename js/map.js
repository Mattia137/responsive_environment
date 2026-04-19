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
  // Using dataviz styles as they are designed for monochrome overlays
  return theme === 'light' 
    ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${key}`
    : `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;
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
    // Aggressively disable all branding and controls
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
  
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  
  // Aggressive looping to strip all color and text
  mapStyle.layers.forEach(l => {
    // 1. Kill labels
    if (l.type === 'symbol' || l.id.includes('label') || l.id.includes('place')) {
      try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (e) {}
    }

    // 2. Force monochrome colors for everything else
    // We target common color properties used in MapLibre/MapTiler styles
    const type = l.type;
    if (type === 'fill' || type === 'fill-extrusion' || type === 'line' || type === 'background') {
      const paintProps = [
        'fill-color', 'fill-extrusion-color', 'line-color', 'background-color',
        'fill-outline-color', 'line-outline-color'
      ];
      
      paintProps.forEach(prop => {
        try {
          if (map.getPaintProperty(l.id, prop)) {
             // Force to grayscale: Water is black/white, Land is gray
             if (l.id.includes('water')) {
               map.setPaintProperty(l.id, prop, isLight ? '#eeeeee' : '#000000');
             } else if (l.id.includes('building')) {
               map.setPaintProperty(l.id, prop, isLight ? '#f5f5f5' : '#1a1a1a');
             } else {
               map.setPaintProperty(l.id, prop, isLight ? '#ffffff' : '#0a0a0a');
             }
          }
        } catch(e){}
      });
    }
  });

  // 3. Ensure 3D Buildngs are present and desaturated
  const has3D = mapStyle.layers.some(l => l['source-layer'] === 'building' && l.type === 'fill-extrusion');
  if (!has3D) {
    const bColor = isLight ? '#f0f0f0' : '#141414';
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
    });
  }
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
