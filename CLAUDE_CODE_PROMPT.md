# ALLSPARK // IMPACT — Build Spec for Claude Code

You are building a web-based urban impact projection tool. The user is an architecture student at GSAPP designing a media museum at Hudson Yards, NYC. The tool must be **generalized** so it works with any massing geometry + building program pair, not just this one project. Its job is to visualize **the existing urban situation from public data**, then overlay **a projected impact scenario** derived from the geometry and program of an uploaded massing model, so the user can see the delta.

Treat this document as the contract. Read it top-to-bottom before writing code. The scaffold files (`index.html`, `data-sources.json`, `impact-model.js`) are starting points — extend, don't rewrite.

---

## 0. MENTAL MODEL — what this tool is

It is **not** a GIS viewer. It is **not** a 3D model viewer. It is an **impact projection instrument**:

```
  INPUT                                          OUTPUT
  ─────                                          ──────
  ① GLB massing model (any geometry)             → rendered in 3D on the map
  ② anchor (lat, lon, rotation, scale)           → geometry is geo-located
  ③ program spec (type, GFA, operating hrs)      → impact deltas per layer
  ④ selected impact layers                       → rendered spatially over the map
  ⑤ BEFORE / AFTER toggle                        → visual diff of the city state
```

The user's mental model while using the tool:
1. Load MapTiler 3D basemap of the site and surroundings.
2. Upload a GLB. Position it (anchor + rotation + vertical offset). Set its program.
3. See a dashboard of 10 impact categories with numeric deltas.
4. Toggle any layer on — public-data baseline points/heatmaps appear on the map.
5. Flip BEFORE / AFTER — the same layer re-renders with the projected delta applied.

---

## 1. CORE REQUIREMENTS (non-negotiable)

1. **MapTiler GL JS** (v3+) for the 3D basemap. API key goes in a `config.js` file (user provides). Style: MapTiler's `streets-v2-dark` and `streets-v2-light` for the two themes.
2. **Fragment Mono** from Google Fonts for all UI text. No exceptions — no fallback to system mono in the visible UI. Fine to use a serif display face as secondary (Instrument Serif or similar), but the primary voice is Fragment Mono.
3. **Light + Dark theme toggle**. Theme is driven by CSS variables on `<html data-theme="...">`. Persist to `localStorage`. All colors, map styles, data overlay colors flip together.
4. **Geometry input**: accept `.glb` file upload via drag-drop or file picker. Render using `maplibre-gl`'s `CustomLayer` + `three.js` (MapTiler GL JS is a MapLibre fork — use the standard [three.js custom layer pattern](https://docs.maptiler.com/maplibre-gl-js/examples/add-3d-model-to-globe-using-threejs/)).
5. **Geolocation of the mesh**: expose sliders/inputs for `anchor_lat`, `anchor_lon`, `rotation_deg`, `vertical_offset_m`, `uniform_scale`. The tool must correctly convert between mesh-local meters and Mercator coords using `maplibregl.MercatorCoordinate.fromLngLat()` + `meterInMercatorCoordinateUnits()`. See §4.
6. **Impact model**: parametric — takes `{footprint_m2, height_m, gfa_m2, volume_m3, program_type, operating_hours, admission_price, visitors_per_year_estimate}` and produces per-layer deltas (see §5). No hardcoded project-specific constants.
7. **Data overlays**: the 10 impact layers each render as one or more of: `points` (dots with size/color encoding), `heatmap` (continuous surface), `choropleth` (tract/block polygons colored by value), `vector lines` (flows), `radial rings` (falloff). Pick the one that best communicates the metric. §6 specifies per layer.
8. **Coordinate fidelity**: every data point placed on the map must have correct lat/lon. No invented positions. If a dataset only provides BBL or census tract, you must join to a geometry lookup before rendering. §4 covers this.
9. **BEFORE / AFTER**: a single top-bar toggle. When AFTER is active, (a) the massing model is visible, (b) all active layers re-render with the projected delta. No layer should visually disappear — the change is in values, not presence.
10. **No page reload** on any interaction. Single-page app, all state in JS.

