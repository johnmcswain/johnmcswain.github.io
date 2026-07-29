/*
  render/aurora.js — the auroral ovals on the globe.

  Batched exactly like the ensemble: intensity is quantised into a few
  buckets and each bucket is one beginShape(POINTS), so the whole layer
  costs a handful of draw calls instead of thousands. Sample positions are
  precomputed unit vectors; only the per-sample intensity is recomputed,
  and only every RECOMPUTE_FRAMES frames since Kp and the subsolar point
  move slowly.

  Drawn inside the earth-fixed frame (aurora is geographic) at the real
  110 km emission altitude. Colour follows intensity the way real aurora
  does: faint green, bright green, then red at the top end.
*/

'use strict';

import { ovalIntensity, EMISSION_ALT_KM, auroraGrid } from '../sim/aurora.js';

const D2R = Math.PI / 180;
const RECOMPUTE_FRAMES = 10;

/* intensity buckets: [threshold, r, g, b, alpha, weight] */
const BUCKETS = [
  [0.08, 60, 190, 120, 90, 2.0],
  [0.30, 90, 240, 150, 140, 2.6],
  [0.55, 170, 255, 170, 180, 3.2],
  [0.78, 245, 150, 130, 200, 3.6],
];

export class AuroraLayer {
  #samples;                  // Float32Array of unit vectors, 3 per sample
  #latlon;                   // Float32Array of [lat, lon] per sample
  #buckets;                  // Float32Array vertex pools, one per bucket
  #counts;
  #frame = 0;
  #ovation = null;

  constructor() {
    const grid = auroraGrid();                 // shared with the Three layer
    this.#samples = grid.vectors;
    this.#latlon = grid.latlon;
    this.#buckets = BUCKETS.map(() => new Float32Array(this.sampleCount * 3));
    this.#counts = BUCKETS.map(() => 0);
    this.visible = true;
  }

  get sampleCount() { return this.#latlon.length / 2; }
  get activeCount() { return this.#counts.reduce((a, b) => a + b, 0) / 3; }
  get source() { return this.#ovation ? 'OVATION grid' : 'oval from live Kp'; }

  /* an accepted OVATION parse replaces the computed oval; null restores it */
  setOvation(parsed) {
    this.#ovation = parsed;
    if (parsed) {
      const need = parsed.count * 3;
      this.#buckets = BUCKETS.map(() => new Float32Array(need));
    }
    this.#frame = 0;
  }

  /* recompute the bucketed vertex pools (throttled) */
  update(kp, subsolarLonDeg) {
    if (this.#frame++ % RECOMPUTE_FRAMES !== 0) return;
    for (let b = 0; b < BUCKETS.length; b++) this.#counts[b] = 0;
    if (this.#ovation) {
      const pts = this.#ovation.points;
      for (let i = 0; i < pts.length; i += 3)
        this.#place(pts[i], pts[i + 1], pts[i + 2]);
      return;
    }
    for (let i = 0; i < this.sampleCount; i++) {
      const lat = this.#latlon[i * 2], lon = this.#latlon[i * 2 + 1];
      const v = ovalIntensity(kp, lat, lon, subsolarLonDeg);
      if (v > BUCKETS[0][0])
        this.#push(v, this.#samples[i*3], this.#samples[i*3+1], this.#samples[i*3+2]);
    }
  }

  /* OVATION points arrive as lat/lon, so build the unit vector here */
  #place(lat, lon, v) {
    if (v <= BUCKETS[0][0]) return;
    const la = lat * D2R, lo = lon * D2R;
    this.#push(v, Math.cos(la) * Math.cos(lo), -Math.sin(la), Math.cos(la) * Math.sin(lo));
  }

  #push(v, x, y, z) {
    let b = 0;
    for (let k = BUCKETS.length - 1; k >= 0; k--) if (v >= BUCKETS[k][0]) { b = k; break; }
    const pool = this.#buckets[b];
    const n = this.#counts[b];
    if (n + 3 > pool.length) return;                 // pool full: drop, never grow mid-frame
    pool[n] = x; pool[n + 1] = y; pool[n + 2] = z;
    this.#counts[b] = n + 3;
  }

  draw(p, rEarthPx, kmToPx) {
    if (!this.visible) return;
    const r = rEarthPx + EMISSION_ALT_KM * kmToPx;
    for (let b = 0; b < BUCKETS.length; b++) {
      const n = this.#counts[b];
      if (!n) continue;
      const [, cr, cg, cb, alpha, weight] = BUCKETS[b];
      p.stroke(cr, cg, cb, alpha);
      p.strokeWeight(weight);
      p.beginShape(p.POINTS);
      const pool = this.#buckets[b];
      for (let i = 0; i < n; i += 3)
        p.vertex(pool[i] * r, pool[i + 1] * r, pool[i + 2] * r);
      p.endShape();
    }
  }
}
