/* =========================================================================
   ALLSPARK // IMPACT  ·  js/ui/panel-massing.js
   Wires the massing + program controls on the right panel.
   ========================================================================= */

import { loadGLB, clearMassing } from '../massing.js';

let _listeners = [];
export function onMassingUpdate(fn) { _listeners.push(fn); }
function emit(update) { _listeners.forEach(fn => fn(update)); }

export function initMassingControls(state) {
  const input  = document.getElementById('glb-input');
  const btnLoad = document.getElementById('btn-load-glb');
  const btnClr  = document.getElementById('btn-clear-glb');
  const dz      = document.getElementById('drop-zone');

  /* ---- File picker + drag-drop ---- */
  btnLoad.addEventListener('click', () => input.click());
  if (dz) {
    dz.addEventListener('click', () => input.click());
    ['dragenter','dragover'].forEach(evt =>
      dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.add('drag-over'); })
    );
    ['dragleave','drop'].forEach(evt =>
      dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.remove('drag-over'); })
    );
    dz.addEventListener('drop', async (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (f && (f.name.endsWith('.glb') || f.name.endsWith('.gltf'))) await handleFile(f);
    });
  }

  input.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) await handleFile(f);
  });

  btnClr.addEventListener('click', () => {
    emit({ clear: true });
    document.getElementById('massing-status').textContent = 'NOT LOADED';
    const dzEl = document.getElementById('drop-zone');
    if (dzEl) dzEl.classList.remove('hidden');
    btnClr.disabled = true;
    setDerived(null);
  });

  /* ---- Transform inputs ---- */
  const wireNum = (sel, key, fmt = parseFloat) => {
    const el = document.getElementById(sel);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = fmt(el.value);
      emit({ transform: { [key]: v } });
    });
  };
  wireNum('in-lat', 'anchor_lat', parseFloat);
  wireNum('in-lon', 'anchor_lon', parseFloat);
  wireNum('in-z',   'vertical_offset_m', parseFloat);
  wireNum('in-scale', 'uniform_scale',   parseFloat);

  const rotEl = document.getElementById('in-rot');
  const rotV  = document.getElementById('v-rot');
  if (rotEl) {
    rotEl.addEventListener('input', () => {
      const v = parseFloat(rotEl.value);
      if (rotV) rotV.textContent = v + '°';
      emit({ transform: { rotation_deg: v } });
    });
  }

  /* ---- Program spec ---- */
  const progEls = {
    program_type:            document.getElementById('in-program'),
    gfa_m2:                  document.getElementById('in-gfa'),
    operating_hours_per_week: document.getElementById('in-hours'),
    admission_price_usd:     document.getElementById('in-price'),
    staff_count:             document.getElementById('in-staff'),
  };
  Object.entries(progEls).forEach(([key, el]) => {
    if (!el) return;
    el.addEventListener('input', () => {
      const val = el.tagName === 'SELECT' ? el.value : parseFloat(el.value);
      emit({ program: { [key === 'program_type' ? 'type' : key]: val } });
    });
  });
}

export async function handleFile(f) {
  document.getElementById('massing-status').textContent = 'LOADING…';
  try {
    const geometry = await loadGLB(f);
    document.getElementById('massing-status').textContent = 'LOADED';
    const dzEl = document.getElementById('drop-zone');
    if (dzEl) dzEl.classList.add('hidden');
    const btnClr = document.getElementById('btn-clear-glb');
    if (btnClr) btnClr.disabled = false;
    setDerived(geometry);
    // Use floor-sliced GFA (5 m floors) when available
    const gfa = geometry.total_gfa
      ? Math.round(geometry.total_gfa)
      : Math.round(geometry.footprint_m2 * geometry.num_floors_est * 0.85);
    const gfaEl = document.getElementById('in-gfa');
    if (gfaEl) gfaEl.value = gfa;
    return { geometry, gfa };
  } catch (err) {
    console.error(err);
    document.getElementById('massing-status').textContent = 'FAILED';
    return null;
  }
}

export function setDerived(geometry) {
  const fmt = (n, u) => n ? `${Math.round(n).toLocaleString()} ${u}` : `— ${u}`;
  const fp = document.getElementById('out-footprint');
  const ht = document.getElementById('out-height');
  const vo = document.getElementById('out-volume');
  const fl = document.getElementById('out-floors');
  if (fp) fp.textContent = fmt(geometry?.footprint_m2, 'm²');
  if (ht) ht.textContent = fmt(geometry?.height_m, 'm');
  if (vo) vo.textContent = fmt(geometry?.volume_m3, 'm³');
  // Show floor-sliced GFA next to floors count
  const gfaSliced = geometry?.total_gfa ? ` · ${Math.round(geometry.total_gfa).toLocaleString()} m² GFA` : '';
  if (fl) fl.textContent = geometry?.num_floors_est ? `${geometry.num_floors_est}${gfaSliced}` : '—';
}
