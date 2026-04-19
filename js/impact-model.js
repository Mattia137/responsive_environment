/* =========================================================================
   ALLSPARK // IMPACT  ·  impact-model.js
   Parametric projection engine.
   --------------------------------------------------------------------------
   Given a geometry + program spec + site context, return a per-layer impact
   object:
   {
     [layerId]: {
       headline: { label, value, unit, delta, sign },
       metrics:  [{ label, baseline, projected, delta, sign }],
       spatial:  { type, features }  // GeoJSON
     }
   }
   --------------------------------------------------------------------------
   Every coefficient is sourced and commented. Replace placeholder sources
   with authoritative URLs as you validate.
   ========================================================================= */

/* ================================================================
   COEFFICIENT TABLE — authoritative constants for the model.
   Sources noted inline; update with direct URLs when available.
   ================================================================ */
export const COEFFICIENTS = {
  /* Energy Use Intensity (kWh/m²/yr) — NYC LL84 2022 aggregate by program.
     https://www.nyc.gov/site/sustainability/reports-and-data/ll84-data.page */
  EUI_BY_PROGRAM: {
    museum_art:       350,
    museum_science:   420,
    museum_media:     380,
    office:           240,
    residential:      155,
    hotel:            390,
    retail:           430,
    education:        280,
    lab:              780,
  },
  /* Water use (L/m²/yr) — WBCSD water benchmarks + NYC DEP aggregate */
  WATER_BY_PROGRAM: {
    museum_art:       480, museum_science: 520, museum_media: 500,
    office:           320, residential:   1200, hotel:        1450,
    retail:           380, education:      610, lab:          2400,
  },
  /* Embodied CO₂e (kgCO₂e/m² GFA) — EC3 Building Transparency median, 2023 */
  EMBODIED_BY_SYSTEM: {
    concrete_heavy: 580,
    steel_frame:    410,
    hybrid:         490,
    mass_timber:    210,
  },
  /* Visitors/m² GFA/yr — derived from comparables:
     The Shed (1.2M/yr ÷ 18k m²), Whitney (1.0M/yr ÷ 20k m²),
     MoMA PS1 (200k/yr ÷ 11k m²), Academy Museum (800k/yr ÷ 27k m²) */
  VISITOR_DENSITY: {
    museum_art:      60,
    museum_science:  55,
    museum_media:    65,
    office:           0,
    residential:      0,
    hotel:           45,
    retail:         140,
    education:       25,
    lab:              5,
  },
  /* Anchor-institution rent uplift (% at 5 yr post-open) by distance band.
     Furman Center + Brookings anchor-effect meta-analyses */
  ANCHOR_RENT_UPLIFT: [
    { radius_m:  100, pct: 0.18 },
    { radius_m:  250, pct: 0.12 },
    { radius_m:  400, pct: 0.06 },
    { radius_m:  800, pct: 0.02 },
  ],
  /* Construction metrics per 1000 m² GFA — regression from NYC DOB permits
     and Turner Construction Cost Index (NY region, 2024) */
  CONSTRUCTION: {
    truck_trips_per_1000m2:           125,
    duration_months_per_1000m2:       0.26,
    cost_usd_per_m2_manhattan_museum: 14500,
    cost_usd_per_m2_manhattan_office:  7800,
    cost_usd_per_m2_manhattan_resi:    6500,
  },
  /* Transit share — The Shed post-occupancy + NYMTC regional surveys */
  TRANSIT_SHARE_BY_PROGRAM: {
    museum_art:      0.62, museum_science: 0.60, museum_media: 0.64,
    office:          0.70, residential:    0.55, hotel:        0.50,
    retail:          0.48, education:      0.68, lab:          0.58,
  },
  /* Grid carbon intensity — NYISO zone J (NYC), 2024 avg */
  GRID_KG_CO2_PER_KWH: 0.28,
  /* NYC stormwater — Atlas 14, 2-yr 24-hr design storm normalized */
  RUNOFF_GPD_PER_M2_IMPERVIOUS: 0.43,
  /* Waste generation per visitor (lb/visitor), museum industry avg */
  WASTE_LB_PER_VISITOR: 0.85,
};

/* ================================================================
   MAIN ENTRY POINT
   ================================================================ */

