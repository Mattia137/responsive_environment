/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/theme.js
   Enforces dark theme (reference site style).
   ========================================================================= */

export function initTheme(state) {
  document.documentElement.setAttribute('data-theme', 'dark');
  state.theme = 'dark';
}

export function onThemeChange(fn) { 
  // No-op, theme is locked
}
