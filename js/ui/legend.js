/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/legend.js
   Floating map legend — one layer at a time, positioned bottom-left of map.
   ========================================================================= */

export function showLegend({ title, gradient, items, note }) {
  const el = document.getElementById('map-legend');
  if (!el) return;

  let html = `<div class="legend-title">${title}</div>`;

  if (gradient) {
    const { stops, min, max, unit } = gradient;
    const gradCss = stops.map(s => `${s.color} ${(s.at * 100).toFixed(0)}%`).join(',');
    html += `
      <div class="legend-gradient-bar" style="background:linear-gradient(to right,${gradCss})"></div>
      <div class="legend-range">
        <span>${min}</span>
        <span class="legend-unit">${unit}</span>
        <span>${max}</span>
      </div>`;
  }

  if (items && items.length) {
    html += '<div class="legend-items">';
    items.forEach(({ color, label, value }) => {
      html += `<div class="legend-item">
        <span class="legend-swatch" style="background:${color};border-color:${color}88"></span>
        <span class="legend-lbl">${label}</span>
        ${value != null ? `<span class="legend-val">${value}</span>` : ''}
      </div>`;
    });
    html += '</div>';
  }

  if (note) {
    html += `<div class="legend-note">${note}</div>`;
  }

  el.innerHTML = html;
  el.classList.remove('hidden');
}

export function hideLegend() {
  const el = document.getElementById('map-legend');
  if (el) el.classList.add('hidden');
}
