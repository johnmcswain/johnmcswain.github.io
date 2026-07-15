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

const TAU = Math.PI * 2, D2R = Math.PI / 180;
export const R_EARTH_KM = 6371;

/* ---- pure math (exported for tests) -------------------------------------- */

export function scaledRadiusKm(altKm, exag = 1) {
  return R_EARTH_KM + Math.max(0, altKm) * exag;
}

/* circular elements -> p5 space (y-down, north = -Y), written into out[o..o+2] */
export function orbital3D(inclDeg, raanDeg, uDeg, r, out, o = 0) {
  const i = inclDeg * D2R, O = raanDeg * D2R, u = uDeg * D2R;
  const cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(i);
  out[o]     = r * (Math.cos(O) * cu - Math.sin(O) * su * ci);
  out[o + 1] = -r * (su * Math.sin(i));
  out[o + 2] = r * (Math.sin(O) * cu + Math.cos(O) * su * ci);
  return out;
}

export function inclHue(incl) {
  const t = Math.min(1, Math.max(0, incl / 180));
  return (38 + t * 250) % 360;
}

export function staleAlpha(staleDays) {
  return 255 * Math.max(0.15, Math.min(1, 1 - staleDays / 30));
}

const TRAIL_S = 1.6, TRAIL_MIN = 2, TRAIL_MAX = 42;
export function trailSpanDeg(meanMotion, tScale) {
  const degPerRealSec = meanMotion * 360 / 86400;
  return Math.min(TRAIL_MAX, Math.max(TRAIL_MIN, degPerRealSec * tScale * TRAIL_S));
}

/* quantization for batching */
export const HUE_BUCKETS = 24, ALPHA_LEVELS = 4;
export function hueBucket(incl) {
  return Math.min(HUE_BUCKETS - 1, Math.floor(inclHue(incl) / 360 * HUE_BUCKETS));
}
export function alphaLevel(a255) {          // 0..ALPHA_LEVELS-1
  return Math.min(ALPHA_LEVELS - 1, Math.floor(a255 / 256 * ALPHA_LEVELS));
}

/* fold rotation about the polar (p5 y) axis, in place on out[o..o+2] */
export function foldRotate(x, y, z, theta, out, o = 0) {
  const c = Math.cos(theta), s = Math.sin(theta);
  out[o] = x * c + z * s; out[o + 1] = y; out[o + 2] = -x * s + z * c;
  return out;
}

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
    const { objects, simT, kmToPx, altExag, tScale, folds, headsKm, sunEci, crossings } = ctx;
    for (const pool of pointPools) pool.reset();
    for (const pool of linePools)  pool.reset();

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
            crossings.push({ hz: o.freqHz, sunrise: !dark });
        }
        if (dark) al *= 0.3;
      }
      const headKey = o._hb * ALPHA_LEVELS + alphaLevel(al);

      for (let f = 0; f < folds; f++) {
        const th = f * TAU / folds;
        const pp = pointPools[headKey];
        pp.ensure(3);
        foldRotate(scratch[0], scratch[1], scratch[2], th, pp.a, pp.n);
        pp.n += 3;                          // rotate-in-place push
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