---

## 2. FILE LAYOUT

```
/
├── index.html            ← single-page app shell (scaffold provided, extend)
├── config.js             ← API keys + site defaults (create, gitignore)
├── css/
│   ├── base.css          ← resets, typography, theme variables
│   ├── layout.css        ← grid, panels, header, footer
│   └── components.css    ← layer pills, readouts, sliders, toggle
├── js/
│   ├── main.js           ← bootstraps map, wires events, owns state
│   ├── map.js            ← MapTiler init, theme-aware style swap
│   ├── massing.js        ← GLB loader, three.js custom layer, geo-anchoring
│   ├── impact-model.js   ← parametric engine (scaffold provided, extend)
│   ├── data-loader.js    ← fetchers for each public dataset
│   ├── layers/
│   │   ├── air.js            ← air quality layer
│   │   ├── power.js          ← power supply layer
│   │   ├── pedestrian.js     ← foot traffic layer
│   │   ├── rent.js           ← rent + property value layer
│   │   ├── displacement.js   ← displacement risk layer
│   │   ├── induced.js        ← induced demand layer
│   │   ├── transit.js        ← transit pressure layer
│   │   ├── cost.js           ← project cost + logistics layer
│   │   ├── water.js          ← water + stormwater layer
│   │   └── waste.js          ← waste + noise layer
│   └── ui/
│       ├── theme.js          ← dark/light theme controller
│       ├── panel-layers.js   ← left panel
│       ├── panel-readouts.js ← right panel
│       └── panel-massing.js  ← massing controls
├── data-sources.json     ← registry of public datasets (scaffold provided)
└── data/
    ├── census-tracts-manhattan.geojson    ← fetch at build time
    ├── building-footprints-hy.geojson     ← fetch at build time
    └── zoning-manhattan.geojson           ← fetch at build time
```

Use vanilla ES modules. No build tool required. No React, no Vue. The whole thing must run from a static file server.

---

## 3. API KEYS + CONFIG

The user will provide a MapTiler API key. Create `config.js`:

```js
export const CONFIG = {
  MAPTILER_KEY: "PROVIDED_BY_USER",
  DEFAULT_CENTER: [-74.0027, 40.7536],  // [lng, lat] — Hudson Yards
  DEFAULT_ZOOM: 15.8,
  DEFAULT_PITCH: 55,
  DEFAULT_BEARING: -18,
  IMPACT_RADIUS_M: 400,   // ring radius for most layers
  STUDY_RADIUS_M: 1200,   // outer data-fetch radius
};
```

For any other API that requires a key (OpenWeather, Yelp, etc.), add it to CONFIG with a clear comment on where to obtain it, and **make its layer optional** — the tool must work end-to-end with just the MapTiler key plus the open NYC/EPA/MTA endpoints that require no auth.

---

## 4. COORDINATE SYSTEMS — GET THIS RIGHT OR NOTHING WORKS

Three coordinate systems matter:

| System | EPSG | Used by | Notes |
|---|---|---|---|
| WGS84 geographic | 4326 | MapTiler, GeoJSON, most APIs | lat/lon in degrees |
| Web Mercator | 3857 | MapTiler internal tiles, heatmap rendering | auto-handled |
| NY State Plane Long Island (ft) | 2263 | Most NYC Open Data shapefiles | needs reprojection |

**Rules:**
1. All layer data in memory is WGS84 GeoJSON (lat/lon). If a dataset arrives in 2263, reproject on load using `proj4js`. Register the projection once in `data-loader.js`:
   ```js
   proj4.defs("EPSG:2263",
     "+proj=lcc +lat_1=41.03333333333333 +lat_2=40.66666666666666 " +
     "+lat_0=40.16666666666666 +lon_0=-74 +x_0=300000.0000000001 +y_0=0 " +
     "+ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs");
   ```
