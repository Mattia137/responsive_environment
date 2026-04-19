/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/dispatch.js
   Converts impact-model spatial output to MapLibre sources + layers.
   ensureLayer now always removes-then-adds so paint properties update
   on every render (theme / mode changes).
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { LAYERS } from './registry.js';

export function renderActiveLayers(state) {
  // 1. Clear inactive layers
  LAYERS.forEach(L => {
    if (!state.activeLayerIds.has(L.id)) {
      removeLayerFamily(L.id);
    }
  });

  // 2. Render each active layer
  state.activeLayerIds.forEach(layerId => {
    const result = state.impactResults[layerId];
    if (!result || !result.spatial) return;
    const { type, features } = result.spatial;
    const srcId  = `allspark-${layerId}-src`;
    const geojson = { type: 'FeatureCollection', features: features || [] };

    ensureSource(srcId, geojson);

    switch (type) {
      case 'heatmap':    addHeatmapLayer(layerId, srcId, state);       break;
      case 'flow':       addFlowLayer(layerId, srcId, state);          break;
      case 'ped':        addPedLayer(layerId, srcId, state);           break;
      case 'points':     addPointsSymbolLayer(layerId, srcId, state);  break;
      case 'choropleth': addChoroplethLayer(layerId, srcId, state);    break;
      case 'rings':      addRingsLayer(layerId, srcId, state);         break;
    }
  });

  // Update the active-layer tag in the map overlay
  const tag = document.getElementById('active-layer-tag');
  if (tag) {
    tag.textContent = state.activeLayerIds.size
      ? [...state.activeLayerIds].join(' · ')
      : '— NONE —';
  }
}

/* --- theme-aware color accessor --- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* --- per-layer accent colors (mode-aware) --- */
function layerColor(layerId, mode) {
  const afterColors = {
    air:          cssVar('--negative'),
    power:        cssVar('--accent'),
    pedestrian:   cssVar('--neutral'),
    rent:         cssVar('--negative'),
    displacement: cssVar('--negative'),
    induced:      cssVar('--positive'),
    transit:      '#e06c75',
    cost:         cssVar('--neutral'),
    water:        '#5b9bd5',
    waste:        cssVar('--negative'),
  };
  const beforeColors = {
    air:          cssVar('--neutral'),
    power:        cssVar('--neutral'),
    pedestrian:   cssVar('--ink-dim'),
    rent:         cssVar('--neutral'),
    displacement: cssVar('--neutral'),
    induced:      cssVar('--ink-dim'),
    transit:      cssVar('--neutral'),
    cost:         cssVar('--neutral'),
    water:        '#3a7abf',
    waste:        cssVar('--neutral'),
  };
  return mode === 'after'
    ? (afterColors[layerId]  || cssVar('--accent'))
    : (beforeColors[layerId] || cssVar('--neutral'));
}

/* ---------- HEATMAP ---------- */
function addHeatmapLayer(layerId, srcId, state) {
  const col = layerColor(layerId, state.mode);
  ensureLayer({
    id: `allspark-${layerId}-heat`,
    type: 'heatmap',
    source: srcId,
    maxzoom: 22,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['coalesce', ['get', 'weight'], 1], 0, 0, 30, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 3],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 13, 30, 18, 90],
      'heatmap-opacity':   state.mode === 'after' ? 0.75 : 0.35,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,0,0)',
        0.3, cssVar('--neutral') + '88',
        0.7, col + 'cc',
        1,   col,
      ],
    },
  });
}

/* ---------- FLOW LINES ---------- */
function addFlowLayer(layerId, srcId, state) {
  const col = layerColor(layerId, state.mode);
  const isAfter = state.mode === 'after';
  ensureLayer({
    id: `allspark-${layerId}-line`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     col,
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 1.5, 18, 4],
      'line-dasharray': [4, 3],
      'line-opacity':   isAfter ? 0.9 : 0.45,
    },
  });

  // Endpoint dot at destination
  ensureLayer({
    id: `allspark-${layerId}-flow-end`,
    type: 'circle',
    source: srcId,
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius':       6,
      'circle-color':        col,
      'circle-stroke-color': cssVar('--bg'),
      'circle-stroke-width': 1.5,
      'circle-opacity':      isAfter ? 0.9 : 0.5,
    },
  });
}

/* ---------- POINTS + LABELS (transit, pedestrian, induced) ---------- */
function addPointsSymbolLayer(layerId, srcId, state) {
  const col    = layerColor(layerId, state.mode);
  const isAfter = state.mode === 'after';

  // Circle dots
  ensureLayer({
    id: `allspark-${layerId}-pts`,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, 4,
        18, layerId === 'transit' ? 10 : 7,
      ],
      'circle-color':        col,
      'circle-stroke-color': cssVar('--bg'),
      'circle-stroke-width': 1.5,
      'circle-opacity':      isAfter ? 0.9 : 0.6,
    },
  });

  // Text labels — use the feature's label / name / kind property
  ensureLayer({
    id: `allspark-${layerId}-labels`,
    type: 'symbol',
    source: srcId,
    layout: {
      'text-field':     ['coalesce', ['get', 'label'], ['get', 'name'], ['get', 'kind'], ''],
      'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':      10,
      'text-offset':    [0, 1.4],
      'text-anchor':    'top',
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.06,
      'text-max-width': 8,
    },
    paint: {
      'text-color':      cssVar('--ink'),
      'text-halo-color': cssVar('--bg'),
      'text-halo-width': 1.5,
      'text-opacity':    ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
    },
  });
}