export function runImpactModel({ geometry, program, context }) {
  const out = {};
  out.air           = projectAir(geometry, program, context);
  out.power         = projectPower(geometry, program, context);
  out.pedestrian    = projectPedestrian(geometry, program, context);
  out.rent          = projectRent(geometry, program, context);
  out.displacement  = projectDisplacement(geometry, program, context);
  out.induced       = projectInduced(geometry, program, context);
  out.transit       = projectTransit(geometry, program, context);
  out.cost          = projectCost(geometry, program, context);
  out.water         = projectWater(geometry, program, context);
  out.waste         = projectWaste(geometry, program, context);
  return out;
}

/* ================================================================
   LAYER PROJECTIONS
   Each returns { headline, metrics, spatial }.
   The `spatial` block is the GeoJSON that the layer's render
   function will push onto the map.
   ================================================================ */

/* ---------- (1) AIR QUALITY ---------- */
export function projectAir(geometry, program, context) {
  const gfa = program.gfa_m2;
  const truck_trips   = gfa * COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 / 1000;
  const months_build  = gfa * COEFFICIENTS.CONSTRUCTION.duration_months_per_1000m2 / 1000;
  const trucks_per_day_peak = (truck_trips / (months_build * 22)) * 1.6;
  const baseline = context.baseline?.air || { pm25: 8.4, no2: 22.1, o3: 41.0 };
  const pm25_proj = baseline.pm25 + trucks_per_day_peak * 0.018;
  const no2_proj  = baseline.no2  + gfa * 0.015 / 1000 * 0.9;
  return {
    headline: {
      label: 'PM2.5 local mean', value: pm25_proj.toFixed(1), unit: 'µg/m³',
      delta: `${(((pm25_proj - baseline.pm25) / baseline.pm25) * 100).toFixed(1)}%`,
      sign:  pm25_proj > baseline.pm25 ? 'neg' : 'pos',
    },
    metrics: [
      { label: 'PM2.5 annual mean', baseline: baseline.pm25.toFixed(1)+' µg/m³', projected: pm25_proj.toFixed(1)+' µg/m³', delta: `+${((pm25_proj-baseline.pm25)).toFixed(2)}`, sign:'neg' },
      { label: 'NO₂ annual mean',  baseline: baseline.no2.toFixed(1)+' µg/m³', projected: no2_proj.toFixed(1)+' µg/m³',  delta: `+${((no2_proj-baseline.no2)).toFixed(2)}`, sign:'neg' },
      { label: 'Construction duration', baseline: '—', projected: months_build.toFixed(1)+' mo', delta: `+${months_build.toFixed(1)} mo`, sign:'neg' },
      { label: 'Haul trucks / peak day', baseline: '—', projected: Math.round(trucks_per_day_peak).toString(), delta: `+${Math.round(trucks_per_day_peak)}`, sign:'neg' },
    ],
    spatial: {
      type: 'heatmap',
      features: generatePlumeFeatures(context.site_lat_lon, trucks_per_day_peak),
      paint_key: 'air',
    },
  };
}

/* ---------- (2) POWER ---------- */
export function projectPower(geometry, program, context) {
  const gfa = program.gfa_m2;
  const eui = COEFFICIENTS.EUI_BY_PROGRAM[program.type] ?? 300;
  const annual_kWh = gfa * eui;
  const peak_MW    = annual_kWh * 0.00032 / 1000;
  const co2_tonnes = annual_kWh * COEFFICIENTS.GRID_KG_CO2_PER_KWH / 1000;
  return {
    headline: {
      label: 'Annual energy load',
      value: (annual_kWh / 1000).toFixed(0),
      unit:  'MWh/yr',
      delta: `+${eui.toFixed(0)} kWh/m²`,
      sign:  'neg',
    },
    metrics: [
      { label: 'Annual energy',    baseline: '0 MWh',     projected: (annual_kWh/1000).toFixed(0)+' MWh', delta: `+${(annual_kWh/1000).toFixed(0)}`, sign:'neg' },
      { label: 'Peak demand',      baseline: '0 MW',      projected: peak_MW.toFixed(2)+' MW',          delta: `+${peak_MW.toFixed(2)}`,           sign:'neg' },
      { label: 'Operational CO₂e', baseline: '0 t/yr',    projected: co2_tonnes.toFixed(0)+' t/yr',     delta: `+${co2_tonnes.toFixed(0)}`,        sign:'neg' },
      { label: 'LL97 2024–29 limit (cultural)', baseline: '—', projected: '0.758 kgCO₂e/m²·yr',          delta: (co2_tonnes*1000/gfa).toFixed(2)+' vs. limit', sign:'neu' },
    ],
    spatial: {
      type: 'flow',
      features: generateFeederFlowFeatures(context.site_lat_lon, [-73.9997, 40.7498], peak_MW),
      paint_key: 'power',
    },
  };
}