2. **Massing geolocation**: the GLB has its origin at `(0,0,0)` in mesh-local meters. To place it on the map:
   ```js
   const anchor = maplibregl.MercatorCoordinate.fromLngLat(
     [anchor_lon, anchor_lat],
     vertical_offset_m
   );
   const scale = anchor.meterInMercatorCoordinateUnits();
   const transform = {
     translateX: anchor.x,
     translateY: anchor.y,
     translateZ: anchor.z,
     rotateX: Math.PI / 2,           // three.js Y-up → map Z-up
     rotateY: rotation_deg * Math.PI / 180,
     rotateZ: 0,
     scale: scale * uniform_scale,
   };
   ```
   Apply this as the three.js camera matrix multiplicand inside the custom layer's `render` hook. Do NOT scale the mesh itself — scale the projection. This keeps the mesh dimensions in true meters.
3. **Joining tabular data to geometry**: census-tract–level data (rent, displacement, ACS demographics) arrives as `{tract_geoid, value}`. Load the tract polygons GeoJSON once, then on render, build a lookup `tractId → polygon` and emit `FeatureCollection<Polygon>` with `properties.value` set. Render as a choropleth fill layer.
4. **BBL-level data** (MapPLUTO, DOF sales): join to building footprints by BBL. MapPLUTO is authoritative for the polygon; most other NYC datasets carry BBL as a foreign key.

---

## 5. THE IMPACT MODEL — parametric, not hardcoded

The model must generalize to any massing. It's a pure function:

```
project_impact(
  geometry:  { footprint_m2, height_m, volume_m3, num_floors_est },
  program:   { type, gfa_m2, operating_hours, visitors_per_year, staff_count, admission_price_usd },
  context:   { site_lat_lon, baseline_data_by_layer }
)
→ { air: {...}, power: {...}, ped: {...}, ...10 layers }
```

Each layer output is:
```
{
  headline: { label, value, unit, delta_pct_or_abs, sign: "pos"|"neg"|"neu" },
  metrics:  [ { label, baseline, projected, delta, sign } ],
  spatial:  { type: "points"|"heatmap"|"choropleth"|"flow"|"rings",
              features: [ GeoJSON features with properties.value ] }
}
```

### 5.1 Benchmark coefficients (the source of truth for projections)

Store these in `impact-model.js` as a constant. They are drawn from published studies + comparable projects; document each with a source URL in a JSDoc comment above the table.

```js
export const COEFFICIENTS = {
  // Energy Use Intensity by program (kWh/m²/yr), from NYC LL84 benchmarking 2022
  EUI_BY_PROGRAM: {
    museum_art:      350,   // Cultural institution Museum
    museum_science:  420,
    office:          240,
    residential:     155,
    hotel:           390,
    retail:          430,
    education:       280,
    lab:             780,
  },
  // Water use (L/m²/yr)
  WATER_BY_PROGRAM: { museum_art: 480, office: 320, residential: 1200, hotel: 1450, retail: 380 },
  // Embodied CO₂e by construction system (kgCO₂e/m² GFA) — from EC3 Building Transparency median
  EMBODIED_BY_SYSTEM: { concrete_heavy: 580, steel_frame: 410, hybrid: 490, mass_timber: 210 },
  // Visitors/m² GFA/yr — for museums, from comparables: The Shed, Whitney, MoMA PS1
  VISITOR_DENSITY_BY_MUSEUM_TYPE: { art_contemporary: 6.8, media_digital: 7.2, natural_history: 11.0 },
  // Anchor effect rent uplift, % at 5 yr, by radius band — Furman Center meta-analysis
  ANCHOR_RENT_UPLIFT: [
    { radius_m:  100, pct: 0.18 },
    { radius_m:  250, pct: 0.12 },
    { radius_m:  400, pct: 0.06 },
    { radius_m:  800, pct: 0.02 },
  ],
  // Construction metrics per 1000 m² GFA
  CONSTRUCTION: {
    truck_trips_per_1000m2: 125,       // haul + delivery, typical NYC
    duration_months_per_1000m2: 0.26,  // regression from DOB permit data
    cost_usd_per_m2_manhattan_museum: 14500,  // $/m², Turner index 2024
  },
  // Peak ped count multiplier per 1000 annual visitors
  PED_PEAK_PER_KVIS: 0.42,  // i.e. 1000 annual visitors → +0.42 peds at peak hour
  // ... etc
};
```

