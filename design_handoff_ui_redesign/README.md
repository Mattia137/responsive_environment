# Handoff: ALLSPARK // IMPACT — UI Redesign (Light Theme)

## Overview

This package documents a complete UI and style system redesign for the ALLSPARK // IMPACT platform — a parametric urban impact projection tool for architects and builders. The platform visualises multiple environmental, economic, and logistics datasets as layers on a 3D MapTiler map, and allows users to upload a building massing model (GLB) to compute the projected impact of a design on its site.

The redesign moves from the current dark "tactical HUD" aesthetic to a **light, precision-instrument theme** that maximises data readability on the map surface.

---

## About the Design Files

The files in this bundle (`direction-b.html`) are **HTML design references** — interactive prototypes showing the intended look, layout, and behaviour. They are **not production code to copy directly**.

Your task is to **recreate these designs inside the existing codebase** (`responsive_environment/`), which uses vanilla JS ES modules, MapTiler SDK, Three.js, and a CSS custom-property system split across `css/base.css`, `css/layout.css`, and `css/components.css`. Implement the new design tokens and component styles there — do not ship the HTML prototype directly.

---

## Fidelity

**High-fidelity.** The prototype uses final colours, typography, spacing, and interactions. Recreate the UI pixel-accurately using the codebase's existing HTML/CSS/JS structure.

---

## Design Concept

**Direction B — Command**

A map-first layout with:
- A **persistent collapsible left panel** (272 px) for layers, program spec, and geometry controls, with three tabs at the top
- A **persistent collapsible right panel** (296 px) for impact readouts and massing controls, driven by the active mode
- A **slim header bar** (52 px) carrying: brand, mode toggle, time scrubber, search, and panel-toggle buttons
- A **thin footer** (30 px) showing scenario/program status
- **Map HUD overlays** (coords, zoom, active layers) that shift position when panels collapse

---

## Screens / Views

### 1. Full App Shell

**Layout**
```
┌──────────────── HEADER (52px) ────────────────┐
│ Brand | Mode toggle | Scrubber | Search | Meta │
├────────────┬──────── MAP ────────┬─────────────┤
│ LEFT PANEL │                     │ RIGHT PANEL │
│  272px     │    (fills remain.)  │   296px     │
│            │                     │             │
├────────────┴──────── FOOTER ─────┴─────────────┤
│             Status bar (30px)                   │
└─────────────────────────────────────────────────┘
```

- Both panels collapse to 0 width via CSS `transition: width 0.22s cubic-bezier(0.4,0,0.2,1)`
- Map HUD overlays reposition (CSS transition matching panel width) when panels toggle
- `overflow: hidden` on panels; inner content at fixed width so content doesn't reflow during animation

---

### 2. Header

**Height:** 52 px  
**Background:** `var(--bg-panel)` = `oklch(98.5% 0.004 60)` ≈ `#faf9f7`  
**Border-bottom:** `1px solid var(--ln-1)` = `oklch(92% 0.005 55)` ≈ `#eae8e4`

**Sections (left → right, separated by `1px solid var(--ln-1)` borders):**

#### Brand
- Padding: `0 20px`
- `ALLSPARK` — DM Sans 12px / weight 600 / tracking 0.1em / uppercase / `var(--ink-1)`
- `//` — vermillion `var(--red)` = `oklch(58% 0.20 28)` ≈ `#c94e2a`, font-size 14px / weight 400
- `IMPACT` — DM Sans 12px / weight 300 / tracking 0.08em / uppercase / `var(--ink-3)` ≈ `#8a8480`

#### Mode Toggle
- Padding: `0 14px`, gap `3px`
- Three buttons: `layers` / `massing` / `impact`
- Font: DM Sans 10px / weight 400 / tracking 0.1em / uppercase
- **Inactive:** transparent bg, transparent border, color `var(--ink-3)`
- **Active:** bg `var(--red-ghost)` = `oklch(95% 0.04 28)` ≈ `#fdf0ec`, border `1px solid var(--red-dim)` = `oklch(70% 0.12 28)` ≈ `#d8937c`, color `var(--red)`, weight 500
- Border-radius: 3px; transition: `all 0.12s`

#### Time Scrubber (flex: 1)
- 5 steps: BASELINE T0 / BUILD T1 / OPEN +1Y / SETTLED +5Y / HORIZON +20Y
- Horizontal track: `1px solid var(--ln-2)` with a filled portion in `var(--red)`
- Step dots: 11×11px circle, border 1.5px
  - **Past (filled):** border `var(--red)`, bg `var(--bg-panel)`
  - **Active:** bg `var(--red)`, border `var(--red)`, box-shadow `0 0 0 3px var(--red-ghost)`
  - **Future:** border `var(--ln-3)`, bg `var(--bg-panel)`
