/*
  render/orbits.js — the orbital ensemble in real 3D geometry, batched.

  PERFORMANCE MODEL (the SVG answer, in code): immediate-mode per-object
  drawing cost ~9,000 p5 calls/frame (stroke state x trail segs x glow).
  Instead, hue is quantized to HUE_BUCKETS and alpha to ALPHA_LEVELS, and
  all geometry accumulates into preallocated Float32Array pools — one
  beginShape per non-empty bucket (~150 draw calls total). Kaleidoscope
  folds replicate vertices at build time (CPU rotation about the polar
  axis), so k-fold symmetry costs zero additional draw calls.

  Zero steady-state allocation: orbital3D writes into caller scratch;
  pools grow once, then reuse. Pure math exported for the headless suite.
*/

'use strict';

import feed from '../feeds/celestrak.js';
import { inShadow } from '../sim/sun.js';
import { hsv } from './color.js';
import { dragEmphasis } from '../core/dynamics.js';

const TAU = Math.PI * 2;

/* pure math lives in core/math.js (the renderer boundary); re-exported so
   existing p5-side imports and the suite keep working unchanged */
export * from '../core/math.js';
import { scaledRadiusKm, orbital3D, staleAlpha, trailSpanDeg,
         hueBucket, alphaLevel, foldRotate,
         HUE_BUCKETS, ALPHA_LEVELS } from '../core/math.js';

/* precomputed bucket colors */
const BUCKET_RGB = Array.from({ length: HUE_BUCKETS },
  (_, i) => hsv((38 + (i + 0.5) / HUE_BUCKETS * 250) % 360, 0.72, 1));
const ALPHA_VAL = Array.from({ length: ALPHA_LEVELS },
  (_, i) => 255 * (i + 0.5) / ALPHA_LEVELS);

/* growable-once vertex pool */
class Pool {
  constructor() { this.a = new Float32Array(512 * 3); this.n = 0; }
  ensure(extra) {                          // grow-once; steady state never grows
    while (this.n + extra > this.a.length) {
      const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b;
    }
  }
  reset() { this.n = 0; }
}

const SEGS = 3;
/* F10.7 made visible: objects most susceptible to drag get a larger, warmer
   glow. p5's immediate mode cannot vary point size without a state change,
   so emphasis is quantised into three extra pools — three more draw calls
   rather than a per-object one. (The Three build varies size per vertex.) */
export const EMPHASIS_LEVELS = 3;
const emphasisPools = Array.from({ length: EMPHASIS_LEVELS }, () => new Pool());
const EMPHASIS_STYLE = [[9, 26], [13, 40], [18, 58]];   // weight, alpha
const pointPools = Array.from({ length: HUE_BUCKETS * ALPHA_LEVELS }, () => new Pool());
const linePools  = Array.from({ length: HUE_BUCKETS * ALPHA_LEVELS }, () => new Pool());
const scratch = new Float32Array(3 * (SEGS + 1));

/* ---- the renderer -------------------------------------------------------- */