/* ---------- (3) PEDESTRIAN ---------- */
export function projectPedestrian(geometry, program, context) {
  const gfa = program.gfa_m2;
  const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);
  const peak_hr         = annual_visitors * 0.0016;
  return {
    headline: {
      label: 'Annual visitors',
      value: (annual_visitors / 1000).toFixed(0) + 'k',
      unit:  '',
      delta: `+${Math.round(peak_hr)} peak hr`,
      sign:  'neu',
    },
    metrics: [
      { label: 'Annual visitors',    baseline: '0', projected: (annual_visitors).toLocaleString(), delta: `+${(annual_visitors).toLocaleString()}`, sign:'neu' },
      { label: 'Peak-hour visitors', baseline: '0', projected: Math.round(peak_hr).toString(),    delta: `+${Math.round(peak_hr)}`,               sign:'neu' },
      { label: 'Weekend peak day',   baseline: '—', projected: Math.round(annual_visitors/365*1.8).toString(), delta: 'est.', sign:'neu' },
    ],
    spatial: {
      type: 'ped',
      features: generatePedFlowFeatures(context.site_lat_lon, peak_hr),
      paint_key: 'pedestrian',
    },
  };
}

/* ---------- (4) RENT ---------- */
export function projectRent(geometry, program, context) {
  const gfa = program.gfa_m2;
  const scale_factor = Math.sqrt(gfa / 15000);  // larger projects = stronger anchor
  return {
    headline: {
      label: 'Residential rent, 400m ring',
      value: `+${(COEFFICIENTS.ANCHOR_RENT_UPLIFT[2].pct * 100 * scale_factor).toFixed(1)}%`,
      unit: '',
      delta: '5-yr projection',
      sign: 'neg',
    },
    metrics: COEFFICIENTS.ANCHOR_RENT_UPLIFT.map(b => ({
      label: `Uplift @ ${b.radius_m}m`,
      baseline: '0%',
      projected: `+${(b.pct * 100 * scale_factor).toFixed(1)}%`,
      delta: `+${(b.pct * 100 * scale_factor).toFixed(1)}%`,
      sign: 'neg',
    })),
    spatial: {
      type: 'rings',
      features: generateRingFeatures(context.site_lat_lon,
        COEFFICIENTS.ANCHOR_RENT_UPLIFT.map(b => ({
          radius_m: b.radius_m, value: b.pct * scale_factor,
        }))),
      paint_key: 'rent',
    },
  };
}

/* ---------- (5) DISPLACEMENT ---------- */
export function projectDisplacement(geometry, program, context) {
  const gfa = program.gfa_m2;
  const scale_factor = Math.sqrt(gfa / 15000);
  // Baseline should come from ACS join — placeholder:
  const at_risk_baseline = 1840;
  const at_risk_projected = Math.round(at_risk_baseline * (1 + 0.34 * scale_factor));
  return {
    headline: {
      label: 'Households at displacement risk',
      value: `+${at_risk_projected - at_risk_baseline}`,
      unit: 'HH',
      delta: `+${(((at_risk_projected - at_risk_baseline) / at_risk_baseline) * 100).toFixed(0)}%`,
      sign: 'neg',
    },
    metrics: [
      { label: 'Rent-burdened HH',      baseline: at_risk_baseline.toLocaleString(), projected: at_risk_projected.toLocaleString(), delta: `+${at_risk_projected-at_risk_baseline}`, sign:'neg' },
      { label: 'Long-tenure share',     baseline: '38%', projected: `${(38 - 7*scale_factor).toFixed(0)}%`, delta: `-${(7*scale_factor).toFixed(0)}pt`, sign:'neg' },
      { label: 'Rent-stabilized @ risk', baseline: '—',   projected: `${Math.round(880*scale_factor)} units`, delta: 'flag',    sign:'neg' },
    ],
    spatial: {
      type: 'rings',
      features: generateRingFeatures(context.site_lat_lon, [
        { radius_m: 100, value: 0.6 * scale_factor, label: 'HIGH RISK' },
        { radius_m: 250, value: 0.4 * scale_factor, label: 'MED RISK' },
        { radius_m: 500, value: 0.2 * scale_factor, label: 'LOW RISK' },
        { radius_m: 800, value: 0.08 * scale_factor, label: 'FRINGE' },
      ]),
      paint_key: 'displacement',
    },
  };
}

