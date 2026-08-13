# Residual

A single static page that turns three days of live NOAA tide data into three
interchangeable visual treatments. The subject of all three is the gap between the tide
the moon predicted and the tide that actually arrived. That gap is storm surge.

- **Horizon** — pixel water, time running left to right
- **Core** — sediment strata, time running downward
- **Field** — the same numbers as a GPU particle flow

---

## Libraries

| Library | Role |
|---|---|
| **p5.js** 1.9 | Perlin noise and pixel-buffer work for Horizon and Core |
| **three.js** r128 | WebGL scene and custom shader for Field |
| **GSAP** 3.12 | Intro timeline, view cross-dissolves, storm bloom |

**p5 runs in instance mode**, not global mode, because two sketches and a WebGL context
share the page. Everything arrives through the `p` argument and each sketch is confined
to its own container:

```js
this.p5 = new p5(p => {
  p.setup = () => { p.createCanvas(this.W, this.H); p.pixelDensity(1); p.noSmooth(); };
  p.draw  = () => { if (this.app.active === this) this.draw(p); };
}, this.el);
```

p5 keeps calling `draw` on hidden sketches, so the class opts out.
`pixelDensity(1)` keeps the buffer small, since CSS scales it back up and the blockiness
is the point. p5 earns its place through `noise()`, which drives the caustics in Horizon
and the grain and layer warp in Core. Pixel writes go to an `ImageData` buffer the class
owns rather than through `loadPixels()`, because these renderers only ever write and the
readback was wasted work.

**three.js** builds a minimal scene: an orthographic camera spanning clip space and one
`Points` object of 22,000 vertices with a custom `seed` attribute alongside `position`.
Particles never move on the CPU. The vertex shader integrates each one along a noise
field every frame, and data reaches it only through uniforms (`uTurb` from residual,
`uRate` from rate of rise, `uPhase` from tidal height, `uSurge`, `uPtr`).

---

## Classes

```
Renderer                  abstract base, defines the contract
├── P5Renderer            owns a p5 instance lifecycle and a pixel buffer
│   ├── HorizonRenderer
│   └── CoreRenderer
└── FlowRenderer          owns a three.js scene

TideSeries   data model      InputBus   unified input      App   composition root
```

`Renderer.build()` throws instead of returning silently, naming the offending subclass
through `this.constructor.name`. That is how JavaScript approximates an abstract method.

**Polymorphism does real work here.** The frame loop calls `this.active.update()` with no
knowledge of which technology answers. For `FlowRenderer` that runs a WebGL draw. For the
p5 subclasses it does nothing, because p5 drives its own loop and those classes render
from their `draw(p)` callback instead. Two different execution models, one interface.
`dispose()` follows the same shape: p5 subclasses call `this.p5.remove()`, `FlowRenderer`
disposes geometry, material, and renderer, and both delegate upward with `super`.

**Inheritance carries shared behavior.** `P5Renderer` exists to hold the instance-mode
boilerplate, the buffer helpers (`clearBuf`, `fadeBuf`, `setPx`, `blit`), and disposal.
Horizon and Core inherit all of it and write only `draw(p)`.

`static get label()` is overridden per subclass and read generically, so adding a fourth
renderer needs no change to the chrome-building code.

---

## Primary functions

**`TideSeries`**
- `static fetchFor(st)` — two parallel fetches for `water_level` and `predictions`, joined
  on timestamp with a `Map`. Any failure falls through to `synth()`.
- `static synth()` — fallback tide from two sines at the real lunar periods plus a storm
  bump, so the page never renders empty.
- `constructor` — resamples to a fixed 420 layers and derives `res`, `norm`, `rate`, plus
  `maxRes` and `maxRate` for scaling.
- `at(u)` — samples by normalized position. Every renderer reads time through this.

**`InputBus`** — folds keyboard, pointer, and gamepad into one object renderers read and
never write. Runs its own rAF loop so input stays responsive. `rumble()` maps residual to
the heavy actuator and rate of rise to the light one.

**`App`** — `computeMoon()` derives lunar phase and an illumination scalar; `intro()` runs
the GSAP title timeline; `setStation()` and `setMode()` handle transitions; `loop()`
advances time, calls `active.update()`, and tweens the storm bloom.

**Renderer specifics** — `HorizonRenderer.draw()` dithers water columns with a 4x4 Bayer
matrix and spawns spray from the residual. `CoreRenderer.draw()` deposits strata and adds
a pointer loupe (a third noise octave revealed under the cursor), click-driven silt
smears, settling motes, and slow compaction. `FlowRenderer.update()` eases uniforms toward
their targets and issues the draw call.

---

## Data

NOAA CO-OPS, `api.tidesandcurrents.noaa.gov/api/prod/datagetter`. Public, permissive CORS, which is what makes a purely static page viable. Two products for the
same three-day window at six-minute intervals: `water_level` for observations and
`predictions` with `interval=6` for the astronomical forecast. Requesting both and
subtracting is the whole technique. Rows are inner-joined on timestamp, since predictions
run into the future while observations stop at the present.

Five stations. Boston and Seattle have the widest ranges and read best. San Francisco is
calm and serves as a control.

## Controls

`1` `2` `3` switch view · arrows change station and travel time · space agitates · pointer
ripples and stirs. On a gamepad: left stick scrubs, right stick sets gain, RT agitates,
bumpers change station, A returns to automatic time, Y cycles view. Haptics are Chromium
only and fail silently elsewhere.

## Performance

Field is the expensive view: 22,000 points running a 46-step shader loop per frame. Dials,
in order of least visual cost, are the pixel-ratio cap, the loop ceiling, then the
particle count. The raster views are cheap because their buffers are 300x170 and 320x420
with CSS doing the upscale.
