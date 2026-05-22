# oracle / instrument

A controller-driven particle field synthesizer that runs entirely in a single static HTML file. Upload an image and your face becomes 16,384 particles you steer with an Xbox controller — or enter empty-handed and let live visual weather be the form. A scribe draws vector annotations over the top.

```
┌─────────────────────────────────────────────────────────┐
│  HUD (DOM)              ← top layer                      │
├─────────────────────────────────────────────────────────┤
│  paper.js canvas        ← vector annotations             │
├─────────────────────────────────────────────────────────┤
│  three.js canvas        ← particle field + backdrop      │
├─────────────────────────────────────────────────────────┤
│  Hydra canvas (hidden)  ← live texture source            │
└─────────────────────────────────────────────────────────┘
```

---

## Quick start

1. Pair an Xbox controller to your computer over Bluetooth at the OS level.
2. Open the HTML file in Chrome or Edge. Firefox works but has weaker Gamepad API support.
3. Choose **offer an image** (a JPG/PNG of you) or **enter empty-handed** (no image required).
4. Press any controller button to wake the Gamepad API. Browsers won't deliver gamepad input until the page has received some user interaction.

Keyboard fallback for development without a controller: `A` cycles weather, `B` resets, `X` cycles scribe modes, `Y` toggles image/hydra mix, arrow keys handle zoom and rotation.

---

## Controller mapping

| Input | Action |
|---|---|
| Left stick | Orbit the particle field (X/Y rotation) |
| Right stick | Per-particle turbulence — directly drives the noise field |
| LT (analog) | Dispersion — particles fly outward radially |
| RT (analog) | Cohesion — particles compress toward center |
| LB / RB | Roll (Z rotation) |
| A | Cycle weather mode (Hydra pattern) with intensity flash |
| B | Reset rotation, zoom, weather, scribe, clear vector marks |
| X | Cycle scribe mode (off / contour / annotate / geometric) |
| Y | Toggle image↔hydra dominance · or open upload panel if empty |

---

## File layout

The whole app is one HTML file. Sections in order:

| Section | Purpose |
|---|---|
| `<head>` / `<style>` | Custom properties for the color system, HUD typography (Fraunces italic + JetBrains Mono), the upload panel, corner brackets, stick visualizers, and the weather flash overlay |
| Canvas elements | Three stacked canvases: `#hydra-canvas` (hidden, 512×512), `#three-canvas` (full viewport), `#paper-canvas` (full viewport) |
| HUD elements | Title block, status readouts (top-right), input visualizers (bottom-left), legend (bottom-right) |
| Library tags | three.js, hydra-synth, paper.js — all from CDN |
| `state` object | Single source of truth for renderers, uniforms, gamepad state, eased target values, scribe state |
| `initHydra` | Build the Hydra instance, define six weather patterns and their behavioral signatures |
| `initThree` | Build the scene, particle geometry, custom GLSL shader material, atmospheric backdrop plane |
| `initUpload` | File reader for image path, handler for empty-handed path |
| `initPaper` | paper.js setup and the aging-mark interval that fades vector ephemera |
| `initGamepad` | Connect/disconnect listeners |
| `readGamepad` | Per-frame poll: deadzone, easing targets, edge-triggered button detection |
| `animate` | The render loop — gamepad → state → uniforms → render |

---

## How each library is used

### three.js — the particle field

The main visual. Approximately 80% of the rendering work happens here.

**What it does:**
- Creates the `Points` mesh — a `BufferGeometry` with 16,384 vertices (`PARTICLE_GRID × PARTICLE_GRID`, currently 128×128) arranged in a flat grid in NDC-like space from `-1` to `+1` on X and Y.
- Each particle carries three buffer attributes: its position, its `aUv` (mapping to texture sample coordinates), and a per-particle `aRandom` value used to break up uniformity in size and motion.
- A single `ShaderMaterial` does all the heavy lifting — the vertex shader displaces particles, the fragment shader draws them as soft round points with optional halo.
- A second `Mesh` is a backdrop plane sitting behind the points (`z = -2.5`) that displays the Hydra texture directly with a radial vignette, so weather has visible presence even in negative space.

