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
/* The sun sits just beyond the inflow edge so the stream visibly leaves it
   rather than materialising in front of it. Its distance is compressed by a
   factor of ~1500 (the real sun is 23,455 Earth radii away). */
export const SUN_DISTANCE_RE = 19.5;
export const R_SUN_KM = 695700;
/* Size: the true radius ratio is 109x Earth, which at this compressed
   distance would swallow the whole scene, and true ANGULAR size at a
   compressed distance makes it a speck — smaller than Earth, which is what
   it looked like before. So the ratio is log-compressed, the same treatment
   the system view gives planetary distances, and stated in the footer:
   drawn at ~6x Earth's radius for a true ratio of 109x. */
/* Gain 2.6 gave a 6.3 Re disc at 19.5 Re — an angular radius of 17.9 deg,
   67x the real sun, which rendered as a wall of blown-out white filling a
   third of the frame. Gain 1.0 gives ~3 Re: unmistakably larger than Earth,
   which was the point, at a far more believable 8.9 deg. */
export const SUN_LOG_GAIN = 1.0;
export function sunDrawnRadiusKm(earthRadiusKm = 6371) {
  return earthRadiusKm * (1 + SUN_LOG_GAIN * Math.log10(R_SUN_KM / earthRadiusKm));
}
export const REF_TRANSIT_S = 9;          // visual transit at 400 km/s
const REF_SPEED = 400;

/* magnetopause nose distance, Earth radii. n in cm^-3, v in km/s */
export function magnetopauseStandoffRe(density, speedKmS) {
  const n = Math.max(0.1, density), v = Math.max(50, speedKmS);
  return 107.4 * Math.pow(n * v * v, -1 / 6);
}

/* Magnetopause SHAPE, not just its nose distance: the Shue et al. (1997)
   model, which is the standard empirical form.

     r(theta) = r0 * ( 2 / (1 + cos theta) ) ^ alpha

   theta is the angle from the sun-Earth line, r0 the subsolar standoff, and
   alpha the flaring parameter, itself a function of Bz and dynamic pressure:

     alpha = (0.58 - 0.007 Bz) (1 + 0.024 ln Dp)

   So southward Bz does not merely tint the stream — it visibly flares the
   boundary open, which is the real precondition for the reconnection that
   drives the aurora already drawn on the globe. Dp is in nPa, computed from
   the measured density and speed. */
