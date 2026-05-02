/* =========================================================================
   ALLSPARK // IMPACT  ·  config.js
   API keys + site defaults. This file is gitignored.
   ========================================================================= */

export const CONFIG = {
  /* REQUIRED — add your key here for local dev; Vercel sets it via /api/config */
  MAPTILER_KEY: 'WWwr7EfWrAAHDMrvyQMk',  // ← paste your key here: https://cloud.maptiler.com/account/keys/

  /* OPTIONAL — layer works without these, using benchmark fallbacks */
  AIRNOW_KEY:   '',                                // https://docs.airnowapi.org/account/request/
  OPENWEATHER_KEY: '',                             // https://openweathermap.org/api (for wind direction)
  YELP_KEY:     '',                                // https://www.yelp.com/developers/v3 (induced demand)
  CENSUS_KEY:   '',                                // https://api.census.gov/data/key_signup.html (ACS)

  /* GLOBE INTRO — camera starts here every load (USA visible) */
  DEFAULT_CENTER: [-98.5795, 39.8283],
  DEFAULT_ZOOM:   3.5,
  DEFAULT_PITCH:  0,
  DEFAULT_BEARING: 0,

  /* SITE — camera flies here after GLB loads */
  SITE_CENTER:  [-74.006307, 40.753891],
  SITE_ZOOM:    16.2,
  SITE_PITCH:   62,
  SITE_BEARING: -18,

  /* GLB placement — matches reference site (2GBX_environment-2) exactly */
  GLB_ORIGIN: { lng: -74.006649, lat: 40.754283 },

  /* MODEL RADII */
  IMPACT_RADIUS_M: 400,                            // primary ring for rent/displacement/induced
  STUDY_RADIUS_M:  1200,                           // outer data-fetch bbox

  /* Default massing file — auto-loaded on startup */
  DEFAULT_GLB: 'site_building.glb',
};
