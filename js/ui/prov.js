/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/prov.js
   Shared provenance utilities — dot renderer + tooltip copy.
   ========================================================================= */

export const PROV_TOOLTIP = {
  MEASURED:  'Live API reading — reflects real-world conditions at time of fetch.',
  MODELED:   'Computed from a live data reading combined with benchmark coefficients.',
  BENCHMARK: 'Derived from benchmark coefficients only. No live data source connected.',
  SYNTHETIC: 'Placeholder value — no real data source integrated. Treat as illustrative.',
};

/* Returns an inline HTML string: a small colored dot with a native tooltip. */
export function provDot(prov) {
  if (!prov) return '';
  const tip = PROV_TOOLTIP[prov] ?? '';
  return `<span class="prov-dot" data-prov="${prov}" title="${prov}: ${tip}" aria-label="${prov}"></span>`;
}