/* ---------- PEDESTRIAN — flow lines + labelled origin dots ---------- */
function addPedLayer(layerId, srcId, state) {
  const col     = layerColor(layerId, state.mode);
  const isAfter = state.mode === 'after';

  // Flow lines (LineString features)
  ensureLayer({
    id: `allspark-${layerId}-line`,
    type: 'line',
    source: srcId,
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color':     col,
      'line-width':     ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 3],
      'line-dasharray': [5, 3],
      'line-opacity':   isAfter ? 0.85 : 0.4,
    },
  });

  // Origin dots (Point features)
  ensureLayer({
    id: `allspark-${layerId}-pts`,
    type: 'circle',
    source: srcId,
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 4, 18, 8],
      'circle-color':        col,
      'circle-stroke-color': cssVar('--bg'),
      'circle-stroke-width': 1.5,
      'circle-opacity':      isAfter ? 0.9 : 0.6,
    },
  });

  // Labels on origin dots
  ensureLayer({
    id: `allspark-${layerId}-labels`,
    type: 'symbol',
    source: srcId,
    filter: ['==', '$type', 'Point'],
    layout: {
      'text-field':     ['coalesce', ['get', 'label'], ''],
      'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':      10,
      'text-offset':    [0, 1.3],
      'text-anchor':    'top',
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.06,
    },
    paint: {
      'text-color':      cssVar('--ink'),
      'text-halo-color': cssVar('--bg'),
      'text-halo-width': 1.5,
      'text-opacity':    ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
    },
  });
}

/* ---------- CHOROPLETH ---------- */
function addChoroplethLayer(layerId, srcId, state) {
  const col    = layerColor(layerId, state.mode);
  const isAfter = state.mode === 'after';
  ensureLayer({
    id: `allspark-${layerId}-fill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'value'], 0],
        0, 'rgba(0,0,0,0)',
        0.3, col + '55',
        0.7, col + 'aa',
        1,   col,
      ],
      'fill-opacity':       isAfter ? 0.7 : 0.4,
      'fill-outline-color': col + '44',
    },
  });
}

/* ---------- RINGS ---------- */
function addRingsLayer(layerId, srcId, state) {
  const col    = layerColor(layerId, state.mode);
  const isAfter = state.mode === 'after';
  ensureLayer({
    id: `allspark-${layerId}-ringfill`,
    type: 'fill',
    source: srcId,
    paint: {
      'fill-color':   col,
      'fill-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'value'], 0],
        0, 0.03, 0.2, isAfter ? 0.22 : 0.10],
    },
  });
  ensureLayer({
    id: `allspark-${layerId}-ringline`,
    type: 'line',
    source: srcId,
    paint: {
      'line-color':     col,
      'line-dasharray': [3, 3],
      'line-width':     1.5,
      'line-opacity':   isAfter ? 0.8 : 0.4,
    },
  });

  // Ring value label at centroid — add a symbol layer using a separate point source
  const map = getMap();
  if (map) {
    const style = map.getStyle();
    const srcData = style?.sources[srcId]?.data;
    if (srcData?.features?.length) {
      const labelFeatures = srcData.features.map(f => {
        if (!f.geometry) return null;
        const cent = turf.centroid(f);
        cent.properties = {
          label: f.properties.label || (f.properties.radius_m ? `${f.properties.radius_m}m` : ''),
        };
        return cent;
      }).filter(Boolean);

      const lblSrcId = `allspark-${layerId}-ring-labels-src`;
      ensureSource(lblSrcId, { type: 'FeatureCollection', features: labelFeatures });
      ensureLayer({
        id: `allspark-${layerId}-ring-labels`,
        type: 'symbol',
        source: lblSrcId,
        layout: {
          'text-field':     ['get', 'label'],
          'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size':      9,
          'text-anchor':    'center',
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.06,
        },
        paint: {
          'text-color':      col,
          'text-halo-color': cssVar('--bg'),
          'text-halo-width': 1.5,
          'text-opacity':    isAfter ? 0.9 : 0.5,
        },
      });
    }
  }
}

/* --- remove all layers/sources for a given layer family --- */
function removeLayerFamily(layerId) {
  const prefix = `allspark-${layerId}`;
  const map = getMap();
  if (!map) return;
  const style = map.getStyle();
  if (!style) return;
  style.layers
    .filter(l => l.id.startsWith(prefix))
    .forEach(l => removeLayer(l.id));
  // Remove all associated sources (main + ring-labels)
  [
    `${prefix}-src`,
    `${prefix}-ring-labels-src`,
    `${prefix}-flow-end-src`,
  ].forEach(id => removeSource(id));
}