**Why a shader instead of per-particle CPU work:**
16,384 particles × ~60 fps = ~1 million particle updates per second. JavaScript can't keep up. Putting the displacement math in the vertex shader gives the GPU the work.

**Key uniforms passed into the shader:**

| Uniform | Source | Role |
|---|---|---|
| `uFaceTex` | image upload → `THREE.CanvasTexture` (cover-cropped to 512²) | Per-particle subject sample when a face is loaded |
| `uHydraTex` | Hydra canvas wrapped as `THREE.CanvasTexture` | The live weather field, sampled per-particle |
| `uHasFace` | `1.0` after image upload, `0.0` in empty-handed mode | Branches the shader: face-as-subject or hydra-as-subject |
| `uTurbulence` | Right stick (deadzoned) | XY noise displacement |
| `uDispersion` / `uCohesion` | LT / RT analog values | Radial scatter and inward collapse |
| `uHydraBlend` | Y button toggle (eased) | Crossfades face and hydra when a face is loaded |
| `uWeatherIntensity` | Eases from 1.0 → 0.55 after each A press | Drives the surge feel when changing weather |
| `uWeatherSig` | A `Vec4` chosen by the current weather mode | Encodes swirl, jitter, throb, cluster strengths |
| `uWeatherFlow` | Scalar paired with `uWeatherSig` | The fifth signature component (gradient-driven flow) |
| `uTime` | `performance.now() - bootTime` in seconds | Drives all temporal motion |

**The vertex shader pipeline (per particle):**

1. Sample the subject texture (face if loaded, hydra otherwise).
2. Compute luminance and `freedom = 1 - luminance` — dark regions move more readily, bright regions hold their shape. This is what makes faces *look like faces* when scattered: the eyes and shadows fly away first.
3. Apply the **weather signature**: swirl rotates the position around center, jitter adds high-frequency noise, throb pulses radially, cluster pulls dark particles toward bright hydra regions, flow follows the local Hydra gradient.
4. Add **user turbulence** from the right stick using 3D simplex noise.
5. Apply **dispersion** (radial outward) and **cohesion** (multiplicative inward).
6. Compute final point size from luminance, throb pulse, and camera distance.
7. Compute color: subject base × hydra tint (always on, scaled by `uWeatherIntensity`), with hot red tinting at dispersed edges.

**Rendering details:**
- `THREE.AdditiveBlending` for both particles and backdrop — colors accumulate where particles overlap, which produces the bloom-like glow on dense regions.
- `depthWrite: false` so transparent particles don't occlude each other incorrectly.
- `setPixelRatio(min(devicePixelRatio, 2))` — Retina-aware but capped to keep mobile fillrate manageable.

### Hydra — the weather

Hydra renders into a hidden 512×512 canvas. We never display that canvas directly. Instead, it's wrapped as a `THREE.CanvasTexture` and the three.js shader samples it per particle every frame.

**The integration:**

```js
state.hydraTexture = new THREE.CanvasTexture(hydraCanvas);
// in the animation loop:
state.hydraTexture.needsUpdate = true;  // tell three.js the canvas changed
```

Without that `needsUpdate = true` per frame, three.js would cache the first frame of Hydra forever.

**The six weather modes and their behavioral signatures:**

| Mode | Hydra source | Signature (swirl/jitter/throb/cluster/flow) |
|---|---|---|
| breath | `osc.rotate.kaleid(4).modulate(noise)` | 0.7 / 0.2 / 0.3 / 0.1 / 0.5 |
| bloom | `osc(14).kaleid(7).modulate.rotate` | 1.0 / 0.3 / 0.2 / 0.0 / 0.8 |
| cellular | `voronoi(18).modulateScale` | 0.2 / 0.1 / 0.1 / 1.0 / 0.3 |
| storm | `noise(6,0.4).colorama.contrast` | 0.3 / 1.0 / 0.2 / 0.0 / 0.6 |
| pulse | `shape(4).repeat(8,8).modulate(osc)` | 0.1 / 0.2 / 1.0 / 0.4 / 0.2 |
| feedback | `osc.modulate(osc.rotate).kaleid(3)` | 0.9 / 0.4 / 0.4 / 0.2 / 1.0 |