### 5.2 Projection functions — one per layer

Each layer has a deterministic function. Example for air quality:

```js
export function projectAir(geometry, program, context) {
  const gfa = program.gfa_m2;
  const eui = COEFFICIENTS.EUI_BY_PROGRAM[program.type] ?? 300;
  const annual_kWh = gfa * eui;
  // Assume NYC grid mix: 0.28 kgCO2e/kWh; NOx from on-site combustion only
  const hvac_nox_kg_yr = gfa * 0.015;  // small-area emission factor
  const construction_months = COEFFICIENTS.CONSTRUCTION.duration_months_per_1000m2 * gfa / 1000;
  const truck_trips = COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 * gfa / 1000;

  const baseline = context.baseline_data_by_layer.air;  // from EPA AirNow + NYCCAS
  const projected_pm25 = baseline.pm25 + (truck_trips / construction_months) * 0.0008;
  // ... more calcs

  return {
    headline: { label: "PM2.5 local mean", value: projected_pm25.toFixed(1), unit: "µg/m³",
                delta_pct_or_abs: `+${(100 * (projected_pm25 - baseline.pm25) / baseline.pm25).toFixed(1)}%`,
                sign: "neg" },
    metrics: [ /* ... */ ],
    spatial: {
      type: "heatmap",
      features: generatePlumeFeatures(context.site_lat_lon, truck_trips, context.wind_dir),
    },
  };
}
```

Implement all 10. Where you have a real API, use it. Where you don't, use the coefficient table + site context. Every coefficient must have a source comment.

---

## 6. PER-LAYER SPEC

For each of the 10 layers, specify: data source(s), spatial render type, geometry-dependent projection math.

### 6.1 AIR QUALITY
- **Data**: EPA AirNow API (PM2.5, O3, NO2 monitoring stations, lat/lon); NYCCAS tract-level annual means (download as GeoJSON, join to tract polygons).
- **Baseline render**: point markers at monitoring stations sized by value + choropleth of NYCCAS tracts.
- **Projection**: construction plume as heatmap centered on site, decaying with wind-direction bias (use OpenWeather current wind or a fixed NW default).
- **Geometry math**: `truck_trips = 125 * gfa_m2 / 1000`; `construction_months = 0.26 * gfa_m2 / 1000`; plume intensity ∝ truck_trips / construction_months.

### 6.2 POWER SUPPLY
- **Data**: NYC LL84 Energy Benchmarking (public CSV, BBL-keyed — filter to within STUDY_RADIUS_M); Con Edison substation service areas (approximate from public maps or hardcode Chelsea-Penn substation at `-73.9997, 40.7498`).
- **Baseline**: existing buildings colored by EUI (choropleth on footprint polygons).
- **Projection**: highlight feeder line from site to substation; show substation load delta as ring.
- **Geometry math**: `annual_kWh = gfa * EUI[program]`; `peak_MW = annual_kWh * 0.00032` (load factor 0.35).

### 6.3 PEDESTRIAN TRAFFIC
- **Data**: NYC DOT Pedestrian Volumes (biannual counts at ~100 locations, downloadable; each has lat/lon); MTA subway entries (GTFS station coords + daily counts).
- **Baseline**: point markers sized by count at DOT locations + subway station dots.
- **Projection**: flow lines from nearest subway station(s) and High Line access points into site, weight ∝ est. peak visitors/hr.
- **Geometry math**: `annual_visitors = gfa * VISITOR_DENSITY[program]`; `peak_hr_visitors = annual_visitors * 0.0016` (concentration factor — 40% of traffic in 250 peak hours/yr).