- Label above dot: DM Sans 8px / tracking 0.12em / uppercase — active is `var(--red)` weight 600, others `var(--ink-4)`
- Sub-label below dot: DM Mono 8px / `var(--ink-4)`

#### Search + Meta
- Search pill: `bg var(--bg-panel2)`, border `1px solid var(--ln-2)`, padding `5px 10px`, minWidth 160px
  - Icon: 12×12px magnifying glass SVG, `var(--ink-4)`
  - Placeholder: DM Sans 10px / `var(--ink-4)` / tracking 0.05em
- Live indicator: 5×5px circle `var(--red)` + text "LIVE" — DM Sans 9px / tracking 0.1em / `var(--ink-4)`; circle blinks at opacity 0.15→1 over 2.4s
- Panel toggle buttons (2): 28×28px, border `1px solid var(--ln-2)`, border-radius 2px
  - **Inactive:** bg transparent, color `var(--ink-3)`
  - **Active (panel open):** bg `var(--red-ghost)`, border `var(--red-dim)`, color `var(--red)`

---

### 3. Left Panel

**Width:** 272px (collapses to 0)  
**Background:** `var(--bg-panel)`  
**Border-right:** `1px solid var(--ln-1)`

#### Tab Bar
Three tabs: Layers / Program / Geometry  
- DM Sans 9px / tracking 0.12em / uppercase
- **Active tab:** color `var(--red)`, border-bottom `2px solid var(--red)`, weight 500
- **Inactive:** color `var(--ink-3)`, border-bottom `2px solid transparent`, weight 400

#### Layers Tab

**Active count bar** — padding `8px 16px 6px`, border-bottom `1px solid var(--ln-1)`
- Left: DM Sans 9px / tracking 0.1em / uppercase / `var(--ink-4)` — "Active Layers"
- Right: DM Mono 9px / `var(--ink-2)` — e.g. "5 / 10"

**Category Group Header** — background `var(--bg-panel2)`, padding `9px 16px`
- 7px circle swatch in category color
- Label: DM Sans 9px / tracking 0.12em / uppercase / `var(--ink-2)` / weight 600
- Count: DM Mono 8px / `var(--ink-4)` e.g. "2/4"
- Chevron SVG icon `var(--ink-4)`, rotates on open/close

**Layer Row** — padding `7px 16px`, border-bottom `1px solid var(--ln-1)`
- **Active:** bg `var(--red-ghost)`
- **Checkbox** 12×12px, border-radius 2px
  - OFF: border `1.5px solid var(--ln-3)`, transparent bg
  - ON: bg `var(--red)`, border `var(--red)`, white checkmark SVG inside
- **Swatch** 7px circle in layer colour
- **Name:** DM Sans 10.5px — ON: `var(--ink-1)` weight 500 / OFF: `var(--ink-3)` weight 400
- **Current val:** DM Mono 9px / `var(--ink-4)` — right-aligned, e.g. "4.2 kWh/m²/d"
- **Delta:** DM Mono 8.5px — positive in `var(--neg)` = `oklch(50% 0.16 22)` ≈ `#c4472a` / negative in `var(--pos)` = `oklch(50% 0.14 148)` ≈ `#3a8c54`

**Category colours:**
| Category | Token | Approx hex |
|---|---|---|
| Environment | `oklch(55% 0.14 148)` | `#3d9060` |
| Economic | `oklch(52% 0.14 248)` | `#4060a8` |
| Logistics | `oklch(54% 0.14 32)` | `#a85830` |

**Layer swatch colours:**
| Layer | Hex |
|---|---|
| Solar Exposure | `#e8b84b` |
| Wind Flow | `#7bb8d4` |
| Green Coverage | `#7dc47d` |
| Urban Heat | `#d4845a` |
| Energy Demand | `#6dbf9e` |
| Carbon Output | `#c46060` |
| Water Use | `#6090d4` |
| Air Quality | `#70c8d8` |
| Biodiversity | `#b07ad8` |
| Shadow Cast | `#9aa0a8` |

#### Program Tab
Vertical stack of labelled fields, padding `14px 16px`, gap 10px  
- Label: DM Sans 9px / tracking 0.1em / uppercase / `var(--ink-3)`
- Field: height 30px, bg `var(--bg-panel2)`, border `1px solid var(--ln-2)`, padding `0 10px`
- Field text: DM Mono 11px / `var(--ink-1)`
- Fields: PROGRAM TYPE / GFA m² / HOURS/WEEK / ADMISSION $ / STAFF

