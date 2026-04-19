/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/transit.js
   Transit pressure — MTA subway lines with official line colors + station
   dots sized by ridership, before/after delta.
   ========================================================================= */

import { getMap, ensureSource, ensureLayer, removeLayer, removeSource } from '../map.js';
import { showLegend, hideLegend } from '../ui/legend.js';
import { mtaLineColor } from '../data-loader.js';

const P = 'allspark-transit';

/* Approximate subway line segments near Hudson Yards / West Midtown
   (from MTA system map geometry, 2024) */
const HY_SUBWAY_LINES = [
  {
    id: '7-flushing',
    name: '7 FLUSHING LINE',
    symbol: '7',
    color: '#B933AD',
    coords: [[-74.0019,40.7556],[-73.9856,40.7503],[-73.9791,40.7499],[-73.9726,40.7519],[-73.9614,40.7551],[-73.9519,40.7584],[-73.9413,40.7634],[-73.9302,40.7529],[-73.9188,40.7490]],
  },
  {
    id: 'ace',
    name: 'A · C · E',
    symbol: 'A',
    color: '#0039A6',
    coords: [[-73.9916,40.7505],[-73.9916,40.7448],[-73.9916,40.7387],[-73.9916,40.7260]],
  },
  {
    id: '123',
    name: '1 · 2 · 3',
    symbol: '1',
    color: '#EE352E',
    coords: [[-73.9895,40.7575],[-73.9895,40.7505],[-73.9895,40.7440],[-73.9895,40.7373]],
  },
  {
    id: 'ce-local',
    name: 'C · E LOCAL',
    symbol: 'C',
    color: '#0039A6',
    coords: [[-74.0001,40.7448],[-74.0001,40.7380]],
  },
  {
    id: 'lirr',
    name: 'LIRR / NJT (PENN)',
    symbol: 'L',
    color: '#A7A9AC',
    coords: [[-73.9940,40.7508],[-73.9925,40.7507],[-73.9900,40.7505]],
  },
];

/* Hudson Yards area stations with 2023 ridership */
const HY_STATIONS = [
  { name: '34 ST–HUDSON YARDS (7)',  lngLat: [-74.0019, 40.7556], daily: 15200,  symbol: '7',   color: '#B933AD' },
  { name: '34 ST–PENN (A·C·E)',      lngLat: [-73.9916, 40.7505], daily: 52000,  symbol: 'A',   color: '#0039A6' },
  { name: '34 ST–PENN (1·2·3)',      lngLat: [-73.9895, 40.7505], daily: 35000,  symbol: '1',   color: '#EE352E' },
  { name: '28 ST (1)',               lngLat: [-74.0021, 40.7483], daily:  8400,  symbol: '1',   color: '#EE352E' },
  { name: '23 ST (C·E)',             lngLat: [-74.0001, 40.7448], daily: 13800,  symbol: 'C',   color: '#0039A6' },
  { name: '23 ST (1)',               lngLat: [-73.9894, 40.7448], daily: 10200,  symbol: '1',   color: '#EE352E' },
];

