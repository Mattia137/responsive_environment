# ALLSPARK // IMPACT — Phase 2 Build Spec for Claude Code

## Context for you, Claude Code

There is an existing, deployed scaffold at `https://responsive-environment.vercel.app` (source repo: the user will point you to it). It already implements:

- A MapTiler GL JS basemap with 3D buildings
- A GLB massing loader with three.js custom layer + correct geo-anchoring
- A parametric impact model (`js/impact-model.js`) covering 10 layers
- A BEFORE / AFTER scenario toggle
- A dark/light theme system using CSS variables
- Fragment Mono + Instrument Serif typography
- Left panel (layers), main panel (map), right panel (massing + program + readouts)

**Do not rebuild any of this.** Read the existing code first. Extend it.

The scaffold is competent, but it has a serious *philosophical* problem: it presents projected, modeled values with the same visual confidence as live measurements. The platform is paired with a theory paper by the user (Mattia Galbusera, "Designing inside the Wrap," SCI-Arc, April 2026) that argues — drawing on Jussi Parikka, Damjan Jovanovic, and Daniel Jacobs — that computational tools are not neutral instruments but **epistemic envelopes that produce the spaces and territories they appear to describe**. The paper's central claim is that *what is excluded from the wrap is as consequential as what is captured within it*.

Right now, the tool's UI performs precisely the move the paper criticizes: it adopts the aesthetic of planetary transparency, while quietly suppressing its own assumptions. Your job in this build is to bring the tool into alignment with its own thesis.

This means making the tool **visibly less confident** than competing tools — surfacing its exclusions, its provenance, its political geometry, its time horizons — *as a feature*, not a footnote. The competitive position is honesty.

You will execute this in 7 phases, in order. Each phase is independently committable and shippable. Do not skip ahead. After each phase: commit, run the acceptance criteria, then stop and wait for review.

---

## PHASE 0 — READ AND ORIENT

Before writing a single line of code:

1. Read every file in the existing repo. Build a mental model of how `state` flows from `main.js` → `impact-model.js` → `layers/dispatch.js` → MapLibre. Identify the single chokepoint where impact results are computed (it should be `refreshAll()` in `main.js`).
2. Read the user's paper, `Mattia_Galbusera_Designing_inside_the_Wrap_2026.pdf`, in full. Pay particular attention to §II (the wrap), §III (fluency vs. criticality), and §IV (the studio project as wrap).
3. Open `https://responsive-environment.vercel.app` and click through every layer. Note which numbers feel like measurements and which feel like models. That gut feeling is the design problem you're solving.

When you have done all three, write a 3-sentence summary in your reply confirming what you understood. Then proceed to Phase 1.

---

## PHASE 1 — PROVENANCE STATE FOR EVERY NUMBER

**Why first:** This is the foundational change. Every other phase depends on the tool knowing, for each metric it displays, where the value came from. If we do this badly, every later layer reproduces the same lie.

### What to build

Add a `provenance` field to every metric output by `impact-model.js`. The field has four possible values:

| value         | meaning                                                                  | UI treatment |
|---------------|--------------------------------------------------------------------------|--------------|
| `MEASURED`    | Live API call returning a real-world reading                             | Green dot, no decoration |
| `MODELED`     | Computed from live data + benchmark coefficients                          | Amber dot, light dashed underline |
| `BENCHMARK`   | Pure benchmark coefficient applied to user inputs (no live data)         | Amber dot, dotted underline |
| `SYNTHETIC`   | Placeholder pending real data integration                                 | Red dot, italic, "?" suffix |

### Required edits

1. In `js/impact-model.js`, every metric object emitted by every `project*()` function must gain `provenance: "MEASURED" | "MODELED" | "BENCHMARK" | "SYNTHETIC"`. The current values are mostly `BENCHMARK`. The headline value also gets one.
2. In `js/ui/panel-readouts.js`, render a small leading dot before each metric value, colored per the table above. On hover, show a tooltip explaining the provenance level.
3. In `css/components.css`, add the provenance dot styles. Use the existing CSS variables — do **not** introduce new theme-incompatible colors.
4. In `js/ui/panel-layers.js`, the layer's headline delta should also carry its provenance dot in the layer-list row.