export const orbitsMotif = {
  name: 'orbits',

  prepare(objects) {
    for (const o of objects) o._hb = hueBucket(o.incl);
    return objects;
  },

  /* Build pass: heads + trails + fold copies into pools.
     ctx: { objects, simT, kmToPx, altExag, tScale, folds }
     Also writes true-scale km head positions into ctx.headsKm (Float32Array,
     provided by caller) for conjunction detection — one propagation, two uses. */
  build(ctx) {
    const { objects, simT, kmToPx, altExag, tScale, folds, headsKm, sunEci,
            crossings, f107 } = ctx;
    for (const pool of pointPools) pool.reset();
    for (const pool of linePools)  pool.reset();
    for (const pool of emphasisPools) pool.reset();

    for (let idx = 0; idx < objects.length; idx++) {
      const o = objects[idx];
      const ph = feed.propagate(o, simT);
      const u = o.argp + ph.meanAnomaly;
      const rPx = scaledRadiusKm(o.altKm, altExag) * kmToPx;
      const span = trailSpanDeg(o.meanMotion, tScale);

      /* head + trail knots into scratch (head at 0) */
      for (let s = 0; s <= SEGS; s++)
        orbital3D(o.incl, o.raan, u - span * (s / SEGS), rPx, scratch, s * 3);

      if (headsKm) {                       // true-scale km, fold-0, for sim
        const rKm = scaledRadiusKm(o.altKm, 1);
        orbital3D(o.incl, o.raan, u, rKm, headsKm, idx * 3);
      }

      let al = staleAlpha(ph.staleDays);
      if (sunEci && headsKm) {             // eclipse: dim + crossing events
        const dark = inShadow(headsKm[idx*3], headsKm[idx*3+1], headsKm[idx*3+2], sunEci);
        if (o._dark === undefined) o._dark = dark;      // first frame: no note
        else if (dark !== o._dark) {
          o._dark = dark;
          if (crossings && crossings.length < 8)
            crossings.push({ hz: o.freqHz, sunrise: !dark, idx });
        }
        if (dark) al *= 0.3;
      }
      const headKey = o._hb * ALPHA_LEVELS + alphaLevel(al);
      /* drag emphasis, live with solar flux: which objects the current sun
         is actually pulling on. Quantised to three levels for batching. */
      const emph = f107 ? dragEmphasis(o.bstar, o.altKm, f107) : 0;
      const emphLevel = emph > 0.34
        ? Math.min(EMPHASIS_LEVELS - 1, Math.floor((emph - 0.34) / 0.22)) : -1;

      for (let f = 0; f < folds; f++) {
        const th = f * TAU / folds;
        const pp = pointPools[headKey];
        pp.ensure(3);
        foldRotate(scratch[0], scratch[1], scratch[2], th, pp.a, pp.n);
        pp.n += 3;                          // rotate-in-place push
        if (emphLevel >= 0) {
          const ep = emphasisPools[emphLevel];
          ep.ensure(3);
          foldRotate(scratch[0], scratch[1], scratch[2], th, ep.a, ep.n);
          ep.n += 3;
        }
        for (let s = 0; s < SEGS; s++) {
          const segA = al * 0.5 * (1 - s / SEGS);
          const lp = linePools[o._hb * ALPHA_LEVELS + alphaLevel(segA)];
          lp.ensure(6);
          for (const k of [s, s + 1]) {
            foldRotate(scratch[k*3], scratch[k*3+1], scratch[k*3+2], th, lp.a, lp.n);
            lp.n += 3;
          }
        }
      }
    }
  },

  /* Draw pass: one beginShape per non-empty bucket; points drawn twice
     (glow + core) reusing the same buffers. */
  draw(p, ctx) {
    this.build(ctx);

    for (let b = 0; b < linePools.length; b++) {
      const pool = linePools[b]; if (!pool.n) continue;
      const [r, g, bb] = BUCKET_RGB[(b / ALPHA_LEVELS) | 0];
      p.stroke(r, g, bb, ALPHA_VAL[b % ALPHA_LEVELS]);
      p.strokeWeight(1.3);
      p.beginShape(p.LINES);
      for (let i = 0; i < pool.n; i += 3) p.vertex(pool.a[i], pool.a[i+1], pool.a[i+2]);
      p.endShape();
    }
    /* the drag-emphasis glow sits under the ensemble's own passes */
    for (let e = 0; e < EMPHASIS_LEVELS; e++) {
      const pool = emphasisPools[e];
      if (!pool.n) continue;
      const [weight, alpha] = EMPHASIS_STYLE[e];
      p.stroke(255, 190, 120, alpha);
      p.strokeWeight(weight);
      p.beginShape(p.POINTS);
      for (let i = 0; i < pool.n; i += 3) p.vertex(pool.a[i], pool.a[i+1], pool.a[i+2]);
      p.endShape();
    }
    for (const [weight, aMul] of [[6.5, 0.22], [2.6, 1]]) {   // glow, core
      for (let b = 0; b < pointPools.length; b++) {
        const pool = pointPools[b]; if (!pool.n) continue;
        const [r, g, bb] = BUCKET_RGB[(b / ALPHA_LEVELS) | 0];
        p.stroke(r, g, bb, ALPHA_VAL[b % ALPHA_LEVELS] * aMul);
        p.strokeWeight(weight);
        p.beginShape(p.POINTS);
        for (let i = 0; i < pool.n; i += 3) p.vertex(pool.a[i], pool.a[i+1], pool.a[i+2]);
        p.endShape();
      }
    }
  },

  voices(objects, n = 12) {
    if (!objects.length) return [];
    const sorted = [...objects].sort((a, b) => a.altKm - b.altKm);
    const step = Math.max(1, Math.floor(sorted.length / n));
    const picked = [];
    for (let i = 0; i < sorted.length && picked.length < n; i += step)
      picked.push(sorted[i]);
    return picked.map(o => ({ id: o.id, hz: o.freqHz, incl: o.incl }));
  },
};