#### Geometry Tab
- Range slider with custom thumb (12px circle, `var(--red)`, glow ring `var(--red-ghost)`)
- Track: 3px height, bg `var(--ln-2)`, filled portion `var(--red)`
- Mode dropdown field (same style as Program fields)
- Editorial notice: `border-left: 2px solid var(--red-dim)`, padding-left 10px, DM Sans 9px / `var(--ink-4)` / line-height 1.6
- Draw/Clear buttons: height 34px, DM Sans 9px / tracking 0.1em / uppercase / border `1px solid var(--ln-2)`

---

### 4. Right Panel

**Width:** 296px (collapses to 0)  
**Background:** `var(--bg-panel)`  
**Border-left:** `1px solid var(--ln-1)`

#### Panel Header
Padding `12px 18px 10px`, border-bottom `1px solid var(--ln-1)`  
- Title: DM Sans 9px / tracking 0.14em / uppercase / `var(--ink-2)` / weight 600
- Subtitle: DM Sans 9px / `var(--ink-4)` / tracking 0.04em — e.g. "Scenario: BASELINE T0 · Radius: 400 m"

#### Impact / Layers Mode — Readout Cards

**Headline Score card** — bg `var(--bg-panel2)`, padding `16px 18px 14px`
- Label: DM Sans 8.5px / tracking 0.14em / uppercase / `var(--ink-3)`
- Number: DM Sans 52px / weight 200 / letter-spacing -0.04em / `var(--ink-1)` — e.g. "+34"
- Unit: DM Sans 11px / `var(--ink-4)` — "pts"
- Delta line: DM Sans 10px / `var(--pos)` — "▲ Moderate positive · 6 factors assessed"

**Individual metric cards** — padding `14px 18px`, border-bottom `1px solid var(--ln-1)`
- Label: DM Sans 8.5px / tracking 0.14em / uppercase / `var(--ink-3)`
- Big number: DM Sans 36px / weight 300 / letter-spacing -0.03em / `var(--ink-1)` (or `var(--neg)` for bad metrics)
- Unit: DM Sans 11px / `var(--ink-4)` inline after number
- Delta: DM Sans 10px / `var(--neg)` or `var(--pos)` depending on direction
- Sparkline SVG: 100% width × 28px height, polyline stroke 1.5px in `var(--red)` or `var(--neg)`, fill at 8% opacity, no axes

**Metric list rows** — padding `6px 0`, border-bottom `1px dashed var(--ln-1)`, font-variant-numeric tabular-nums
- Label: DM Sans 10.5px / `var(--ink-3)`
- Value: DM Mono 10px / `var(--ink-1)` right-aligned

#### Massing Mode
- LOAD GLB button: full-bleed (flex:1), height 36px, bg `var(--red)`, color white, DM Sans 9.5px / tracking 0.1em / uppercase / weight 500
- CLEAR button: same height, bg transparent, border `1px solid var(--ln-2)`, color `var(--ink-3)`
- Input fields: same style as Program fields (DM Mono 11px in bg-panel2)
- Derived block: label DM Sans 8.5px / `var(--ink-3)` uppercase; rows DM Sans 9px label + DM Mono weight 500 value; border-bottom `1px dashed var(--ln-1)`

---

### 5. Map Area

**Background:** `#ffffff` (pure white)  
The MapTiler style should be switched from `streets-v2-dark` to `streets-v2` (light) or a custom light style.

**Map controls** (zoom +/−, compass) — 28×28px, bg `rgba(255,255,255,0.9)`, border `1px solid var(--ln-2)`, backdrop-filter blur 4px, positioned bottom-right shifting with panel width

#### Map HUD Overlays
Small text overlays, pointer-events none, font-variant-numeric tabular-nums  
- DM Sans 9px / tracking 0.08em / uppercase / `var(--ink-4)`
- Strong values: `var(--ink-2)` / DM Mono / weight 500
- Active layer tag: `var(--red)` / weight 500
- Bottom-left HUD box: bg `rgba(255,255,255,0.88)`, border `1px solid var(--ln-1)`, backdrop-filter blur 6px, padding `5px 12px`, DM Mono 9px
- All 4 HUD positions shift in sync with panel open/close using the same transition timing

---

### 6. Footer