The visual Hydra produces is one thing — but its behavioral signature is a separate vector hand-tuned per mode. When the user presses A, both update together: the canvas starts displaying a new pattern, and the shader starts reading a new signature vector that changes *how* the particles respond to the canvas.

This is why each weather feels structurally different rather than just looking different. The shader checks each signature component (`if (jitter > 0.001)`, `if (cluster > 0.001)`) and only does the relevant work — cheap branching since the signature is uniform across all particles in a frame.

All Hydra patterns were cranked up in saturation (2.0-2.5×) and contrast (1.4-1.6×) so the colors actually punch through into the particle field rather than reading as a faint wash.

### paper.js — the scribe

A separate 2D canvas overlay that draws vector annotations on top of everything. paper.js is paused most of the time — it only draws when the scribe mode is active (X button to cycle).

**The three scribe modes:**

| Mode | Behavior |
|---|---|
| **contour** | Bézier curves radiating outward from the center. The angle follows the right stick direction; the length follows controller energy. |
| **annotate** | Architect's tick marks with floating labels: `φ`, `∂t`, `cohere`, current FPS, current weather name. The vocabulary changes with state. |
| **geometric** | Circles and triangles scaled by energy, placed near where the right stick is pointing. |

**The aging mechanic:**
Every paper.js item drawn gets stamped with `item.data = { life: N, maxLife: N }`. A `setInterval` runs every 80ms, walks the layer's children, decrements each item's `life`, sets its `opacity` to `life / maxLife`, and removes items at `life ≤ 0`. The canvas keeps clearing itself without the application having to track marks individually.

**Throttling:**
The scribe is throttled to ~16 marks/second via `lastDraw` timestamp — paper.js paths are cheap individually, but the overlay needs to stay readable, not turn into noise. This matters most in *annotate* mode where text needs time to be legible before it fades.

**Why paper.js over more three.js:**
Crisp 2D vectors over a 3D particle field is exactly what paper.js does best. The fade-out, hit-testing, and Bézier construction are all one-liners. Building the same in three.js would have meant Line2 / fat lines / custom shader work and an order of magnitude more code for less precise typography.

### Gamepad API — Xbox controller input

Browser-native, no library needed. Reads the standard Xbox button/axis layout.

**Standard Xbox mapping:**

```
axes:    [0]=LX  [1]=LY  [2]=RX  [3]=RY
buttons: [0]=A   [1]=B   [2]=X   [3]=Y
         [4]=LB  [5]=RB  [6]=LT  [7]=RT
         [8]=Back [9]=Start [10]=LS [11]=RS
         [12-15]=DPad
```

Triggers are analog (`button.value` from 0 to 1), face buttons are digital (`button.pressed`).

**Connection:**
- `gamepadconnected` event fires on first input — sets `state.controllerIndex` and updates the HUD dot.
- A fallback probe in `readGamepad` scans `navigator.getGamepads()` each frame in case the connection event was missed (which happens sometimes when the page loads before the pairing completes).

**Per-frame read pipeline:**

1. **Deadzone**: `Math.abs(v) < 0.12 ? 0 : (v - sign(v) * 0.12) / 0.88` — radial deadzone normalized to preserve full range past the threshold. Without this, sticks at rest produce drift that compounds over time.
2. **Edge detection**: `pressed(i) = pad.buttons[i].pressed && !state.prevButtons[i]` — fires once per button-down, not every frame the button is held. `state.prevButtons` is saved at the end of each poll.
3. **Easing**: stick rotation accumulates into `state.targetRot.x/y`, and the animation loop eases `state.rot` toward `state.targetRot` with `lerp(0.07)`. The current position is always one frame behind the target, which smooths input and prevents jitter.

The HUD's stick visualizers and trigger bars are CSS-driven — JS sets `--sx`, `--sy`, `--v` custom properties and CSS transforms read them.

---

## How the libraries connect

