/* =========================================================================
   ALLSPARK // IMPACT  ·  js/data-loader.js
   Fetch and cache public datasets; populate state.baselineData.
   ========================================================================= */

import { CONFIG } from '../config.js';

const CACHE_KEY = 'allspark-cache-v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;  // 6 h

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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); }
  catch (e) { console.warn('[cache] write failed:', e.message); }
}

export async function prefetchAllBaselineData(state) {
  const cache = readCache();
  const data  = { ...cache };
  const lat = CONFIG.DEFAULT_CENTER[1];
  const lon = CONFIG.DEFAULT_CENTER[0];

  const run = async (key, fn, fallback) => {
    if (data[key]) return;
    try { data[key] = await fn(); }
    catch (e) { console.warn(`[${key}] fallback:`, e.message || e); data[key] = { ...fallback, _mock: true }; }
  };

  await Promise.allSettled([
    run('air',        () => fetchAirNow(lat, lon),         { pm25: 8.4, no2: 22.1, o3: 41.0 }),
    run('tracts',     fetchCensusTractsManhattan,           { type:'FeatureCollection', features:[] }),
    run('cso',        fetchCSOOutfalls,                     { type:'FeatureCollection', features:[] }),
    run('subway',     fetchSubwayStations,                  { type:'FeatureCollection', features:[] }),
    run('subwayLines',fetchSubwayLines,                     { type:'FeatureCollection', features:[] }),
    run('amenities',  () => fetchAmenitiesOSM(lat, lon),    { elements:[], _mock:true }),
    run('noise311',   () => fetchNoise311(lat, lon),        []),
    run('powerPlants',fetchPowerPlants,                     []),
  ]);

  state.baselineData = data;
  writeCache(data);
  return data;
}

/* =========================================================================
   INDIVIDUAL FETCHERS
   ========================================================================= */

async function fetchAirNow(lat, lon) {
  if (!CONFIG.AIRNOW_KEY) throw new Error('AIRNOW_KEY not set');
  const url = `https://www.airnowapi.org/aq/observation/latLong/current/` +
    `?format=application/json&latitude=${lat}&longitude=${lon}` +
    `&distance=50&API_KEY=${CONFIG.AIRNOW_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  const pm25 = json.find(x => x.ParameterName === 'PM2.5')?.AQI ?? 8.4;
  const o3   = json.find(x => x.ParameterName === 'OZONE')?.AQI ?? 41.0;
  return { pm25, no2: 22.1, o3, _source: 'EPA AirNow' };
}

async function fetchCensusTractsManhattan() {
  const url = 'https://data.cityofnewyork.us/resource/63ge-mke6.geojson?boro_name=Manhattan&$limit=400';
  const res  = await fetch(url);
  if (!res.ok) throw new Error('tracts fetch failed');
  return res.json();
}

async function fetchCSOOutfalls() {
  const url = 'https://data.cityofnewyork.us/resource/c4m9-hkbf.geojson?$limit=500';
  const res  = await fetch(url);
  if (!res.ok) throw new Error('cso fetch failed');
  return res.json();
}

async function fetchSubwayStations() {
  const url = 'https://data.ny.gov/resource/i9wp-a4ja.geojson?$limit=600';
  const res  = await fetch(url);
  if (!res.ok) throw new Error('subway fetch failed');
  return res.json();
}

/* MTA subway route lines — NYC Open Data */
async function fetchSubwayLines() {
  const url = 'https://data.cityofnewyork.us/resource/3qem-6v3v.geojson?$limit=300';
  const res  = await fetch(url);
  if (!res.ok) throw new Error('subway lines fetch failed');
  const fc = await res.json();
  // Tag each feature with the MTA line color
  if (fc.features) {
    fc.features = fc.features.map(f => ({
      ...f,
      properties: { ...f.properties, lineColor: mtaLineColor(f.properties?.rt_symbol || f.properties?.name || '') },
    }));
  }
  return fc;
}

/* Overpass API — restaurants, shops, services within 1 km */
export async function fetchAmenitiesOSM(lat, lon, radius = 1000) {
  const q = `[out:json][timeout:30];
(
  node["amenity"~"restaurant|cafe|bar|fast_food|bakery|food_court"](around:${radius},${lat},${lon});
  node["shop"~"supermarket|convenience|pharmacy|clothing|beauty|hairdresser|bookshop"](around:${radius},${lat},${lon});
  node["amenity"~"pharmacy|bank|atm|post_office|community_centre|library"](around:${radius},${lat},${lon});
  node["leisure"~"fitness_centre|cinema|theatre|museum|gallery|sports_centre"](around:${radius},${lat},${lon});
  node["tourism"~"hotel|hostel|attraction"](around:${radius},${lat},${lon});
);
out body;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(35000) });
  if (!res.ok) throw new Error('Overpass fetch failed');
  return res.json();  // { elements: [{id,lat,lon,tags},...] }
}

/* NYC 311 noise complaints (no auth required) */
export async function fetchNoise311(lat, lon, radius = 1500) {
  const url = `https://data.cityofnewyork.us/resource/erm2-nwe9.json` +
    `?$where=complaint_type='Noise - Street/Sidewalk' AND within_circle(location,${lat},${lon},${radius})` +
    `&$limit=400&$select=latitude,longitude,descriptor,created_date` +
    `&$order=created_date DESC`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('311 fetch failed');
  const rows = await res.json();
  return rows.filter(r => r.latitude && r.longitude).map(r => ({
    lat: parseFloat(r.latitude), lon: parseFloat(r.longitude),
    desc: r.descriptor, date: r.created_date,
  }));
}

/* NYC power plants (hardcoded from EIA Form 860, 2023) */
async function fetchPowerPlants() {
  return [
    { name: 'RAVENSWOOD',        lngLat: [-73.9444, 40.7581], mw: 2480, fuel: 'gas/oil',   owner: 'NRG' },
    { name: 'ASTORIA ENERGY',    lngLat: [-73.9300, 40.7720], mw: 2316, fuel: 'gas',        owner: 'PSEG' },
    { name: 'EAST RIVER',        lngLat: [-73.9699, 40.7413], mw:  225, fuel: 'gas/steam',  owner: 'ConEd' },
    { name: 'BROOKLYN NAVY YARD',lngLat: [-73.9755, 40.7006], mw:  131, fuel: 'gas/cogen',  owner: 'BNY Cogen' },
    { name: 'GOWANUS',           lngLat: [-74.0018, 40.6873], mw:  630, fuel: 'gas',        owner: 'NRG' },
    { name: 'HUDSON AVENUE',     lngLat: [-73.9758, 40.6944], mw:  564, fuel: 'gas/oil',    owner: 'NRG' },
    { name: 'FLUSHING PIER 9',   lngLat: [-73.8350, 40.7620], mw:  280, fuel: 'gas',        owner: 'ConEd' },
    { name: 'ARTHUR KILL',       lngLat: [-74.1984, 40.5295], mw:  840, fuel: 'oil/gas',    owner: 'NRG' },
  ];
}

/* Map MTA route symbol → official hex color */
function mtaLineColor(sym) {
  const map = {
    '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
    '4': '#00933C', '5': '#00933C', '6': '#00933C',
    '7': '#B933AD',
    'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
    'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
    'G': '#6CBE45',
    'J': '#996633', 'Z': '#996633',
    'L': '#A7A9AC',
    'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
    'S': '#808183',
  };
  for (const key of Object.keys(map)) {
    if (sym.toUpperCase().includes(key)) return map[key];
  }
  return '#AAAAAA';
}
export { mtaLineColor };