**Height:** 30px  
**Background:** `var(--bg-panel)`  
**Border-top:** `1px solid var(--ln-1)`  
- Two groups (left / right) with flex + gap 20px
- Item label: DM Sans 8.5px / tracking 0.08em / uppercase / `var(--ink-4)`
- Item value: DM Mono / `var(--ink-2)` / weight 500 / tracking 0.02em / margin-left 4px
- Items: SCENARIO · RADIUS · PROGRAM · GFA | EPSG · REF EPSG · brand text

---

## Interactions & Behaviour

### Panel Collapse
```
width: 0 ↔ var(--lpanel-w) / var(--rpanel-w)
transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1)
overflow: hidden
```
Map HUD overlay offsets update via CSS calc, same transition timing.

### Mode Toggle
Clicking a mode button updates the right panel content:
- `layers` → Impact Readouts (same as `impact`)
- `massing` → Massing controls (load GLB, anchor, rotation, scale, derived dims)
- `impact` → Full readout stack (score, per-layer cards, economic, massing summary)

### Time Scrubber
Clicking a step dot updates:
- The active dot (filled + glow ring)
- The fill bar width (percentage of full track)
- The scenario label in the footer and right panel subtitle
- In production: triggers re-computation of all impact readouts

### Layer Toggle
Clicking a layer row:
- Toggles checkbox state (checked = `var(--red)` fill)
- Row bg switches to `var(--red-ghost)` when active
- Name weight 500 + `var(--ink-1)` when active
- Count badge in category header updates
- In production: shows/hides the corresponding MapTiler layer

### Category Accordion
Click category header → `openCats` state toggles the `catId`. Chevron rotates via CSS or inline style.

### Wrap Inspector
Existing slide-in panel (translateX 100% → 0) should be re-skinned to use the new tokens. Keep the same trigger button in the header.

---

## State Management

| Variable | Type | Description |
|---|---|---|
| `lpanelOpen` | boolean | Left panel visible |
| `rpanelOpen` | boolean | Right panel visible |
| `mode` | `'layers' \| 'massing' \| 'impact'` | Active mode driving right panel |
| `step` | 0–4 | Active time scrubber step |
| `activeLayers` | string[] | IDs of enabled layers |
| `openCats` | string[] | IDs of expanded category groups |
| `lpTab` | `'layers' \| 'program' \| 'geometry'` | Active left panel tab |

---

## Design Tokens

### CSS Custom Properties (replace contents of `css/base.css` `:root`)

```css
:root {
  /* ── Backgrounds ── */
  --bg-map:    #ffffff;
  --bg-panel:  oklch(98.5% 0.004 60);   /* ≈ #faf9f7 — panel surface */
  --bg-panel2: oklch(96.5% 0.006 58);   /* ≈ #f4f1ee — secondary / inputs */
  --bg-panel3: oklch(94%   0.008 56);   /* ≈ #ede9e5 — tertiary / category headers */

  /* ── Ink (text) hierarchy ── */
  --ink-1: oklch(18% 0.008 50);   /* ≈ #2a2725 — primary text */
  --ink-2: oklch(36% 0.008 50);   /* ≈ #5a5550 — secondary text */
  --ink-3: oklch(55% 0.008 50);   /* ≈ #8a8480 — labels / placeholders */
  --ink-4: oklch(70% 0.008 50);   /* ≈ #b0ada8 — faint / metadata */

  /* ── Lines / borders ── */
  --ln-1: oklch(92% 0.005 55);   /* ≈ #eae8e4 — dividers */
  --ln-2: oklch(86% 0.007 54);   /* ≈ #dbd8d3 — borders */
  --ln-3: oklch(78% 0.009 53);   /* ≈ #c8c4be — stronger borders */

  /* ── Accent — vermillion ── */
  --red:       oklch(58% 0.20 28);   /* ≈ #c94e2a — primary accent */
  --red-dim:   oklch(70% 0.12 28);   /* ≈ #d8937c — muted accent */
  --red-ghost: oklch(95% 0.04 28);   /* ≈ #fdf0ec — tinted bg */

  /* ── Layer category colours ── */
  --c-env: oklch(55% 0.14 148);   /* green  — Environment */
  --c-eco: oklch(52% 0.14 248);   /* blue   — Economic */
  --c-log: oklch(54% 0.14 32);    /* orange — Logistics */

  /* ── Status ── */
  --pos: oklch(50% 0.14 148);   /* green — positive delta */
  --neg: oklch(50% 0.16 22);    /* red   — negative delta */
  --neu: oklch(52% 0.14 80);    /* amber — neutral */

  /* ── Shadows ── */
  --sh-1: 0 1px 3px rgba(0,0,0,0.06);
  --sh-2: 0 4px 16px rgba(0,0,0,0.09);

  /* ── Layout dimensions ── */
  --hdr-h:     52px;
  --lpanel-w:  272px;
  --rpanel-w:  296px;
  --footer-h:  30px;
}
```

