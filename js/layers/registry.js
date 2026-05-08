/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/registry.js
   Canonical list of impact layers — everything else references this.
   ========================================================================= */

export const LAYER_CATEGORIES = {
  env: { label: 'Environment', color: 'var(--c-env)' },
  eco: { label: 'Economic',    color: 'var(--c-eco)' },
  log: { label: 'Logistics & Access', color: 'var(--c-log)' },
};

export const LAYERS = [
  { id: 'solar',        name: 'Solar Exposure',       unit: 'kWh/m²/d',     render: 'polygon',    category: 'env', swatch: '#e8b84b' },
  { id: 'vegetation',   name: 'Green Coverage',        unit: 'm² green',     render: 'fill',       category: 'env', swatch: '#7dc47d' },
  { id: 'shadow',       name: 'Shadow Cast',           unit: 'm shadow',     render: 'polygon',    category: 'env', swatch: '#9aa0a8' },
  { id: 'air',          name: 'Air Quality',           unit: 'µg/m³',        render: 'heatmap',    category: 'env', swatch: '#70c8d8' },

  { id: 'carbon',       name: 'Carbon Output',         unit: 'tCO₂e/yr',    render: 'rings',      category: 'eco', swatch: '#c46060' },
  { id: 'power',        name: 'Energy Demand',         unit: 'MWh/yr',       render: 'flow',       category: 'eco', swatch: '#6dbf9e' },
  { id: 'water',        name: 'Water Use',             unit: 'gpd',          render: 'flow',       category: 'eco', swatch: '#6090d4' },
  { id: 'rent',         name: 'Property Value',        unit: '$/sf·mo',      render: 'rings',      category: 'eco', swatch: '#b07ad8' },
  { id: 'cost',         name: 'Project Cost',          unit: 'USD',          render: 'rings',      category: 'eco', swatch: '#d4845a' },
  { id: 'waste',        name: 'Waste & Noise',         unit: 'dB / lb/day',  render: 'rings',      category: 'eco', swatch: '#c46060' },

  { id: 'biodiversity', name: 'Biodiversity',          unit: 'occurrences',  render: 'points',     category: 'log', swatch: '#b07ad8' },
  { id: 'pedestrian',   name: 'Pedestrian Flow',       unit: 'visitors/day', render: 'points+flow',category: 'log', swatch: '#7bb8d4' },
  { id: 'displacement', name: 'Displacement Risk',     unit: 'households',   render: 'choropleth', category: 'log', swatch: '#d4845a' },
  { id: 'induced',      name: 'Induced Demand',        unit: 'businesses',   render: 'points',     category: 'log', swatch: '#9aa0a8' },
  { id: 'transit',      name: 'Transit Pressure',      unit: 'riders/day',   render: 'points',     category: 'log', swatch: '#7bb8d4' },
];

/* Short descriptions + sources for the Wrap Inspector */
export const LAYER_DETAILS = {
  air: {
    note: 'Construction-phase PM2.5 spike dominates near-term impact; HVAC NOₓ and induced vehicle trips drive steady-state.',
    sources: ['EPA AirNow API', 'NYC DOHMH NYCCAS', 'EPA EJScreen'],
  },
  solar: {
    note: 'Solar access calculated using SunCalc for the site latitude, adjusted by massing shadow geometry.',
    sources: ['SunCalc (JS library)', 'Three.js raycasting', 'Open-Meteo solar radiation'],
  },
  carbon: {
    note: 'Embodied carbon from structural system × volume; operational carbon from GFA × EUI benchmark by program type.',
    sources: ['EC3 Building Transparency', 'ASHRAE 90.1', 'IPCC AR6 emission factors'],
  },
  vegetation: {
    note: 'Green cover derived from MapTiler landcover vector tiles clipped to the impact boundary.',
    sources: ['MapTiler landcover', 'OpenStreetMap', 'Copernicus Land Monitoring Service'],
  },
  biodiversity: {
    note: 'Species occurrence count from GBIF within the impact polygon boundary.',
    sources: ['GBIF Occurrence API', 'iNaturalist', 'eBird'],
  },
  shadow: {
    note: 'Shadow polygons computed for 09:00, 12:00, and 15:00 at the site latitude on the equinox.',
    sources: ['SunCalc (JS library)', 'Three.js raycasting'],
  },
  power: {
    note: 'Load derived from LL84 EUI benchmarks for program class. Replace with real utility service area if available.',
    sources: ['NYC LL84 Energy Disclosure', 'NYC LL97 limits', 'ASHRAE 90.1 EUI benchmarks'],
  },
  pedestrian: {
    note: 'Visitor count from program-specific benchmarks. Peak-hour concentration factor 0.0016.',
    sources: ['NYC DOT Pedestrian Volumes', 'MTA Station Entries', 'SafeGraph mobility'],
  },
  rent: {
    note: 'Anchor-effect rent uplift from Furman Center meta-analysis, scaled by sqrt(gfa/15000).',
    sources: ['MapPLUTO', 'NYC DOF Rolling Sales', 'Furman Center'],
  },
  displacement: {
    note: 'Inverse of rent story — rising rents push out long-tenured, lower-income households.',
    sources: ['ACS 5-yr Census', 'NYC HVS', 'HPD Eviction Filings'],
  },
  induced: {
    note: 'New storefront viability driven by projected visitor spend.',
    sources: ['NYC DOF Business Registrations', 'NYC SBS CDNA'],
  },
  transit: {
    note: 'Transit share 0.55–0.70 depending on program class.',
    sources: ['MTA Daily Ridership', 'MTA Bus Performance', 'NYMTC regional model'],
  },
  cost: {
    note: 'Turner Cost Index × Manhattan museum benchmark. Cost scales with GFA; embodied carbon with structural system choice.',
    sources: ['Turner Cost Index', 'ENR Building Cost Index', 'EC3 Building Transparency'],
  },
  water: {
    note: 'Runoff derived from Atlas 14 2-yr design storm × impervious footprint.',
    sources: ['NYC DEP CSO Outfalls', 'NOAA Atlas 14', 'USGS StreamStats'],
  },
  waste: {
    note: 'Waste from visitor benchmark; dB delta from logarithmic ambient-vs-event-peak.',
    sources: ['NYC DSNY Commercial Waste Zones', 'NYC SoundScore'],
  },
};
