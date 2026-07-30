/*
  sim/groundtrack.js — the focused object's path over the rotating Earth.
  ECI positions convert to the earth-fixed frame by undoing GMST; the
  ring buffer keeps recent surface directions (unit vectors), and recency
  is the fade. Because Earth's sidereal rotation is honest, the classic
  westward-drifting sinusoid emerges from the propagator by itself.
*/

'use strict';

/* rotate about the polar (p5 y) axis — ECI -> earth-fixed uses +gmst,
   the inverse of the -gmst the globe is drawn under */
export function eciToEarthFixed(x, y, z, gmstRad, out, o = 0) {
  /* the inverse of the rotation the globe is drawn under */
  const c = Math.cos(-gmstRad), s = Math.sin(-gmstRad);
  out[o] = x * c + z * s; out[o + 1] = y; out[o + 2] = -x * s + z * c;
  return out;
}

export class GroundTrack {
  constructor(cap = 420) {
    this.cap = cap;
    this.pts = new Float32Array(cap * 3);      // earth-fixed unit vectors
    this.n = 0;                                 // valid count
    this.head = 0;                              // next write slot
  }
  reset() { this.n = 0; this.head = 0; }
  /* push the sub-satellite direction (normalizes; NaN-gated) */
  push(x, y, z) {
    const d = Math.hypot(x, y, z);
    if (!Number.isFinite(d) || d === 0) return;
    const i = this.head * 3;
    this.pts[i] = x / d; this.pts[i + 1] = y / d; this.pts[i + 2] = z / d;
    this.head = (this.head + 1) % this.cap;
    if (this.n < this.cap) this.n++;
  }
  /* iterate oldest -> newest: cb(x, y, z, recency 0..1) */
  each(cb) {
    for (let k = 0; k < this.n; k++) {
      const idx = ((this.head - this.n + k) % this.cap + this.cap) % this.cap;
      const i = idx * 3;
      cb(this.pts[i], this.pts[i + 1], this.pts[i + 2], (k + 1) / this.n);
    }
  }
}
