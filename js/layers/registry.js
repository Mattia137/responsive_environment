/* =========================================================================
   ALLSPARK // IMPACT  ·  js/layers/registry.js
   Canonical list of impact layers — everything else references this.
   ========================================================================= */

export const LAYERS = [
  { id: 'air',           name: 'AIR QUALITY',            unit: 'µg/m³',         render: 'heatmap'    },
  { id: 'power',         name: 'POWER SUPPLY',            unit: 'MWh/yr',        render: 'flow'       },
  { id: 'pedestrian',    name: 'PEDESTRIAN TRAFFIC',      unit: 'visitors/day',  render: 'points+flow'},
  { id: 'rent',          name: 'RENT & PROPERTY VALUE',   unit: '$/sf·mo',       render: 'rings'      },
  { id: 'displacement',  name: 'DISPLACEMENT RISK',       unit: 'households',    render: 'choropleth' },
  { id: 'induced',       name: 'INDUCED DEMAND',          unit: 'businesses',    render: 'points'     },
  { id: 'transit',       name: 'TRANSIT PRESSURE',        unit: 'riders/day',    render: 'points'     },
  { id: 'cost',          name: 'PROJECT COST & LOGISTICS', unit: 'USD',          render: 'rings'      },
  { id: 'water',         name: 'WATER & STORMWATER',      unit: 'gpd',           render: 'flow'       },
  { id: 'waste',         name: 'WASTE & NOISE',           unit: 'dB / lb/day',   render: 'rings'      },
];

/* Short descriptions + sources for the left-panel expand detail */
export const LAYER_DETAILS = {
  air: {
    note: 'Construction-phase PM2.5 spike dominates near-term impact; HVAC NOₓ and induced vehicle trips drive steady-state.',
    sources: ['EPA AirNow API', 'NYC DOHMH NYCCAS', 'EPA EJScreen'],
  },
  power: {
    note: 'Load derived from LL84 EUI benchmarks for program class. Chelsea substation assumed as feeder; replace with real Con Edison service area if available.',
    sources: ['NYC LL84 Energy Disclosure', 'NYC LL97 limits (Cultural 2024–29)', 'Con Edison Load Maps'],
  },
  pedestrian: {
    note: 'Visitor count from program-specific benchmarks (The Shed, Whitney, MoMA PS1). Peak-hour concentration factor 0.0016.',
    sources: ['NYC DOT Pedestrian Volumes', 'MTA Station Entries', 'Replica / SafeGraph mobility'],
  },
  rent: {
    note: 'Anchor-effect rent uplift from Furman Center meta-analysis, scaled by sqrt(gfa/15000).',
    sources: ['MapPLUTO', 'NYC DOF Rolling Sales', 'StreetEasy ZORI', 'HUD FMR', 'Furman Center'],
  },
  displacement: {
    note: 'Inverse of rent story — rising rents push out long-tenured, lower-income, non-white households.',
    sources: ['ACS 5-yr Census', 'NYC HVS', 'HPD Eviction Filings', 'DCP Rent-Stabilized Estimates'],
  },
  induced: {
    note: 'New storefront viability driven by projected visitor spend; chain-share typically rises with anchor proximity.',
    sources: ['NYC DOF Business Registrations', 'DCP Storefront Tracker', 'Yelp Fusion API', 'NYC SBS CDNA'],
  },
  transit: {
    note: 'Transit share 0.55–0.70 depending on program class. 7-train station the likely constraint for Hudson Yards sites.',
    sources: ['MTA Daily Ridership', 'MTA Bus Performance', 'Citi Bike System Data', 'NYMTC regional model'],
  },
  cost: {
    note: 'Turner Cost Index × Manhattan museum benchmark. Cost scales with GFA; embodied carbon with structural system choice.',
    sources: ['NYC DOB Job Filings', 'Turner Cost Index', 'ENR Building Cost Index', 'EC3 Building Transparency'],
  },
  water: {
    note: 'Runoff derived from Atlas 14 2-yr design storm × impervious footprint. CSO risk flag if outfall within 500m.',
    sources: ['NYC DEP CSO Outfalls', 'NOAA Atlas 14', 'USGS StreamStats', 'NYC Green Infrastructure Plan'],
  },
  waste: {
    note: 'Waste from visitor benchmark; dB delta from logarithmic ambient-vs-event-peak. Loading-dock siting matters most.',
    sources: ['NYC DSNY Commercial Waste Zones', 'NYC SoundScore', 'NYC 311 Noise Complaints'],
  },
};