### Acceptance criteria

- [ ] Every visible number on the right panel has a colored dot indicating provenance
- [ ] Hovering the dot reveals a one-sentence explanation
- [ ] In the current state (no live API keys configured), most numbers should read `BENCHMARK`, a few `SYNTHETIC`, and at most a couple `MEASURED` (the AirNow-derived PM2.5 if the key is set, the live Open-Meteo wind reading)
- [ ] Theme toggle still works; provenance dots stay legible in both modes

**Commit and stop.**

---

## PHASE 2 — THE WRAP INSPECTOR

**Why second:** This is the single intervention that aligns the tool with the paper's thesis. Without this, every other improvement is cosmetic.

### What to build

A persistent, collapsible panel — call it the **Wrap Inspector** — accessible from a small button in the header, next to the theme toggle. When expanded, it overlays the right side of the screen (or replaces the right panel on narrow viewports). It is keyboard-accessible via the `W` key.

For each of the 10 impact layers, the Wrap Inspector displays four sections:

1. **WHAT THIS LAYER SEES** — 1-2 sentences on what is being modeled.
2. **WHAT THIS LAYER DOES NOT SEE** — 2-4 bullet points on specific known exclusions. *This is the critical content.* Examples for the air layer:
   - "Indoor air quality (which disproportionately affects building service workers and low-income tenants in adjacent buildings) is not modeled."
   - "NYCCAS monitors are unevenly distributed; the Bronx and eastern Queens have known undercount."
   - "Emissions from museum visitor vehicle trips are not allocated to this layer; they appear, partially, under transit pressure."
3. **WHO IS COUNTED, WHO IS NOT** — for layers with demographic implications (rent, displacement, induced demand, transit, waste-noise), specific notes on undercounted populations: undocumented residents missing from ACS, informal workers absent from business registrations, etc.
4. **POLITICAL GEOMETRY** — 1-2 sentences naming the institutional/financial interests embedded in the dataset's design. Example for rent: "MapPLUTO's assessed values reflect Department of Finance valuations optimized for tax collection, not housing affordability; rent data from StreetEasy/Zillow over-represents market-rate listings and under-represents rent-stabilized turnover."

### Required files

- New: `js/ui/wrap-inspector.js` — the panel component, with the four-section template
- New: `js/wrap-knowledge.js` — a structured data module exporting `WRAP_NOTES[layerId] = { sees, excludes, demographics, political }`. This is the content hub. Populate all 10 layers with substantive entries — do not leave any layer empty. Cite sources where relevant (Furman Center reports, EJScreen technical notes, Census documentation).
- Edit: `index.html` — add the inspector button (icon: a small open square with a question mark, theme-aware), the panel container
- Edit: `css/components.css` — styles for the inspector
- Edit: `js/main.js` — keyboard binding for `W`

### Content quality requirement

The exclusion notes are the substance. Don't write "data may be incomplete" or "limitations exist." Write *specific, citable, falsifiable* exclusion claims. If you don't know what's excluded from a layer, you must research it — search EJScreen technical documentation, Furman Center methodology notes, ACS undercount studies, and the specific dataset's metadata. Bad bullet: "ACS data has limitations." Good bullet: "ACS 5-year estimates undercount undocumented residents (~5% citywide, concentrated in immigrant-dense tracts in Sunset Park, Corona, Jackson Heights); these residents bear displacement risk that the model cannot see."

### Acceptance criteria

- [ ] Inspector opens via header button or `W` key
- [ ] All 10 layers populated with non-trivial exclusion content
- [ ] Each layer's notes include at least one specific named dataset bias and at least one specific named excluded population/condition
- [ ] Inspector content scrolls independently from the rest of the UI
- [ ] When a layer is active, that layer's wrap notes are highlighted/auto-scrolled to top
- [ ] Theme-compatible