### 6.4 RENT & PROPERTY VALUE
- **Data**: MapPLUTO (tax lots with assessed value, land use, year built); StreetEasy ZORI (ZIP-level, monthly CSV); HUD FMR (Manhattan-wide).
- **Baseline**: choropleth of tracts by median residential rent OR of tax lots by $/sf assessed.
- **Projection**: concentric radial bands at 100/250/400/800m, color-modulated by anchor-effect uplift %. Apply `pct` from `ANCHOR_RENT_UPLIFT` table to each ring's baseline rent.
- **Geometry math**: no direct geometry dependency in baseline model, but modulate anchor effect by `sqrt(gfa / 15000)` — a small pavilion is a weaker anchor than a major institution.

### 6.5 DISPLACEMENT RISK
- **Data**: ACS 5-year Census (income, rent burden, tenure, race — Census Bureau API, tract-level); NYC HPD eviction filings (point data, geocoded by address); rent-stabilized unit counts by BBL (DCP).
- **Baseline**: choropleth of tracts by composite displacement index (rent-burden × % long-tenure × % non-white).
- **Projection**: same index projected forward by applying the rent uplift from §6.4 to household-income-to-rent ratios — tracts that cross the 50% rent burden threshold flip color.
- **Geometry math**: inherits from §6.4.

### 6.6 INDUCED DEMAND
- **Data**: NYC DOF Business Registrations; Yelp Fusion API (counts by category in radius — requires key, layer is optional); NYC SBS CDNA reports (PDF — parse once, hardcode summary stats).
- **Baseline**: dots for existing F&B / retail / hotels within STUDY_RADIUS_M.
- **Projection**: synthetic dot placements in vacant storefronts (from DCP Storefront Tracker) weighted by proximity to projected visitor flow from §6.3.
- **Geometry math**: `new_storefronts = 0.033 * annual_visitors / 1000` (from Whitney → Meatpacking comparable).

### 6.7 TRANSIT PRESSURE
- **Data**: MTA daily subway ridership by station (public, station lat/lon from GTFS); Citi Bike system data (station lat/lon + trip counts); bus ridership by route/stop.
- **Baseline**: station dots sized by daily entries.
- **Projection**: same stations, re-sized with projected delta. Ring-outline highlights stations within 400m.
- **Geometry math**: `delta_entries = annual_visitors * 0.62 / 365` (62% arrive by transit — The Shed post-occupancy study).

### 6.8 PROJECT COST & LOGISTICS
- **Data**: DOB Job Filings (BBL-keyed costs for comparables — filter by use-class `M` Museum / `A3` Assembly); Turner Cost Index (quarterly, NY region — one number, hardcode); ENR (one number).
- **Baseline**: dots at comparable recent project sites, sized by total cost.
- **Projection**: overlay construction staging zone (buffer around site) + truck route lines to nearest highway access (West Side Hwy for Hudson Yards; generalize using `nearest highway node` from OSM).
- **Geometry math**: `cost = gfa * COEFFICIENTS.CONSTRUCTION.cost_usd_per_m2_manhattan_museum`; `duration = gfa * 0.00026 months/m²`; `trucks = gfa * 0.125`.

### 6.9 WATER & STORMWATER
- **Data**: NYC DEP CSO outfalls (point GeoJSON, public); NYC Stormwater Flood Hazard maps; NYC DEP water main capacity (tract-level).
- **Baseline**: point markers at CSO outfalls (color by annual overflow volume); flood-risk choropleth.
- **Projection**: arrows from site footprint toward nearest CSO outfall (use `turf.nearestPointOnLine` on sewershed polygon edges). Volume derived from footprint × impervious factor.
- **Geometry math**: `runoff_delta_gpd = footprint_m2 * 10.76 * 0.04` (0.04 gal/sf/day per Atlas 14 2-yr storm normalization).

### 6.10 WASTE & NOISE
- **Data**: NYC DSNY Commercial Waste Zones (polygon GeoJSON); NYC SoundScore (tract-level dB map); NYC 311 noise complaints (point data, geocoded).
- **Baseline**: choropleth by ambient dB + dots at 311 complaints.
- **Projection**: concentric dB rings around loading-dock position (user specifies or auto-place on longest street-facing edge of footprint).
- **Geometry math**: `ambient_dB_delta = 10 * log10(1 + visitors / existing_peak_ped)`; loading-dock dB ≈ 78 at source, −6 dB per doubling of distance.

