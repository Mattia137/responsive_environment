/* =========================================================================
   ALLSPARK // IMPACT  ·  ui/theme.js
   Dark / light theme toggle with localStorage persistence.
   ========================================================================= */

const KEY = 'allspark-theme';
let _listeners = [];

export function initTheme(state) {
  const saved = localStorage.getItem(KEY) || 'dark';
  applyTheme(saved);
  state.theme = saved;
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    document.body.classList.add('theme-transitioning');
    applyTheme(next);
    localStorage.setItem(KEY, next);
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 220);
    _listeners.forEach(fn => fn(next));
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function onThemeChange(fn) { _listeners.push(fn); }