```
Xbox controller (Bluetooth, paired at OS level)
    │
    ▼
navigator.getGamepads()
    │
    ▼
readGamepad() ─── deadzone, edge detect ─── state.targetRot, state.turbulence, etc.
    │
    ▼
animate() loop (60fps)
    │
    ├─→ state.rot.lerp(state.targetRot)
    │
    ├─→ Hydra canvas renders next frame (driven by its own internal clock)
    │       │
    │       ▼
    │   state.hydraTexture.needsUpdate = true
    │
    ├─→ state.uniforms.uTime, uTurbulence, uDispersion, uWeatherSig, etc. updated
    │
    ├─→ state.renderer.render(state.scene, state.camera)
    │       │
    │       ▼ vertex shader samples uFaceTex + uHydraTex per particle
    │       ▼ fragment shader draws each as a soft point with weather halo
    │
    └─→ scribeTick() reads state.turbulence, state.dispersion → paper.js paths
            │
            ▼ aging interval fades old paths every 80ms
```

The single shared `state` object is the integration layer. Every library reads from it; nothing in here calls into another library directly. That means each library can be swapped (e.g. moving the renderer to WebGPU/TSL) without touching the others.

---

## Image upload pipeline

1. `<input type="file">` change event fires.
2. `FileReader.readAsDataURL` produces a base64 data URL.
3. An `Image` element loads the data URL.
4. The image is drawn into an offscreen 512×512 canvas with cover-fit cropping (centered square crop of the original). This guarantees consistent UV mapping regardless of source aspect ratio.
5. A `THREE.CanvasTexture` wraps the offscreen canvas, with `colorSpace = SRGBColorSpace` and `LinearFilter` for both min and mag.
6. The texture is assigned to `state.uniforms.uFaceTex.value`, and `uHasFace.value = 1.0` flips the shader branch.

The image never leaves the page. No network, no storage, no analytics — pure local processing.

---

## Empty-handed mode

The second entry path bypasses image upload entirely. It sets `state.emptyMode = true`, `state.hasFace = false`, and `uHasFace.value = 0.0`. In the shader, the `subject` branch becomes the Hydra texture directly:

```glsl
vec4 subject = (uHasFace > 0.5) ? mix(faceCol, hydraCol, uHydraBlend) : hydraCol;
```

The fragment shader also boosts saturation and brightness in this mode (`col = pow(col, 0.75); col *= 1.3`) since hydra IS the form rather than a tint on top of an image.

In empty mode, the Y button reopens the upload panel — so the user can offer an image mid-session and watch the abstract weather crystallize into a face.

---

## Adding a new weather mode

1. Add a new entry to `hydraPatterns` — a function that returns a Hydra chain ending in `.out()`.
2. Add a corresponding name to `hydraNames`.
3. Add a behavioral signature to `weatherSignatures` (color + swirl/jitter/throb/cluster/flow values).

The HUD and cycling logic pick up new entries automatically because they iterate by length.

## Adding a new scribe mode

1. Add a name string to `state.scribeModes`.
2. Add an `else if (state.scribeMode === N)` branch in `scribeTick()` with the drawing logic.
3. Make sure every paper.js item you create gets `item.data = { life: N, maxLife: N }` — that's what the aging interval uses to fade it.

---

## Known limitations

- **No WebGPU.** Everything is WebGL2 through three.js's classic renderer. Particle counts are capped around 16K-32K for smooth 60fps on integrated GPUs. A WebGPU + TSL rewrite would unlock compute shaders and 10× the particle count.
- **No persistent particle state.** Each frame is computed from scratch in the vertex shader. Particles don't have velocity or memory between frames. Real flocking, real physics, real "trails that remember where the particle was" all require either CPU state or a ping-pong FBO setup (or compute shaders, see above).
- **Gamepad API requires user interaction first.** Browsers gate gamepad input until the page has received any keyboard or pointer event. The upload panel's button click serves this purpose for the image path; the empty-handed button does the same.
- **Hydra global namespace.** `hydra-synth` initializes with `makeGlobal: true`, which pollutes `window` with `osc`, `noise`, `voronoi`, etc. This is required for the inline pattern definitions to work but means this code won't compose cleanly with another Hydra instance on the same page.
- **No mobile support.** Hardcoded Xbox controller assumptions, no touch input. The HUD layout assumes a wide viewport.

---

## Versions

- three.js — `0.160.0` from jsdelivr
- hydra-synth — `1.3.29` from unpkg
- paper.js (core) — `0.12.18` from jsdelivr

All three are loaded via CDN as IIFE bundles. No build step, no package manager, no bundler. The HTML file is self-contained — open it directly in a browser.

---

## License

Yours to do with as you wish.
