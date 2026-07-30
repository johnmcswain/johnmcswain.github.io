/*
  sim/solarwind.js — the stream that connects the sun to the aurora.

  Until now the space weather layer had exactly one visual (the ovals) and
  four numbers in a panel. This module makes the middle of the chain
  visible: measured solar wind flowing down the sun line, and the
  magnetopause it compresses.

  REAL PHYSICS, verifiable:
    magnetopauseStandoffRe(n, v) = 107.4 * (n v^2)^(-1/6) Earth radii
    Quiet (n=5, v=400)  -> 11.1 Re, the textbook nominal standoff.
    Storm (n=20, v=800) ->  7.0 Re, the textbook storm compression.
  So the nose of the magnetosphere visibly moves inward during a storm,
  driven by the live density and speed rather than by an animation curve.

  DISCLOSED LIBERTIES, and they matter here:
    - The wind is measured at L1, roughly 1.5 million km upstream, not in
      the volume drawn. This is a rendering of the measured flow along the
      sun line, not a claim about particle positions.
    - Transit is scaled for legibility: REF_TRANSIT_S seconds at 400 km/s.
      RELATIVE speed is exact — double the measured speed and the stream
      crosses in half the time — but the absolute rate is not real. Real
      transit across this volume would be about two minutes.
    - Lateral splay approximates deflection around the magnetosphere; it is
      shaped by eye, not solved.

  Colour carries Bz sign, which is the physically meaningful part: southward
  (negative) Bz is the coupling condition that drives geomagnetic storms.

  Pure. No renderer imports.
*/

'use strict';

import { basisFromNormal } from '../core/geom.js';

export const R_EARTH_KM = 6371;
export const START_RE = 15;              // sunward edge of the drawn volume
export const REF_TRANSIT_S = 9;          // visual transit at 400 km/s
const REF_SPEED = 400;

/* magnetopause nose distance, Earth radii. n in cm^-3, v in km/s */
export function magnetopauseStandoffRe(density, speedKmS) {
  const n = Math.max(0.1, density), v = Math.max(50, speedKmS);
  return 107.4 * Math.pow(n * v * v, -1 / 6);
}

/* seconds for a particle to cross the drawn volume, at the visual scale */
export function visualTransitSec(speedKmS) {
  return REF_TRANSIT_S * REF_SPEED / Math.max(50, speedKmS);
}

/* Bz -> rgb 0..1. Northward reads calm blue, southward the coupling red. */
export function bzColour(bzNt, out) {
  const t = Math.max(0, Math.min(1, -bzNt / 12));      // 0 calm, 1 strongly south
  out[0] = 0.34 + 0.62 * t;
  out[1] = 0.62 - 0.34 * t;
  out[2] = 0.96 - 0.52 * t;
  return out;
}

export class WindStream {
  #u; #lr; #la; #seed = 987654321;
  #basis = new Float64Array(6);

  constructor(count = 260) {
    this.count = count;
    this.#u = new Float32Array(count);
    this.#lr = new Float32Array(count);
    this.#la = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.#u[i] = this.#rand();                        // spread along the flow
      this.#respawnLateral(i);
    }
    this.standoffRe = magnetopauseStandoffRe(5, 400);
  }

  #rand() {                                             // LCG: no allocation
    this.#seed = (this.#seed * 48271) % 2147483647;
    return this.#seed / 2147483647;
  }
  #respawnLateral(i) {
    this.#lr[i] = Math.sqrt(this.#rand()) * 3.4;        // Re, area-uniform
    this.#la[i] = this.#rand() * Math.PI * 2;
  }

  /* how many particles are drawn: density sets the flux */
  activeCount(density) {
    const t = Math.max(0.22, Math.min(1, density / 12));
    return Math.max(24, Math.round(this.count * t));
  }

  /* Advance and write core-frame km positions into out (3 per particle).
     sunDir is a unit vector in the core frame. Returns the active count. */
  step(dtSec, { speedKmS = 400, density = 5 } = {}, sunDir, out) {
    this.standoffRe = magnetopauseStandoffRe(density, speedKmS);
    const du = dtSec / visualTransitSec(speedKmS);
    const n = this.activeCount(density);
    basisFromNormal(sunDir[0], sunDir[1], sunDir[2], this.#basis);
    const [ux, uy, uz, vx, vy, vz] = this.#basis;
    for (let i = 0; i < n; i++) {
      let u = this.#u[i] + du;
      if (u >= 1) { u -= 1; this.#respawnLateral(i); }
      this.#u[i] = u;
      /* distance from Earth: sunward edge in toward the magnetopause nose */
      const dist = (START_RE - (START_RE - this.standoffRe) * u) * R_EARTH_KM;
      /* splay outward as the flow is deflected around the magnetosphere */
      const lat = this.#lr[i] * (1 + 1.9 * u * u) * R_EARTH_KM;
      const c = Math.cos(this.#la[i]) * lat, s = Math.sin(this.#la[i]) * lat;
      out[i*3]     = sunDir[0] * dist + ux * c + vx * s;
      out[i*3 + 1] = sunDir[1] * dist + uy * c + vy * s;
      out[i*3 + 2] = sunDir[2] * dist + uz * c + vz * s;
    }
    return n;
  }
}
