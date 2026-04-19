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
      case 'flow':       addFlowLayer(layerId, srcId);       break;
      case 'points':     addPointsLayer(layerId, srcId);     break;
      case 'choropleth': addChoroplethLayer(layerId, srcId); break;
      case 'rings':      addRingsLayer(layerId, srcId);      break;
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
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 30, 1],
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

function addFlowLayer(layerId, srcId) {
  ensureLayer({
    id: `allspark-${layerId}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color': cssVar('--accent'),
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 18, 3],
      'line-dasharray': [3, 2],
      'line-opacity': 0.85,
    },
  });
}

function addPointsLayer(layerId, srcId) {
  ensureLayer({
    id: `allspark-${layerId}-pts`,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 5],
      'circle-color':        cssVar('--accent'),
      'circle-stroke-color': cssVar('--ink'),
      'circle-stroke-width': 0.5,
      'circle-opacity':      0.85,
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
      'fill-opacity': 0.5,
      'fill-outline-color': cssVar('--line-bright'),
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
      'fill-opacity': ['interpolate', ['linear'], ['get','value'], 0, 0.05, 0.2, 0.22],
    },
  });
  ensureLayer({
    id: `allspark-${layerId}-ringline`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color': cssVar('--accent'),
      'line-dasharray': [2, 3],
      'line-width': 0.8,
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