> **Note on oklch:** These values are supported in all modern browsers (Chrome 111+, Firefox 113+, Safari 15.4+). For legacy support, add hex fallbacks before each oklch declaration.

### Typography

| Role | Family | Size | Weight | Letter-spacing | Transform |
|---|---|---|---|---|---|
| Brand name | DM Sans | 12px | 600 | 0.1em | uppercase |
| Mode buttons | DM Sans | 10px | 400/500 | 0.1em | uppercase |
| Section labels | DM Sans | 8.5–9px | 400/600 | 0.12–0.14em | uppercase |
| Body / layer names | DM Sans | 10–11px | 400/500 | normal | — |
| Big readout numbers | DM Sans | 36–52px | 200–300 | -0.03–-0.04em | — |
| Mono values / coords | DM Mono | 8–11px | 300–500 | 0.02–0.08em | — |
| Footer items | DM Sans | 8.5px | 400 | 0.08em | uppercase |

**Google Fonts import:**
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

Replace `Fragment Mono` with `DM Mono` and remove `Instrument Serif` throughout the codebase.

### Spacing
- Panel padding: `16px` horizontal, `12–14px` vertical for section headers
- Control grid gap: `6–8px`
- Layer row padding: `7px 16px`
- Footer item gap: `20px`

### Border radius
- Mode buttons: `3px`
- Panel toggle buttons: `2px`
- Checkboxes: `2px`
- Map HUD / pills: `0` (sharp corners — precision instrument aesthetic)

---

## MapTiler Style

Change the map style from dark to light. In `js/map.js`, update:
```js
// Before
style: maptilersdk.MapStyle.STREETS.DARK
// After  
style: maptilersdk.MapStyle.STREETS  // default light
```
Or use the dataviz-optimised style: `maptilersdk.MapStyle.DATAVIZ.LIGHT`

Also remove the dark vignette overlay (`#vignette`) from `index.html`.

---

## Key CSS Changes Required

### `css/base.css`
- Replace the entire `:root` block with the new tokens above
- Remove the `html[data-theme="dark"]` block — there is now only a light theme
- Replace `Fragment Mono` font import with `DM Sans` + `DM Mono`
- Change `background: var(--bg)` to `background: var(--bg-map)` on `html, body`
- Remove the `--map-fill`, `--map-stroke` dark overrides

### `css/layout.css`
- Update `.app-header` height to `52px` and add the new brand/mode-toggle structure
- Update `.panel-left` width to `272px`, `.panel-right` to `296px`
- Update `.app-footer` height to `30px`
- Add `transition: width 0.22s cubic-bezier(0.4,0,0.2,1)` to both panels
- Update `.stage-overlay` offsets to match new panel widths

### `css/components.css`
- Restyle `.layer` rows — new checkbox, swatch, delta column layout
- Restyle `.scrubber-step` dots to use new sizing and glow ring on active
- Restyle `.btn-primary` to use `var(--red)` fill
- Restyle `.btn-secondary` to use light border style
- Restyle `.readout-card` big numbers to use DM Sans weight 200–300 instead of Instrument Serif
- Remove dark HUD styles (`.brk`, vignette)
- Update `.wrap-inspector` to use light panel tokens

---

## Assets

No external image assets. All icons are inline SVG (14×14px viewBox `0 0 20 20`, stroke 1.5px, no fill, linecap/linejoin round). The prototype contains the full icon set — copy SVG paths from `direction-b.html`.

---

## Files in This Package

| File | Description |
|---|---|
| `README.md` | This document |
| `direction-b.html` | Full hi-fi interactive prototype (open in browser to inspect) |
| `wireframes.html` | Earlier wireframe explorations (Direction A + B side-by-side) |

---

## Implementation Order (suggested)

1. Update CSS tokens (`base.css`) and font imports
2. Switch MapTiler style to light
3. Restyle the header (brand + mode toggle + scrubber)
4. Restyle left panel (tabs + layer category groups + checkboxes)
5. Restyle right panel (readout cards + massing controls)
6. Restyle footer
7. Update map HUD overlays
8. Re-skin Wrap Inspector with new tokens
9. QA the panel collapse transitions and HUD repositioning