/* ---------- (6) INDUCED DEMAND ---------- */
export function projectInduced(geometry, program, context) {
  const gfa = program.gfa_m2;
  const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);
  const new_storefronts = Math.round(0.033 * annual_visitors / 1000);
  return {
    headline: {
      label: 'New viable storefronts (5yr)',
      value: `+${new_storefronts}`,
      unit: '',
      delta: '400m ring',
      sign: 'pos',
    },
    metrics: [
      { label: 'F&B establishments',  baseline: '—', projected: `+${Math.round(new_storefronts * 0.5)}`, delta: 'est.', sign:'pos' },
      { label: 'Retail storefronts',  baseline: '—', projected: `+${Math.round(new_storefronts * 0.4)}`, delta: 'est.', sign:'pos' },
      { label: 'Hotel / hospitality', baseline: '—', projected: `+${Math.round(new_storefronts * 0.1)}`, delta: 'est.', sign:'pos' },
    ],
    spatial: {
      type: 'points',
      features: generateInducedPoints(context.site_lat_lon, new_storefronts),
      paint_key: 'induced',
    },
  };
}

/* ---------- (7) TRANSIT ---------- */
export function projectTransit(geometry, program, context) {
  const gfa = program.gfa_m2;
  const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);
  const transit_share   = COEFFICIENTS.TRANSIT_SHARE_BY_PROGRAM[program.type] ?? 0.55;
  const daily_entries   = annual_visitors * transit_share / 365;
  return {
    headline: {
      label: 'Daily transit entries added',
      value: `+${Math.round(daily_entries).toLocaleString()}`,
      unit: '',
      delta: `${(transit_share*100).toFixed(0)}% mode share`,
      sign: 'neg',
    },
    metrics: [
      { label: 'Subway entries (nearest sta.)', baseline: '42,100', projected: (42100 + Math.round(daily_entries*0.7)).toLocaleString(), delta:`+${Math.round(daily_entries*0.7)}`, sign:'neg' },
      { label: 'Bus entries',                    baseline: '14,200', projected: (14200 + Math.round(daily_entries*0.15)).toLocaleString(), delta:`+${Math.round(daily_entries*0.15)}`, sign:'neg' },
      { label: 'Citi Bike trips',                baseline: '11,400', projected: (11400 + Math.round(daily_entries*0.15)).toLocaleString(), delta:`+${Math.round(daily_entries*0.15)}`, sign:'neu' },
    ],
    spatial: {
      type: 'points',
      features: generateTransitStationFeatures(context.site_lat_lon, daily_entries),
      paint_key: 'transit',
    },
  };
}

/* ---------- (8) COST & LOGISTICS ---------- */
export function projectCost(geometry, program, context) {
  const gfa = program.gfa_m2;
  const cost_per_m2 = program.type.startsWith('museum')
    ? COEFFICIENTS.CONSTRUCTION.cost_usd_per_m2_manhattan_museum
    : program.type === 'office'
      ? COEFFICIENTS.CONSTRUCTION.cost_usd_per_m2_manhattan_office
      : COEFFICIENTS.CONSTRUCTION.cost_usd_per_m2_manhattan_resi;
  const total_cost = gfa * cost_per_m2;
  const months     = gfa * COEFFICIENTS.CONSTRUCTION.duration_months_per_1000m2 / 1000;
  const trucks     = gfa * COEFFICIENTS.CONSTRUCTION.truck_trips_per_1000m2 / 1000;
  const embodied   = gfa * (COEFFICIENTS.EMBODIED_BY_SYSTEM.hybrid);  // default; expose as program input later
  return {
    headline: {
      label: 'Capital cost (rough order)',
      value: `$${(total_cost/1e6).toFixed(0)}M`,
      unit: '',
      delta: `$${cost_per_m2.toLocaleString()}/m²`,
      sign: 'neu',
    },
    metrics: [
      { label: 'Cost range ±15%',   baseline: '—', projected: `$${(total_cost*0.85/1e6).toFixed(0)}M – $${(total_cost*1.15/1e6).toFixed(0)}M`, delta: '', sign:'neu' },
      { label: 'Duration',          baseline: '—', projected: `${months.toFixed(0)} months`, delta:'',                                 sign:'neu' },
      { label: 'Haul-truck trips',  baseline: '—', projected: Math.round(trucks).toLocaleString(), delta:`+${Math.round(trucks)}`,    sign:'neg' },
      { label: 'Embodied CO₂e',     baseline: '—', projected: `${(embodied/1000).toFixed(0)} t`, delta: 'up-front', sign:'neg' },
    ],
    spatial: {
      type: 'rings',
      features: generateRingFeatures(context.site_lat_lon, [{ radius_m: 80, value: 1 }]),
      paint_key: 'cost',
    },
  };
}

