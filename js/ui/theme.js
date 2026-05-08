/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/theme.js
   Light theme — enforces the precision-instrument light aesthetic.
   ========================================================================= */

export function initTheme(state) {
  document.documentElement.removeAttribute('data-theme');
  state.theme = 'light';
}

export function onThemeChange(_fn) {
  // No-op — theme is fixed to light
}