export function dynamicPressureNPa(density, speedKmS) {
  return 1.6726e-6 * Math.max(0.01, density) * Math.max(1, speedKmS) ** 2;
}
export function flaringAlpha(bzNt, density, speedKmS) {
  const dp = dynamicPressureNPa(density, speedKmS);
  return (0.58 - 0.007 * bzNt) * (1 + 0.024 * Math.log(Math.max(0.05, dp)));
}
export function magnetopauseRadiusRe(standoffRe, thetaRad, alpha) {
  const c = Math.cos(Math.min(Math.PI * 0.92, Math.max(0, thetaRad)));
  return standoffRe * Math.pow(2 / (1 + c), alpha);
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

/* The boundary as a wireframe bowl rather than a bare circle: rings at
   several angles from the sun line plus meridional arcs, so it reads as the
   surface it is. Writes segment endpoint pairs (6 floats per segment) into
   out, and returns the segment count. Pure; both renderers draw the result. */
const RING_THETA = [22, 46, 70, 94, 116];
const RING_AZ = 40, MERID = 6, MERID_STEPS = 14, MERID_MAX = 124;

export function magnetopauseWireframe(standoffRe, alpha, sunDir, basis, out) {
  const [ux, uy, uz, vx, vy, vz] = basis;
  let n = 0;
  const put = (theta, phi, o) => {
    const r = magnetopauseRadiusRe(standoffRe, theta, alpha) * R_EARTH_KM;
    const ax = Math.cos(theta) * r, rad = Math.sin(theta) * r;
    const c = Math.cos(phi) * rad, s = Math.sin(phi) * rad;
    out[o]     = sunDir[0] * ax + ux * c + vx * s;
    out[o + 1] = sunDir[1] * ax + uy * c + vy * s;
    out[o + 2] = sunDir[2] * ax + uz * c + vz * s;
  };
  for (const degT of RING_THETA) {
    const th = degT * Math.PI / 180;
    for (let k = 0; k < RING_AZ; k++) {
      put(th, k / RING_AZ * Math.PI * 2, n * 6);
      put(th, (k + 1) / RING_AZ * Math.PI * 2, n * 6 + 3);
      n++;
    }
  }
  for (let m = 0; m < MERID; m++) {
    const phi = m / MERID * Math.PI * 2;
    for (let k = 0; k < MERID_STEPS; k++) {
      put(k / MERID_STEPS * MERID_MAX * Math.PI / 180, phi, n * 6);
      put((k + 1) / MERID_STEPS * MERID_MAX * Math.PI / 180, phi, n * 6 + 3);
      n++;
    }
  }
  return n;
}
export const MAGNETOPAUSE_SEGMENTS = RING_THETA.length * RING_AZ + MERID * MERID_STEPS;

/* THE MAGNETOTAIL. The dayside bowl is only half the boundary: the field is
   drawn out anti-sunward into a tail that really extends past 100 Re, and
   that is where substorms happen. Drawn to TAIL_MAX_RE and truncated there
   for the frame, with the radius asymptoting toward TAIL_RADIUS_RE as a real
   tail does. `stretch` (0..1) comes from the substorm's growth phase and
   lengthens and thins the tail before onset, which is the visible signature
   of energy loading. */
export const TAIL_MAX_RE = 22, TAIL_RADIUS_RE = 21;
const TAIL_RINGS = 7, TAIL_AZ = 32, TAIL_LINES = 8;
export const TAIL_SEGMENTS = TAIL_RINGS * TAIL_AZ + TAIL_LINES * TAIL_RINGS;

export function tailRadiusRe(flankRe, xRe, stretch = 0) {
  const t = Math.max(0, Math.min(1, xRe / TAIL_MAX_RE));
  const target = TAIL_RADIUS_RE * (1 - 0.14 * stretch);   // pinches as it loads
  return flankRe + (target - flankRe) * Math.pow(t, 0.55);
}

export function tailWireframe(standoffRe, alpha, stretch, sunDir, basis, out) {
  const flank = magnetopauseRadiusRe(standoffRe, Math.PI / 2, alpha);
  const len = TAIL_MAX_RE * (0.72 + 0.28 * stretch);      // stretches as it loads
  const [ux, uy, uz, vx, vy, vz] = basis;
  let n = 0;
  const put = (xRe, phi, o) => {
    const r = tailRadiusRe(flank, xRe, stretch) * R_EARTH_KM;
    const ax = -xRe * R_EARTH_KM;                          // anti-sunward
    const c = Math.cos(phi) * r, s = Math.sin(phi) * r;
    out[o]     = sunDir[0] * ax + ux * c + vx * s;
    out[o + 1] = sunDir[1] * ax + uy * c + vy * s;
    out[o + 2] = sunDir[2] * ax + uz * c + vz * s;
  };
  for (let i = 0; i < TAIL_RINGS; i++) {
    const x = (i + 1) / TAIL_RINGS * len;
    for (let k = 0; k < TAIL_AZ; k++) {
      put(x, k / TAIL_AZ * Math.PI * 2, n * 6);
      put(x, (k + 1) / TAIL_AZ * Math.PI * 2, n * 6 + 3);
      n++;
    }
  }
  for (let m = 0; m < TAIL_LINES; m++) {
    const phi = m / TAIL_LINES * Math.PI * 2;
    for (let i = 0; i < TAIL_RINGS; i++) {
      put(i / TAIL_RINGS * len, phi, n * 6);
      put((i + 1) / TAIL_RINGS * len, phi, n * 6 + 3);
      n++;
    }
  }
  return n;
}

/* Walk the propagated series as simulated time advances, interpolating
   between 1-minute samples. Returns measured conditions, so the boundary's
   motion is data replay rather than an animation curve. */
export function sampleSeries(series, tMs) {
  if (!series || series.length < 2) return null;
  const first = series[0].tMs, last = series[series.length - 1].tMs;
  const span = last - first;
  if (!(span > 0)) return null;
  /* wrap: one hour of measurements replays continuously */
  const t = first + (((tMs - first) % span) + span) % span;
  let i = 1;
  while (i < series.length - 1 && series[i].tMs < t) i++;
  const a = series[i - 1], b = series[i];
  const f = b.tMs === a.tMs ? 0 : (t - a.tMs) / (b.tMs - a.tMs);
  const mix = (x, y) => x + (y - x) * f;
  return {
    speedKmS: mix(a.speedKmS, b.speedKmS),
    density: mix(a.density, b.density),
    bzNt: mix(a.bzNt, b.bzNt),
    tMs: t,
  };
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