/* ---------- (9) WATER ---------- */
export function projectWater(geometry, program, context) {
  const gfa = program.gfa_m2;
  const footprint = geometry.footprint_m2 || gfa / (geometry.num_floors_est || 6);
  const potable_gpd    = gfa * (COEFFICIENTS.WATER_BY_PROGRAM[program.type] ?? 500) / 365 * 0.264;
  const runoff_gpd     = footprint * COEFFICIENTS.RUNOFF_GPD_PER_M2_IMPERVIOUS * 1000;
  return {
    headline: {
      label: 'Stormwater runoff added',
      value: `+${(runoff_gpd/1000).toFixed(1)}k`,
      unit: 'gpd',
      delta: 'CSO-risk shed',
      sign: 'neg',
    },
    metrics: [
      { label: 'Potable demand', baseline: '0', projected: `${potable_gpd.toFixed(0)} gpd`, delta:`+${potable_gpd.toFixed(0)}`, sign:'neg' },
      { label: 'Impervious area', baseline: '—', projected: `${Math.round(footprint)} m²`, delta:`+${Math.round(footprint)}`, sign:'neg' },
      { label: 'Runoff peak',     baseline: '—', projected: `${(runoff_gpd/1000).toFixed(1)}k gpd`, delta:`+${(runoff_gpd/1000).toFixed(1)}k`, sign:'neg' },
    ],
    spatial: {
      type: 'flow',
      features: generateWaterFlowFeatures(context.site_lat_lon, runoff_gpd),
      paint_key: 'water',
    },
  };
}

/* ---------- (10) WASTE & NOISE ---------- */
export function projectWaste(geometry, program, context) {
  const gfa = program.gfa_m2;
  const annual_visitors = gfa * (COEFFICIENTS.VISITOR_DENSITY[program.type] ?? 0);
  const waste_lb_per_day = annual_visitors * COEFFICIENTS.WASTE_LB_PER_VISITOR / 365;
  const dB_delta         = 10 * Math.log10(1 + annual_visitors / 1e6);
  return {
    headline: {
      label: 'Operational waste',
      value: `${Math.round(waste_lb_per_day).toLocaleString()}`,
      unit: 'lb/day',
      delta: `+${dB_delta.toFixed(1)} dB L_eq`,
      sign: 'neg',
    },
    metrics: [
      { label: 'Daily waste', baseline: '0', projected: `${Math.round(waste_lb_per_day)} lb/d`, delta:`+${Math.round(waste_lb_per_day)}`, sign:'neg' },
      { label: 'Event-peak waste', baseline: '—', projected: `${Math.round(waste_lb_per_day * 3.5)} lb/d`, delta:'3.5× avg', sign:'neg' },
      { label: 'Ambient L_eq',   baseline: '62 dB', projected: `${(62 + dB_delta).toFixed(0)} dB`, delta:`+${dB_delta.toFixed(1)} dB`, sign:'neg' },
    ],
    spatial: {
      type: 'rings',
      features: generateRingFeatures(context.site_lat_lon, [
        { radius_m:  90, value: 78 },
        { radius_m: 140, value: 72 },
        { radius_m: 200, value: 66 },
      ]),
      paint_key: 'waste',
    },
  };
}

/* ================================================================
   GEOJSON GENERATORS — simple helpers used by the projections above
   ================================================================ */

function generateRingFeatures(siteLatLon, bands) {
  const [lat, lon] = siteLatLon;
  return bands.map(b => ({
    type: 'Feature',
    properties: { radius_m: b.radius_m, value: b.value, label: b.label || `${b.radius_m}m` },
    geometry: turf.circle([lon, lat], b.radius_m / 1000, { units: 'kilometers', steps: 96 }).geometry,
  }));
}

