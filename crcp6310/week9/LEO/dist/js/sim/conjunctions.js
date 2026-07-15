/*
  sim/conjunctions.js — close-approach detection over the true-scale km
  positions, the "punctuated events" layer of the piece. Uniform spatial
  grid (cell = threshold) so each frame is O(n): only the 27 neighboring
  cells are compared. Pure — exported for the headless suite and shared
  with nothing p5.

  A pair closer than thresholdKm is a conjunction; the renderer blooms it
  and the Sonifier chimes it. Real screening uses covariance and days of
  lookahead — this is the artistic reading of the same physics, and the
  HUD labels it "close pairs", not "collision risk".
*/

'use strict';

/* positions: Float32Array of n*3 true-scale km, fold-0.
   Returns array of [i, j, distKm] — allocation here is fine: events are
   rare (a handful/frame at worst), not steady-state per-object work. */
export function findClosePairs(positions, n, thresholdKm) {
  const cell = thresholdKm, grid = new Map(), out = [];
  const key = (x, y, z) => x + ',' + y + ',' + z;
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(positions[i*3]   / cell);
    const cy = Math.floor(positions[i*3+1] / cell);
    const cz = Math.floor(positions[i*3+2] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(key(cx+dx, cy+dy, cz+dz));
          if (!bucket) continue;
          for (const j of bucket) {
            const X = positions[i*3] - positions[j*3];
            const Y = positions[i*3+1] - positions[j*3+1];
            const Z = positions[i*3+2] - positions[j*3+2];
            const d = Math.sqrt(X*X + Y*Y + Z*Z);
            if (d < thresholdKm) out.push([j, i, d]);
          }
        }
    const k = key(cx, cy, cz);
    let bucket = grid.get(k);
    if (!bucket) grid.set(k, bucket = []);
    bucket.push(i);
  }
  return out;
}

/* Bloom pool: fixed capacity, oldest recycled. life 0..1. */
export class Blooms {
  constructor(cap = 24) {
    this.cap = cap;
    this.items = Array.from({ length: cap }, () => ({ x:0, y:0, z:0, life: 0 }));
    this.cursor = 0;
  }
  spawn(x, y, z) {
    const b = this.items[this.cursor];
    b.x = x; b.y = y; b.z = z; b.life = 1;
    this.cursor = (this.cursor + 1) % this.cap;
  }
  step(dt) {                                // dt in seconds; ~1.4 s bloom
    for (const b of this.items) if (b.life > 0) b.life = Math.max(0, b.life - dt / 1.4);
  }
}