export function render(state) {
  const map = getMap();
  if (!map) return;

  const result       = state.impactResults?.transit;
  const dailyDelta   = result?.headline
    ? parseInt(result.headline.value?.replace(/[^0-9]/g, '') || '0')
    : 0;
  const isAfter      = state.mode === 'after';

  /* --- Subway line GeoJSON --- */
  const lineFeatures = HY_SUBWAY_LINES.map(line => ({
    type: 'Feature',
    properties: { lineId: line.id, symbol: line.symbol, color: line.color, name: line.name },
    geometry: { type: 'LineString', coordinates: line.coords },
  }));

  /* Try to supplement with real data from NYC Open Data */
  const realLines = state.baselineData?.subwayLines;
  if (realLines?.features?.length) {
    // Filter to lines within ~5 km of site
    const sLat = state.massing?.transform?.anchor_lat ?? 40.7539;
    const sLon = state.massing?.transform?.anchor_lon ?? -74.0063;
    const nearby = realLines.features.filter(f => {
      const coords = f.geometry?.coordinates;
      if (!coords?.length) return false;
      const midPt = coords[Math.floor(coords.length / 2)];
      const d = Math.sqrt((midPt[0] - sLon) ** 2 + (midPt[1] - sLat) ** 2);
      return d < 0.08;
    });
    if (nearby.length > 5) {
      lineFeatures.splice(0, lineFeatures.length, ...nearby);
    }
  }

  const lineSrcId = `${P}-lines-src`;
  ensureSource(lineSrcId, { type: 'FeatureCollection', features: lineFeatures });

  /* Subway lines — drawn with each line's official color */
  ensureLayer({
    id: `${P}-lines`,
    type: 'line',
    source: lineSrcId,
    paint: {
      'line-color':   ['coalesce', ['get', 'color'], '#A7A9AC'],
      'line-width':   isAfter
        ? ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6]
        : ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 4],
      'line-opacity': isAfter ? 0.90 : 0.65,
    },
  });

  /* Line name labels */
  ensureLayer({
    id: `${P}-line-labels`,
    type: 'symbol',
    source: lineSrcId,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing':   280,
      'text-field':       ['get', 'name'],
      'text-font':        ['Open Sans Semibold', 'Arial Unicode MS Bold'],
      'text-size':        10,
      'text-keep-upright': true,
    },
    paint: {
      'text-color':      ['coalesce', ['get', 'color'], '#A7A9AC'],
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
      'text-opacity':    ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, 1],
    },
  });

  /* Station circles — sized by daily ridership */
  const stationFeatures = HY_STATIONS.map(s => {
    const deltaAtSta = s.name.includes('34 ST–HUDSON YARDS')
      ? dailyDelta * 0.65
      : dailyDelta * (s.daily / 120000);
    return {
      type: 'Feature',
      properties: {
        name: s.name, daily: s.daily, symbol: s.symbol, color: s.color,
        projected: isAfter ? s.daily + Math.round(deltaAtSta) : s.daily,
        delta: Math.round(deltaAtSta),
        label: `${s.name}\n${(isAfter ? s.daily + Math.round(deltaAtSta) : s.daily).toLocaleString()}/day`,
      },
      geometry: { type: 'Point', coordinates: s.lngLat },
    };
  });
  const staSrcId = `${P}-sta-src`;
  ensureSource(staSrcId, { type: 'FeatureCollection', features: stationFeatures });

  ensureLayer({
    id: `${P}-sta-bg`,
    type: 'circle',
    source: staSrcId,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 14],
      'circle-color':  ['get', 'color'],
      'circle-opacity': 0.3,
    },
  });

  ensureLayer({
    id: `${P}-sta`,
    type: 'circle',
    source: staSrcId,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'],
        ['get', isAfter ? 'projected' : 'daily'],
        5000, ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
        55000, ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 18],
      ],
      'circle-color':        ['get', 'color'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      'circle-opacity':      0.9,
    },
  });

  ensureLayer({
    id: `${P}-sta-labels`,
    type: 'symbol',
    source: staSrcId,
    layout: {
      'text-field':     ['get', 'label'],
      'text-font':      ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size':      9,
      'text-offset':    [0, 1.8],
      'text-anchor':    'top',
    },
    paint: {
      'text-color':      '#f0eee6',
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
      'text-opacity':    ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
    },
  });

  const lines = [...new Map(HY_STATIONS.map(s => [s.symbol, s])).values()];
  showLegend({
    title: `TRANSIT PRESSURE${isAfter ? ' — PROJECTED DELTA' : ' — BASELINE'}`,
    items: lines.map(l => ({
      color: l.color,
      label: `LINE ${l.symbol}`,
      value: isAfter ? `+${Math.round(dailyDelta * l.daily / 120000)}/day` : `${l.daily.toLocaleString()}/day`,
    })),
    note: isAfter
      ? `+${dailyDelta.toLocaleString()} total daily entries · circle size = ridership load`
      : 'Station circle size proportional to 2023 daily entries',
  });
}

export function clear() {
  [`${P}-lines`, `${P}-line-labels`, `${P}-sta-bg`, `${P}-sta`, `${P}-sta-labels`].forEach(removeLayer);
  [`${P}-lines-src`, `${P}-sta-src`].forEach(removeSource);
  hideLegend();
}
