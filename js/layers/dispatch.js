/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/dispatch.js
   Converts impact-model spatial output to MapLibre sources + layers.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { LAYERS } from './registry.js';

export function renderActiveLayers(state) {
  // 1. Clear layers that are not currently active
  LAYERS.forEach(L => {
    if (!state.activeLayerIds.has(L.id)) {
      removeLayerFamily(L.id);
    }
  });
  // 2. For each active layer, grab its spatial output from impactResults
  state.activeLayerIds.forEach(layerId => {
    const result = state.impactResults[layerId];
    if (!result || !result.spatial) return;
    const { type, features } = result.spatial;
    const srcId = `allspark-${layerId}-src`;
    const geojson = { type: 'FeatureCollection', features: features || [] };

    ensureSource(srcId, geojson);

    switch (type) {
      case 'heatmap':    addHeatmapLayer(layerId, srcId);    break;
      case 'flow':       addFlowLayer(layerId, srcId, layerId === 'water');       break;
      case 'points':     addPointsLayer(layerId, srcId);     break;
      case 'choropleth': addChoroplethLayer(layerId, srcId); break;
      case 'rings':      addRingsLayer(layerId, srcId);      break;
      case 'symbol':     addSymbolLayer(layerId, srcId);     break;
    }
  });
}

/* --- theme-aware color accessor --- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------- LAYER RECIPES ---------- */

function addHeatmapLayer(layerId, srcId) {
  ensureLayer({
    id: `allspark-${layerId}-heat`,
    type: 'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['coalesce', ['get', 'weight'], 1], 0, 0, 30, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 3],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 13, 20, 18, 80],
      'heatmap-opacity':   0.7,
      'heatmap-color':     [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,0,0)',
        0.3, cssVar('--neutral'),
        0.7, cssVar('--accent'),
        1,   cssVar('--negative'),
      ],
    },
  });
}

function addFlowLayer(layerId, srcId, isWater = false) {
  ensureLayer({
    id: `allspark-${layerId}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     isWater ? '#5b9bd5' : cssVar('--accent'),
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 4],
      'line-dasharray': [3, 2],
      'line-opacity':   0.85,
    },
  });
}

function addPointsLayer(layerId, srcId) {
  ensureLayer({
    id: `allspark-${layerId}-pts`,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 7],
      'circle-color':        cssVar('--accent'),
      'circle-stroke-color': cssVar('--ink'),
      'circle-stroke-width': 1,
      'circle-opacity':      0.85,
    },
  });
}

function addSymbolLayer(layerId, srcId) {
  // Dot first
  addPointsLayer(layerId, srcId);

  // Then Labels
  ensureLayer({
    id: `allspark-${layerId}-labels`,
    type: 'symbol',
    source: srcId,
    layout: {
      'text-field':      ['coalesce', ['get', 'label'], ['get', 'name'], ''],
      'text-font':       ['Fragment Mono Regular'],
      'text-size':       10,
      'text-offset':     [0, 1.2],
      'text-anchor':     'top',
      'text-transform':  'uppercase',
      'text-letter-spacing': 0.1,
    },
    paint: {
      'text-color':      cssVar('--t1'),
      'text-halo-color': cssVar('--bg'),
      'text-halo-width': 1.5,
      'text-opacity':    ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
    },
  });
}

function addChoroplethLayer(layerId, srcId) {
  ensureLayer({
    id: `allspark-${layerId}-fill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'value'], 0],
        0,   'rgba(0,0,0,0)',
        0.5, cssVar('--neutral'),
        1,   cssVar('--negative'),
      ],
      'fill-opacity': 0.6,
      'fill-outline-color': cssVar('--t5'),
    },
  });
}

function addRingsLayer(layerId, srcId) {
  ensureLayer({
    id: `allspark-${layerId}-ringfill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color': cssVar('--accent'),
      'fill-opacity': ['interpolate', ['linear'], ['get','value'], 0, 0.05, 0.2, 0.25],
    },
  });
  ensureLayer({
    id: `allspark-${layerId}-ringline`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color': cssVar('--accent'),
      'line-dasharray': [2, 3],
      'line-width': 1.5,
      'line-opacity': 0.7,
    },
  });
}

/* --- removal helper --- */
function removeLayerFamily(layerId) {
  const prefix = `allspark-${layerId}`;
  const map = getMap();
  if (!map) return;
  const style = map.getStyle();
  if (!style) return;
  style.layers
    .filter(l => l.id.startsWith(prefix))
    .forEach(l => removeLayer(l.id));
  removeSource(`${prefix}-src`);
}