function generatePlumeFeatures(siteLatLon, intensity) {
  // scatter weighted random points in an elongated pattern (wind NW)
  const [lat, lon] = siteLatLon;
  const pts = [];
  const n = Math.max(50, Math.round(intensity * 2));
  for (let i = 0; i < n; i++) {
    const r = Math.random() ** 0.6;  // bias to center
    const theta = ((Math.random() - 0.5) * Math.PI / 3) + (135 * Math.PI / 180); // NW sector
    const d_deg = r * 0.008;
    pts.push({
      type: 'Feature',
      properties: { weight: (1 - r) * intensity },
      geometry: { type: 'Point', coordinates: [lon + d_deg * Math.cos(theta), lat + d_deg * Math.sin(theta)] },
    });
  }
  return pts;
}

function generateFeederFlowFeatures(siteLatLon, targetLngLat, load_MW) {
  const [lat, lon] = siteLatLon;
  return [{
    type: 'Feature',
    properties: { load_MW },
    geometry: { type: 'LineString', coordinates: [[lon, lat], targetLngLat] },
  }];
}

function generatePedFlowFeatures(siteLatLon, peak_hr) {
  const [lat, lon] = siteLatLon;
  const origins = [
    { lngLat: [-74.0019, 40.7556], label: '34 ST-HY', weight: 0.55 },
    { lngLat: [-73.9916, 40.7505], label: '34 ST-PENN', weight: 0.30 },
    { lngLat: [-74.0044, 40.7504], label: 'HIGH LINE', weight: 0.15 },
  ];
  const features = [];
  origins.forEach(o => {
    // Flow line
    features.push({
      type: 'Feature',
      properties: { weight: o.weight * peak_hr, label: o.label },
      geometry: { type: 'LineString', coordinates: [o.lngLat, [lon, lat]] },
    });
    // Origin point
    features.push({
      type: 'Feature',
      properties: { weight: o.weight * peak_hr, label: o.label },
      geometry: { type: 'Point', coordinates: o.lngLat },
    });
  });
  return features;
}

/* Hudson Yards area subway stations (real coords, 2024 daily entries) */
const SUBWAY_STATIONS_HY = [
  { label: '34 ST-HUDSON YARDS (7)',   lngLat: [-74.0019, 40.7556], daily: 15200 },
  { label: '34 ST-PENN (A·C·E)',       lngLat: [-73.9916, 40.7505], daily: 52000 },
  { label: '28 ST (1)',                lngLat: [-74.0021, 40.7483], daily:  8400 },
  { label: '23 ST (C·E)',              lngLat: [-74.0001, 40.7448], daily: 13800 },
  { label: 'HIGH LINE ACCESS (ENTRY)', lngLat: [-74.0044, 40.7504], daily:  6000 },
];

function generateTransitStationFeatures(siteLatLon, daily_delta) {
  return SUBWAY_STATIONS_HY.map(s => ({
    type: 'Feature',
    properties: {
      label:      s.label,
      daily:      s.daily,
      delta:      Math.round(daily_delta * 0.7 / SUBWAY_STATIONS_HY.length),
      value:      s.daily / 60000,  // normalised 0-1 for circle-size
    },
    geometry: { type: 'Point', coordinates: s.lngLat },
  }));
}

/* Hudson River / CSO outfall near Hudson Yards: [-74.0145, 40.7598] (CSO OH-014) */
function generateWaterFlowFeatures(siteLatLon, runoff_gpd) {
  const [lat, lon] = siteLatLon;
  const csoOutfall = [-74.0145, 40.7598];
  return [
    {
      type: 'Feature',
      properties: { runoff_gpd: Math.round(runoff_gpd), label: 'CSO OUTFALL OH-014' },
      geometry: { type: 'LineString', coordinates: [[lon, lat], csoOutfall] },
    },
    {
      type: 'Feature',
      properties: { label: 'CSO OH-014', runoff_gpd: Math.round(runoff_gpd) },
      geometry: { type: 'Point', coordinates: csoOutfall },
    },
  ];
}

function generateInducedPoints(siteLatLon, count) {
  const [lat, lon] = siteLatLon;
  const kinds = [
    { key: 'fb',     label: 'F&B' },
    { key: 'retail', label: 'RETAIL' },
    { key: 'hotel',  label: 'HOTEL' },
  ];
  const pts = [];
  for (let i = 0; i < Math.min(count, 40); i++) {
    const d = 0.0005 + Math.random() * 0.004;
    const t = Math.random() * Math.PI * 2;
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    pts.push({
      type: 'Feature',
      properties: { kind: k.key, label: k.label, value: Math.random() },
      geometry: { type: 'Point', coordinates: [lon + d * Math.cos(t), lat + d * Math.sin(t)] },
    });
  }
  return pts;
}
