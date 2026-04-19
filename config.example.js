/* =========================================================================
   ALLSPARK // IMPACT  ·  config.example.js
   Copy to config.js and fill in your keys. config.js is gitignored.
   ========================================================================= */

export const CONFIG = {
  /* REQUIRED */
  MAPTILER_KEY: typeof process !== 'undefined' ? process.env.MAPTILER_API : 'YOUR_MAPTILER_KEY_HERE',         // https://cloud.maptiler.com/account/keys/

  /* OPTIONAL — layer works without these, using benchmark fallbacks */
  AIRNOW_KEY:   '',                                // https://docs.airnowapi.org/account/request/
  OPENWEATHER_KEY: '',                             // https://openweathermap.org/api (for wind direction)
  YELP_KEY:     '',                                // https://www.yelp.com/developers/v3 (induced demand)
  CENSUS_KEY:   '',                                // https://api.census.gov/data/key_signup.html (ACS)

  /* SITE DEFAULTS — user override via URL hash / panel inputs */
  DEFAULT_CENTER: [-74.0027, 40.7536],             // Hudson Yards [lng, lat]
  DEFAULT_ZOOM:   15.8,
  DEFAULT_PITCH:  55,
  DEFAULT_BEARING: -18,

  /* MODEL RADII */
  IMPACT_RADIUS_M: 400,                            // primary ring for rent/displacement/induced
  STUDY_RADIUS_M:  1200,                           // outer data-fetch bbox
};
