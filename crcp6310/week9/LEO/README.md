# ORBITA — the low-Earth ensemble

Live orbital catalog rendered as a rotating, sounding 3D mandala.
CRCP 6310 · p5.js (WEBGL) · Web Audio · native ES modules.

## Data provenance (four sources, four honesty contracts)

| layer | source | freshness | honesty split |
|---|---|---|---|
| orbital elements | CelesTrak GP API (OMM JSON), one fetch per group per session | hours | offline fallback is *recorded* elements, labeled with their date — never synthesized |
| stars | HYG database (Hipparcos-derived), all 523 naked-eye stars to mag 4.0, baked at build time | fixed catalog | brightness bucketed for batching |
| sun | computed low-precision ephemeris (declination, subsolar point, GMST) | exact for simT | direction & photosphere angular size true; distance & corona artistic |
| events | derived: close pairs (30 km grid), terminator crossings, eclipse state | per frame | HUD says "close pairs", not "collision risk" — real screening uses covariance |

Altitude exaggeration (E) defaults to ×4 for shell legibility; ×1 is true
scale. Kaleidoscope folds (←/→) are a lens, not the sky; folds=1 is the
honest default. Earth rotates at sidereal rate under equinox-referenced
orbits, so ground tracks and terminator geometry are real.

## The score

Three musical timescales from three pieces of geometry: the continuous
ensemble chord (orbital frequencies shifted ~21 octaves; co-planar shells
beat at their true relative rates), rhythmic terminator crossings
(sunrise a fifth up, sunset an octave down, at each object's own voice),
and rare conjunction bells. F solos the focused object.

## Controls

drag rotate · scroll zoom · ←/→ folds · F focus tour · G group ·
T time (60/240/600×) · E altitude scale · Space pause · M sound · S save.
Idle 20 s → gallery mode (slow drift, auto-advancing tour); any input
reclaims control. `prefers-reduced-motion` pins time to 1× and disables
the drift.

## Architecture

```
src/
  main.js                p5 instance; wires everything through explicit ctx
  state.js               shared config + session state (no bare globals)
  feeds/celestrak.js     GP fetch, normalize, mean-element propagation
  feeds/fixture*.js      recorded offline fallback
  render/orbits.js       batched ensemble: hue/alpha buckets, fold copies
  render/earth.js        coastline globe (world-atlas), terminator shading
  render/sky.js          HYG starfield
  render/color.js        shared hsv
  sim/sun.js             ephemeris, GMST, cylindrical shadow test
  sim/conjunctions.js    spatial-grid close pairs + bloom pool
  sim/groundtrack.js     ECI->earth-fixed ring buffer
  sim/notables.js        focus-tour selection
  audio.js               Sonifier (#private Web Audio): drone/chime/crossing/solo
```

## Build, test, deploy

```
node test/smoke.mjs      # 60+ headless checks, no browser/network/GPU
python3 build.py         # dist/orbita.html + dist/js/ (native ESM, const/let
                         # preserved) and dist/sketch.js (IIFE, p5 editor)
python3 -m http.server   # type="module" won't run from file://
```

Deploy `dist/orbita.html` alongside `dist/js/` (GitHub Pages: drop both
into the project folder). Regenerating `coastlines.js` / `stars_data.js`
needs `world-atlas`, `topojson-client`, and the HYG CSV; the generated
modules are committed so routine builds don't.

## Known visual-check items (headless suite can't see)

Earth rotation sign (continents should drift eastward; flip the rotateY
sign in main.js if reversed) and the matching ground-track alignment;
corona shell falloff; glow-point sizing under p5 2.x WEBGL; star
brightness against the additive ensemble; conjunction rate at 30 km.