**Commit and stop.** This is the most important phase. Do it well.

---

## PHASE 3 — CONTESTABLE GEOMETRY: THE 400m RING IS A POLITICAL CHOICE

**Why third:** The paper says exclusions are produced by parameter choices. The fixed 400m radius is currently the most conspicuous unstated parameter. Make it visible and editable.

### What to build

1. Move the impact radius from a fixed CONFIG value into UI state, exposed as a slider in the right panel under massing/program. Range 100m–1500m, default 400m, step 50m.
2. Add a *radius mode* selector with three options:
   - **EUCLIDEAN** (current behavior): a perfect circle
   - **TRANSIT ISOCHRONE**: a 10/15/20-minute walking polygon computed from the OSM street network around the anchor point. Use the free [Mapbox-style isochrone via Valhalla public endpoint](https://valhalla1.openstreetmap.de/isochrone) or [OpenRouteService isochrone API](https://api.openrouteservice.org/v2/isochrones/foot-walking) (free tier, requires email signup — document this in the README and gate behind an optional config key)
   - **DRAWN**: user draws a polygon on the map (use MapLibre Draw or a minimal custom polygon-draw tool)
3. The radius geometry feeds the impact model (i.e. ring-mode layers use it directly; choropleth-mode layers filter their feature set to those intersecting the geometry).
4. In the Wrap Inspector, add a new top-level callout: *"This impact boundary is an editorial choice, not a measurement. The default circle is convenient, not correct. Anchor effects propagate along transit lines, school district edges, and existing rent gradients — not in perfect rings."* Include a one-click "Why?" button that expands a 4-sentence pedagogical note.

### Required files

- Edit: `js/main.js` — add `state.impactGeometry = { mode: 'euclidean'|'isochrone'|'drawn', radius_m: 400, polygon: null }`
- New: `js/geometry.js` — pure functions for generating ring/isochrone/polygon GeoJSON; isochrone fetcher with caching
- Edit: `js/impact-model.js` — every layer's `spatial.features` should be clipped to the active impact geometry where it makes sense
- Edit: `js/layers/dispatch.js` — render the active boundary as a single visible outline above all overlays
- Edit: `js/ui/panel-massing.js` — the new geometry control
- Edit: `js/ui/wrap-inspector.js` — the editorial-choice callout

### Acceptance criteria

- [ ] Sliding the radius updates all ring/heatmap layers in real time (≤200ms)
- [ ] Switching to isochrone mode fetches and renders a real walking-time polygon
- [ ] Drawn mode lets the user create a custom polygon
- [ ] The active boundary is always visible on the map (1px outline, theme-aware accent color)
- [ ] The Wrap Inspector callout appears at the top of the inspector and links to a "Why?" explanation

**Commit and stop.**

---

## PHASE 4 — TIME, NOT JUST BEFORE/AFTER

**Why fourth:** The current binary toggle compresses the most important dimension your model has data on — *when* the impact unfolds. Phase the impact across construction → opening → 5-year → 20-year horizons, with uncertainty growing over time.

### What to build

Replace the binary BEFORE/AFTER toggle with a **time scrubber** in the header:

```
[BASELINE] ──○─── [CONSTRUCTION] ───── [OPEN +1Y] ───── [SETTLED +5Y] ───── [HORIZON +20Y]
              T0            T1                 T2                T3                  T4
```

- T0 = current state, no project
- T1 = peak construction (months 12–24), all numbers reflect construction-phase impacts (truck PM2.5 spike, noise, no operational energy, no visitors)
- T2 = first year of operation, transient values
- T3 = 5-year settled state (current "AFTER" mode)
- T4 = 20-year horizon (cumulative embodied carbon paid down, full anchor-effect rent uplift, climate change shifts in baseline conditions)

### Uncertainty bands

For T2 onward, every projected number must render with a visible uncertainty range. The further out, the wider the range. Use a simple band: `[low, central, high]` where the band widens by ~10% per time-step.

### Required edits

- Edit: `index.html` — replace the two-button state toggle with a 5-position scrubber
- Edit: `js/main.js` — `state.timeStep` replaces `state.mode`
- Edit: `js/impact-model.js` — every projection function gets `(geometry, program, context, timeStep)` and returns *time-step-specific* values. The construction-phase values for air, noise, cost-logistics, water-runoff are different from steady-state.
- Edit: `js/ui/panel-readouts.js` — render uncertainty bands. The big number now has a smaller "low–high" range below it.
- Edit: `js/ui/panel-layers.js` — headline delta in layer list shows the central value with provenance dot

### Climate-baseline shift

For T4 (+20Y), the baseline weather, sea level, and heat stress are not the current values. Use Open-Meteo's Climate API (CMIP6, free, no key) to fetch projected 2046 conditions for the site:
```
https://climate-api.open-meteo.com/v1/climate?latitude={lat}&longitude={lon}&start_date=2046-01-01&end_date=2046-12-31&models=EC_Earth3P_HR&daily=temperature_2m_max,temperature_2m_mean,precipitation_sum
```
Cache aggressively. This is the moment the user *sees the wrap*: T0 baseline is one model, T4 baseline is a different model.

### Acceptance criteria

- [ ] The 5-step scrubber works (click and arrow-key navigable)
- [ ] Each step produces visibly different per-layer values
- [ ] Uncertainty bands grow with time
- [ ] T4 uses CMIP6-projected baseline (verifiable: T4 baseline temperature for NYC summer 2046 should be ~1.5–2°C warmer than T0)
- [ ] The Wrap Inspector for the time scrubber notes that "future projections are not predictions; they are conditional model outputs whose conditions are themselves contested"

**Commit and stop.**

---

## PHASE 5 — THE DISPLACEMENT LAYER, DECONSTRUCTED

**Why fifth:** Displacement is the layer that most needs the new architecture. A single "displacement risk" composite index is exactly the kind of flattening the paper criticizes. Open it up.

### What to build

The displacement layer becomes a **multi-dimensional sub-explorer**. When the user activates it, instead of one composite choropleth, they see four toggleable sub-layers, each rendering the same tract polygons colored differently:

1. **RENT BURDEN** — % of households paying >30% of income on rent (ACS B25070)
2. **TENURE** — % of households who have lived at address >10 years (ACS B25026/B25038)
3. **RACE/ETHNICITY** — choropleth of % non-white (ACS B03002), with the *explicit caveat* in the Wrap Inspector that race-as-displacement-proxy reproduces the racialization it tries to resist; this is shown not because it is correct but because researchers use it
4. **EVICTION FILINGS** — point density of HPD eviction filings (last 12 months)

The composite index becomes a *fifth* toggle, clearly marked: *"COMPOSITE — a flattening. See sub-dimensions for what this hides."*

### Data sources

- ACS 5-year via Census Bureau API (`https://api.census.gov/data/2022/acs/acs5`) — free, requires a key (free signup at api.census.gov/data/key_signup.html), document in `config.example.js`
- HPD evictions via NYC Open Data (`https://data.cityofnewyork.us/resource/6z8x-wfk4.geojson`) — open, no key

### Required files

- New: `js/layers/displacement-explorer.js` — the multi-dimensional sub-layer logic
- Edit: `js/data-loader.js` — ACS fetchers for the four dimensions, with proper joins to tract GeoJSON via GEOID
- Edit: `js/wrap-knowledge.js` — substantially expanded notes for displacement, including the race-proxy caveat
- Edit: `js/ui/panel-readouts.js` — render the sub-layer toggles when displacement is the active layer

### Acceptance criteria

- [ ] Activating displacement shows four sub-toggles + composite
- [ ] Each sub-layer renders distinct tract-level data
- [ ] Composite is labeled as a flattening with a "see what this hides" affordance
- [ ] Wrap notes for displacement include the race-as-proxy caveat with sources
- [ ] Data is real ACS data (verifiable: spot-check a few tract values against `https://censusreporter.org`)

**Commit and stop.**

---

## PHASE 6 — CLIMATE & ECOSYSTEM: THE NATURAL WORLD AS A LAYER

**Why sixth:** The user's paper invokes Parikka's "medianatures" — computation as planetary, made of the same matter it models. A platform that claims to assess "impact" must include the non-human ecosystem the project displaces. This is where the tool becomes globally meaningful, not just NYC-specific.

### What to build — three new layers

#### LAYER 11: URBAN MICROCLIMATE
The project's effect on its immediate thermal/wind/solar environment.

- **Solar access** — does the massing cast new shadow on adjacent buildings/streets/parks at solstices and equinoxes? Compute using three.js raycasting against context buildings + sun position from a public solar position library (e.g. SunCalc.js)
- **Wind** — qualitative analysis using the building's height, footprint, and the prevailing wind from Open-Meteo. Identify *likely* downwash zones using a simple Frank-Whittle empirical formula. Mark this as `MODELED` provenance with strong Wrap Inspector caveats — real wind requires CFD.
- **Surface temperature** — the project replaces existing impervious surface with new impervious surface, but a different albedo. Estimate UHI delta using NASA MODIS LST archived data via Microsoft Planetary Computer's STAC API (free, no key for MODIS).
- **Heat exposure** — number of hours/year above 32°C at the site, T0 vs T4. Use Open-Meteo Climate API directly.

#### LAYER 12: URBAN FOREST & CANOPY
The trees and vegetation the project interacts with.

- Render every tree within the impact geometry as a point, sized by trunk diameter, colored by species. Data: NYC Street Tree Census (`uvpi-gqnh`) — 666k trees with i-Tree-calculated ecosystem benefits already in the dataset (annual carbon storage, stormwater intercepted, energy saved, pollution removed, total $ benefit per tree). No key required.
- Compute "trees displaced" = trees within the project footprint geometry. For each, sum the lost ecosystem benefits.
- Tree canopy coverage % within impact ring at T0 (from `hnxz-kkn5` 2010 canopy + `by9k-vhck` 2010-2017 change) → projected T3 (assume project removes its footprint canopy unless user specifies green roof).
- Wrap Inspector note: NYC Street Tree Census is from 2015-16 (volunteer-led TreesCount), so it is now ~10 years stale. Trees die, are planted, are removed. Use with confidence interval.

#### LAYER 13: BIODIVERSITY
The non-human inhabitants of the site, in any city on Earth.

- Use GBIF Occurrence API (free, no key): `https://api.gbif.org/v1/occurrence/search?decimalLatitude={lat-bbox}&decimalLongitude={lon-bbox}&limit=300&hasCoordinate=true`
- Display species occurrences within the impact geometry, grouped by taxonomic class (birds, mammals, plants, insects, fungi). Show count + diversity index (Shannon-Wiener) at T0.
- Allow the user to filter by class and by IUCN Red List status (GBIF returns this).
- For T3 projection: estimate biodiversity reduction proportional to footprint × baseline diversity, weighted by class sensitivity (birds are more affected than fungi). This is a coarse model — flag it strongly with `BENCHMARK` provenance.
- Wrap Inspector note (critical, well-suited to your paper): *"GBIF data is dominated by citizen science observations (iNaturalist, eBird). This means it over-represents species that humans like (charismatic birds, butterflies) and dramatically under-represents soil microbiota, fungi, nocturnal species, and species in low-income neighborhoods where citizen-scientist density is lower. The map of biodiversity is also a map of who has time and equipment to observe."*

### Why this works globally, not just NYC

Open-Meteo, MODIS via Planetary Computer, GBIF, and OSM (for street networks) are all free, key-less or low-key, and global. NYC Street Tree Census obviously is not — for the urban forest layer outside NYC, fall back to a *global* canopy dataset (Hansen Global Forest Change via Planetary Computer, or the ESA WorldCover land cover). Document this fallback explicitly.

### Required files

- New: `js/layers/microclimate.js`
- New: `js/layers/canopy.js`
- New: `js/layers/biodiversity.js`
- Edit: `js/layers/registry.js` — add layers 11, 12, 13
- Edit: `js/data-loader.js` — fetchers for tree census, GBIF occurrences, MODIS LST
- New: `js/lib/suncalc-wrapper.js` — simple wrapper around SunCalc for shadow computation
- Edit: `js/wrap-knowledge.js` — substantial entries for all three new layers, especially biodiversity

### Acceptance criteria

- [ ] Three new layers appear in the layer list
- [ ] Canopy layer renders real NYC tree points within the impact geometry, with click-to-inspect showing species + ecosystem benefit values
- [ ] Biodiversity layer fetches real GBIF data for the site (try Hudson Yards: should return roughly 200–400 occurrences, dominated by birds)
- [ ] Microclimate layer computes shadow at summer solstice noon and winter solstice noon, visualized as a translucent shadow polygon on the map
- [ ] Heat-exposure metric uses real Open-Meteo data, T0 vs T4
- [ ] Re-anchoring the project to a non-NYC site (test: London `[51.5074, -0.1278]` or Tokyo `[35.6762, 139.6503]`) the climate, microclimate, and biodiversity layers still work; canopy layer falls back gracefully to global land-cover

**Commit and stop.** This is the largest phase. Do not start it before phases 1–5 are stable.

---

## PHASE 7 — THE EXPORTABLE AUDIT: THE REPORT IS THE TOOL'S CONFESSION

**Why last:** Your paper says architects must *know they are inside the wrap*. The way the tool enforces this is by making the export — the artifact the architect carries away — *include the inspector*. The report cannot be a screenshot. It must be a confession.

### What to build

A "GENERATE REPORT" button in the header. Clicking it produces a single-page HTML document (`report.html`, downloadable) that contains:

1. **Project header** — site coords, program type, GFA, geometry summary
2. **Executive impact summary** — the 13 layer headlines with provenance dots, time horizon, and uncertainty ranges
3. **The active impact geometry** — rendered as an SVG snapshot, with the boundary mode named (e.g. "EUCLIDEAN 400m" or "ISOCHRONE 10min walk")
4. **THE WRAP DECLARATION** — required, non-removable. A full reproduction of the active layers' Wrap Inspector entries (what each layer sees, doesn't see, who's counted, political geometry).
5. **Architect's exclusions log** — a free-text field where the architect *must* enter at least 200 characters describing what they consciously chose not to model and why. The export button is disabled until this is filled. *This is the move that turns the tool into a critical instrument.*
6. **Data provenance manifest** — auto-generated table listing every dataset queried, with timestamp, source URL, license, and the cache key (so the report is reproducible)
7. **Citation block** — auto-generated, including a citation of the user's paper

### Required files

- New: `js/report.js` — assembles the HTML document from current state
- New: `templates/report.html` — the static template
- Edit: `index.html` — header button
- Edit: `js/ui/wrap-inspector.js` — the exclusions-log textarea lives here

### Acceptance criteria

- [ ] Button generates a self-contained HTML file (all CSS/SVG inline, no external dependencies)
- [ ] Report opens in a new tab and prints cleanly
- [ ] Export is blocked until the architect's exclusions log has at least 200 characters
- [ ] The Wrap Declaration cannot be removed or hidden in the export
- [ ] Citation block includes the user's paper

**Commit and stop. Phase 7 complete.**

---

## CROSS-CUTTING REQUIREMENTS — apply to all phases

### Free data sources — primary list

These are the canonical free sources. Use these unless explicitly justified otherwise.

| Domain | Source | Auth | Notes |
|---|---|---|---|
| Weather, current+historical+CMIP6 | Open-Meteo (`api.open-meteo.com`, `archive-api.open-meteo.com`, `climate-api.open-meteo.com`) | None | ERA5 back to 1940; IPCC to 2050 |
| Air quality (real-time) | Open-Meteo Air Quality API | None | PM2.5, PM10, O3, NO2, SO2, dust, pollen — 5km res |
| Air quality (NYC tract) | NYC DOHMH NYCCAS via NYC Open Data | None | Choropleth basis |
| Census demographics | US Census Bureau ACS API | Free key | api.census.gov/data/key_signup.html |
| NYC tabular open data | NYC Open Data Socrata API | None | data.cityofnewyork.us |
| Buildings & footprints | NYC MapPLUTO + Building Footprints | None | NYC Open Data |
| Streets, transit, OSM features | OpenStreetMap via Overpass API | None | overpass-api.de/api/interpreter |
| Walking isochrones | OpenRouteService | Free key | api.openrouteservice.org |
| Trees (NYC) | NYC Street Tree Census `uvpi-gqnh` | None | Includes i-Tree benefits |
| Land cover (global fallback) | ESA WorldCover via Microsoft Planetary Computer | None | STAC API |
| Tree canopy change | NYC Open Data `by9k-vhck` | None | 2010–2017 |
| Biodiversity (global) | GBIF Occurrence API `api.gbif.org/v1` | None | 3.1B records |
| MTA ridership | NYC Open Data + MTA developer site | None | |
| Citi Bike | Citi Bike System Data (GBFS) | None | |
| Embodied carbon | EC3 Building Transparency | Free account | Document, gate |
| Solar position | SunCalc.js (client-side library) | None | NPM/CDN |
| Energy benchmarks | NYC LL84 Energy & Water Disclosure | None | NYC Open Data |
| CSO outfalls | NYC DEP `c4m9-hkbf` | None | |
| Eviction filings | NYC HPD via NYC Open Data | None | |

**Whenever you add a new data source not on this list, you must justify it in a code comment** (why this and not the open alternative) and add it to the README.

### Provenance discipline

Every fetch in `js/data-loader.js` must:
1. Set a `cache-control` header check (use `localStorage` cache keyed by URL + 24h TTL)
2. Tag the returned data with `{_source: URL, _fetched: ISO8601, _license: string}`
3. Fall back gracefully — if the API fails, mark the layer's metrics as `SYNTHETIC` and surface a small "DATA UNAVAILABLE" pill in the layer header

### Theme discipline

Every new UI element must work in both `data-theme="dark"` and `data-theme="light"`. Use existing CSS variables only. Test both themes after every phase.

### What not to do

- Do not redesign the existing visual language. Fragment Mono + Instrument Serif + the dark/light palette + the orange accent + the panel-grid layout are all settled. Extend them.
- Do not add gratuitous animations. The tool should feel like an instrument, not a demo.
- Do not use emoji.
- Do not add a framework. Keep vanilla ES modules.
- Do not invent data values. Anything not from a real fetch is `SYNTHETIC` and must be tagged as such.
- Do not collapse multiple phases into one commit. Each phase is independently reviewable.
- Do not rewrite working code from the existing scaffold to "improve" it. Touch only what each phase requires.

### Checking against the paper

After each phase, ask yourself: *would Mattia's paper consider this honest?* The test isn't whether the feature works. It's whether a reader of "Designing inside the Wrap" would recognize the platform as the kind of critical instrument the paper calls for. If the answer is "the platform now performs more, but admits less," you've gone the wrong direction.

---

## DELIVERY

After Phase 7, the platform should:

- Render every number with explicit provenance
- Make its exclusions visible as a feature, not a bug
- Allow the user to contest the geometry of "impact"
- Show time as a continuous dimension with growing uncertainty
- Open displacement as a contested composite, not a single index
- Include the natural ecosystem (climate, canopy, biodiversity) as first-class layers, addressable globally
- Produce reports that cannot be exported without the architect declaring what they chose not to model

That tool, in the field, would be the only one of its kind. It would be the platform the user's paper actually argues for — not a dashboard that performs planetary transparency, but an instrument that helps an architect *know they are inside the wrap*.

Begin with Phase 0. Confirm understanding. Then Phase 1.