---

## 7. UI — the panel architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER                                                           │
│ [Logo] [BEFORE | AFTER toggle]   [live clock] [theme toggle ☀/☾] │
├──────────┬─────────────────────────────────────────┬─────────────┤
│          │                                         │             │
│ LEFT     │         MAP  (MapTiler + GLB)           │  RIGHT      │
│ ─────    │                                         │  ─────      │
│ LAYERS   │                                         │  READOUTS   │
│ (10)     │                                         │             │
│          │                                         │  MASSING    │
│          │                                         │  CONTROLS   │
│          │                                         │             │
│          │                                         │  PROGRAM    │
│          │                                         │  SPEC       │
├──────────┴─────────────────────────────────────────┴─────────────┤
│ FOOTER: data provenance marquee (every dataset name + link)      │
└──────────────────────────────────────────────────────────────────┘
```

### 7.1 LEFT panel — layer list
Ten rows. Each row: checkbox, number, layer name, headline delta value. Click a row → expand inline to show data sources and analyst note. Multiple layers can be active simultaneously. The map renders all active layers as separate MapLibre layers with distinct source-ids.

### 7.2 RIGHT panel — three stacked sections
**(a) MASSING CONTROLS** — always visible at top:
- Drop zone for GLB upload (use `FileReader` → `Blob URL` → three.js `GLTFLoader`).
- Inputs: `anchor_lat`, `anchor_lon`, `rotation_deg` (0–360 slider), `vertical_offset_m`, `uniform_scale`.
- After load, display computed geometry: `footprint_m2`, `height_m`, `volume_m3`, `num_floors_est` (height / 4m).
- **Auto-extract**: walk the mesh with `three.BoxGeometry.setFromObject()`, project footprint to XZ plane, take convex hull area via `turf.convex`.

**(b) PROGRAM SPEC** — dropdown + inputs:
- `program_type` (dropdown: museum_art, museum_science, office, residential, hotel, retail, lab)
- `gfa_m2` (prefill from footprint × num_floors × 0.85 efficiency — user can override)
- `operating_hours_per_week`
- `admission_price_usd` (0 = free)
- `staff_count`

Changing any value re-runs the impact model and updates all readouts + spatial overlays within 200ms.

**(c) READOUTS** — context-sensitive:
- If no layer active → overview card: 10 layers summarized.
- If a layer is active → full readout: headline number, sparkline, metric table, data sources list, analyst note.

### 7.3 HEADER BEFORE/AFTER toggle
Binary pill. Spacebar keyboard-shortcut to flip. When AFTER is set:
- The massing mesh is visible on the map.
- Active impact layers re-render using the `projected` values.
- Header scenario tag changes from `BASELINE` → `+ MASSING · 5YR`.

### 7.4 Theme toggle
Sun/moon icon top-right of header. Click → flip `<html data-theme>`. Map style swaps from `streets-v2-dark` to `streets-v2-light`. All overlay colors defined as CSS variables also flip (defined in `base.css`).

---

## 8. DESIGN LANGUAGE

Look reference: the existing ALLSPARK site (`mattia137.github.io/2GBX_environment-2`) — technical, monochromatic, instrument-panel density. Keep that vocabulary but refine it.

- **Typography**: Fragment Mono for all UI. Uppercase for labels (`letter-spacing: 0.08em`), mixed case for body. Use serif (Instrument Serif or Fraunces) only for big numbers in readouts.
- **Dark theme palette**: `--bg: #0a0a0a`, `--ink: #f0eee6`, `--accent: #ff5a1f` (ALLSPARK orange), `--line: #1f1e1b`. Signed colors: `--positive: #7fb069`, `--negative: #e06c75`, `--neutral: #d4a857`.
- **Light theme palette**: `--bg: #f6f3ec`, `--ink: #121110`, `--accent: #c73e00`, `--line: #dcd7cc`. Signed colors: `--positive: #4a7a3a`, `--negative: #a84040`, `--neutral: #8a6820`.
- **Map overlay colors** must also be theme-aware — reference via `getComputedStyle(document.documentElement).getPropertyValue('--accent')` when creating MapLibre paint properties, and re-apply on theme change.
- Keep the 1px line-grid aesthetic. Dense but legible. No gradients except intentional heatmap ramps.

