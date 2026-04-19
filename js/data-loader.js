/* =========================================================================
   ALLSPARK // IMPACT  ·  js/data-loader.js
   Fetch and cache public datasets; populate state.baselineData.
   ========================================================================= */

import { CONFIG } from '../config.js';

const CACHE_KEY = 'allspark-cache-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;  // 6h

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return {};
    return data || {};
  } catch { return {}; }
}
function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {
    console.warn('[cache] localStorage full, skipping write');
  }
}

export async function prefetchAllBaselineData(state) {
  const cache = readCache();
  const data = { ...cache };
  const lat = state.massing?.transform?.anchor_lat ?? CONFIG.DEFAULT_CENTER[1];
  const lon = state.massing?.transform?.anchor_lon ?? CONFIG.DEFAULT_CENTER[0];

  // ----- AIR: EPA AirNow (nearest observation) -----
  if (!data.air) {
    try {
      data.air = await fetchAirNow(lat, lon);
    } catch (e) {
      console.warn('[air] fallback:', e.message || e);
      data.air = { pm25: 8.4, no2: 22.1, o3: 41.0, _mock: true };
    }
  }

  // ----- CENSUS TRACTS (Manhattan) -----
  if (!data.tracts) {
    try {
      data.tracts = await fetchCensusTractsManhattan();
    } catch (e) {
      console.warn('[tracts] fallback:', e.message || e);
      data.tracts = { type: 'FeatureCollection', features: [], _mock: true };
    }
  }

  // ----- CSO OUTFALLS (NYC DEP) -----
  if (!data.cso) {
    try {
      data.cso = await fetchCSOOutfalls();
    } catch (e) {
      console.warn('[cso] fallback:', e.message || e);
      data.cso = { type: 'FeatureCollection', features: [], _mock: true };
    }
  }

  // ----- SUBWAY STATIONS (MTA GTFS) -----
  if (!data.subway) {
    try {
      data.subway = await fetchSubwayStations();
    } catch (e) {
      console.warn('[subway] fallback:', e.message || e);
      data.subway = { type: 'FeatureCollection', features: [], _mock: true };
    }
  }

  state.baselineData = data;
  writeCache(data);
  return data;
}

/* ---- INDIVIDUAL FETCHERS ---- */

async function fetchAirNow(lat, lon) {
  if (!CONFIG.AIRNOW_KEY) {
    throw new Error('AIRNOW_KEY not set — using fallback');
  }
  const url = `https://www.airnowapi.org/aq/observation/latLong/current/` +
    `?format=application/json&latitude=${lat}&longitude=${lon}` +
    `&distance=25&API_KEY=${CONFIG.AIRNOW_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  const pm25 = json.find(x => x.ParameterName === 'PM2.5')?.AQI ?? 8.4;
  const o3   = json.find(x => x.ParameterName === 'OZONE')?.AQI ?? 41.0;
  return { pm25, no2: 22.1, o3, _source: 'EPA AirNow' };
}

async function fetchCensusTractsManhattan() {
  const url = 'https://data.cityofnewyork.us/resource/63ge-mke6.geojson?boro_name=Manhattan&$limit=400';
  const res = await fetch(url);
  if (!res.ok) throw new Error('tracts fetch failed');
  return await res.json();
}

async function fetchCSOOutfalls() {
  const url = 'https://data.cityofnewyork.us/resource/c4m9-hkbf.geojson?$limit=500';
  const res = await fetch(url);
  if (!res.ok) throw new Error('cso fetch failed');
  return await res.json();
}

async function fetchSubwayStations() {
  const url = 'https://data.ny.gov/resource/i9wp-a4ja.geojson?$limit=600';
  const res = await fetch(url);
  if (!res.ok) throw new Error('subway fetch failed');
  return await res.json();
}
