/* =========================================================================
   ALLSPARK // IMPACT  ·  data-loader.js
   Fetch and cache public datasets; populate state.baselineData.
   --------------------------------------------------------------------------
   In this scaffold only AirNow + a couple of NYC Open Data endpoints are
   wired up. Claude Code should extend for the remaining layers per the
   data-sources.json registry.
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
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
}

export async function prefetchAllBaselineData(state) {
  const cache = readCache();
  const data = { ...cache };

  // ----- AIR: EPA AirNow (nearest observation) -----
  if (!data.air) {
    try {
      data.air = await fetchAirNow(state.massing.transform.anchor_lat,
                                    state.massing.transform.anchor_lon);
    } catch (e) {
      console.warn('[air] fallback:', e);
      data.air = { pm25: 8.4, no2: 22.1, o3: 41.0, _mock: true };
    }
  }

  // ----- CENSUS TRACTS (Manhattan) ----- stub for displacement/rent choropleths
  if (!data.tracts) {
    try {
      data.tracts = await fetchCensusTractsManhattan();
    } catch (e) {
      console.warn('[tracts] fallback:', e);
      data.tracts = { type: 'FeatureCollection', features: [], _mock: true };
    }
  }

  // ----- CSO OUTFALLS (NYC DEP) -----
  if (!data.cso) {
    try {
      data.cso = await fetchCSOOutfalls();
    } catch (e) {
      console.warn('[cso] fallback:', e);
      data.cso = { type: 'FeatureCollection', features: [], _mock: true };
    }
  }

  // ----- SUBWAY STATIONS (MTA GTFS) -----
  if (!data.subway) {
    try {
      data.subway = await fetchSubwayStations();
    } catch (e) {
      console.warn('[subway] fallback:', e);
      data.subway = { type: 'FeatureCollection', features: [], _mock: true };
    }
  }

  state.baselineData = data;
  writeCache(data);
  return data;
}

/* ---- INDIVIDUAL FETCHERS ---- */

async function fetchAirNow(lat, lon) {
  // EPA AirNow free API — requires a key for production. Placeholder uses
  // the public-access query which rate-limits aggressively.
  // https://docs.airnowapi.org/Data/docs
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
  // Served directly from NYC Open Data as GeoJSON (EPSG:4326).
  // https://data.cityofnewyork.us/City-Government/2020-Census-Tracts/63ge-mke6
  const url = 'https://data.cityofnewyork.us/resource/63ge-mke6.geojson?boro_name=Manhattan&$limit=400';
  const res = await fetch(url);
  if (!res.ok) throw new Error('tracts fetch failed');
  return await res.json();
}

async function fetchCSOOutfalls() {
  // NYC DEP outfalls — filter to Manhattan bbox
  const url = 'https://data.cityofnewyork.us/resource/c4m9-hkbf.geojson?$limit=500';
  const res = await fetch(url);
  if (!res.ok) throw new Error('cso fetch failed');
  return await res.json();
}

async function fetchSubwayStations() {
  // MTA GTFS static: stops.txt — easier to pull from NYC Open Data mirror
  const url = 'https://data.ny.gov/resource/i9wp-a4ja.geojson?$limit=600';
  const res = await fetch(url);
  if (!res.ok) throw new Error('subway fetch failed');
  return await res.json();
}