---

## 9. BUILD ORDER

Do it in this sequence. Don't skip ahead:

1. **Scaffolding**: get `index.html`, CSS variables, theme toggle, Fragment Mono loaded. Header + empty panels. Verify both themes render.
2. **Map init**: MapTiler GL JS with 3D buildings enabled (`map.setLayoutProperty('building-3d', 'visibility', 'visible')` or add `fill-extrusion` layer from OSM buildings source). Confirm theme swap triggers map style reload.
3. **Massing pipeline**: GLB loader + three.js custom layer + anchor controls. Validate by loading any test cube and confirming it sits at the correct lat/lon at the correct scale (a 50m cube should visually match a 50m building nearby).
4. **Geometry extraction**: auto-compute footprint, height, volume from loaded mesh.
5. **Data loader**: fetch census tracts, building footprints, CSO outfalls, NYCCAS. Cache to `localStorage` for fast reload.
6. **Impact model + one layer end-to-end**: pick AIR QUALITY. Wire baseline render + projection. Verify BEFORE/AFTER toggle produces visible difference.
7. **Remaining 9 layers**: one at a time, same pattern.
8. **Readouts panel**: hook to layer activation, drive from model output.
9. **Polish**: animations, keyboard shortcuts, URL hash state (so a configured scenario can be shared via link), theme persistence.

At the end of each step, commit. Don't combine steps.

---

## 10. ACCEPTANCE CRITERIA

Before declaring done, verify every item:

- [ ] Runs from `python -m http.server` with no console errors.
- [ ] Both themes render correctly (map + UI + overlays).
- [ ] Font is Fragment Mono — inspect in devtools, confirm it's loaded, confirm it's used on all visible UI text.
- [ ] Loading a GLB places it correctly geolocated, scaled, and rotated. A reference cube of known size visually matches neighbors.
- [ ] BEFORE / AFTER toggle visibly changes overlay values (test AIR and RENT at minimum).
- [ ] All 10 layers implemented with real spatial data (or explicitly documented synthetic fallback if an API is unreachable).
- [ ] Changing program type or GFA in the right panel updates headline numbers within 500ms.
- [ ] Changing `anchor_lat/lon` moves the mesh and re-centers the impact layers on the new anchor.
- [ ] Footer marquee cycles through every data source name.
- [ ] No hardcoded Hudson Yards coordinates outside of `config.js` defaults. Test by re-anchoring to a different NYC site (e.g. Brooklyn Navy Yard `-73.9710, 40.7020`) and confirming the whole pipeline still works.
- [ ] No copyrighted assets. All fonts from Google Fonts. All map tiles via MapTiler account.
- [ ] README explains how to get each API key and which layers work without them.

---

## 11. WHAT NOT TO DO

- Don't replicate the full visual complexity of the original ALLSPARK site. Clean beats dense here — impact is the subject.
- Don't invent data values. If a layer can't get real data in the dev environment, render it with visible "MOCK" badge and a TODO comment.
- Don't tie projections to Hudson Yards specifics. Every coefficient and radius is parametric.
- Don't use emoji in the UI.
- Don't use Tailwind, shadcn, Next.js, or any framework. Vanilla ES modules + CSS.
- Don't put API keys in committed code. Add `config.js` to `.gitignore` and ship a `config.example.js`.
- Don't use the Mapbox SDK. MapTiler ships its own GL JS and the user is paying for a MapTiler plan.

---

## 12. STARTING FILES

Three files are provided as scaffolding — open and read them before starting:
- `index.html` — the shell, layout grid, theme toggle, map container, panel placeholders
- `data-sources.json` — catalog of every public dataset with endpoints, fields, units, auth requirements
- `impact-model.js` — skeleton of the parametric engine with coefficient table

Extend these. Do not regenerate from scratch.
