/* =========================================================================
   ALLSPARK // IMPACT  ·  config.js
   API keys + site defaults. This file is gitignored.
   ========================================================================= */

export const CONFIG = {
  /* REQUIRED */
  MAPTILER_KEY: typeof process !== 'undefined' ? (process.env.MAPTILER_API_01 || process.env.MAPTILER_API) : '', 

  /* OPTIONAL — layer works without these, using benchmark fallbacks */
  AIRNOW_KEY:   '',                                // https://docs.airnowapi.org/account/request/
  OPENWEATHER_KEY: '',                             // https://openweathermap.org/api (for wind direction)
  YELP_KEY:     '',                                // https://www.yelp.com/developers/v3 (induced demand)
  CENSUS_KEY:   '',                                // https://api.census.gov/data/key_signup.html (ACS)

  /* SITE DEFAULTS */
  DEFAULT_CENTER: [-74.006307, 40.753891],         // [lng, lat] — user's site coordinates
  DEFAULT_ZOOM:   16.2,
  DEFAULT_PITCH:  62,
  DEFAULT_BEARING: -18,

  /* GLB placement — matches reference site (2GBX_environment-2) exactly */
  GLB_ORIGIN: { lng: -74.006649, lat: 40.754283 },

  /* MODEL RADII */
  IMPACT_RADIUS_M: 400,                            // primary ring for rent/displacement/induced
  STUDY_RADIUS_M:  1200,                           // outer data-fetch bbox

  /* Default massing file — auto-loaded on startup */
  DEFAULT_GLB: 'site_building.glb',
};
