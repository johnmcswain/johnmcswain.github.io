/*
  sim/magnetosphere.js — parametric geometry for three complex custom 3D
  objects, and the physics that shapes them. Pure; both renderers build
  meshes from these functions rather than from primitives.

  THE THREE OBJECTS, and why each is the shape it is:

  1. TOROID — the Van Allen radiation belts. Genuinely toroidal: charged
     particles are trapped on closed field lines encircling Earth, so the
     population forms a doughnut about the GEOMAGNETIC axis, not the
     rotation axis. Inner belt (protons) centres near L = 1.6, outer belt
     (electrons) near L = 4.5.

  2. HELIX — a trapped particle's actual path. Particles gyrate tightly
     around a field line while streaming along it, so the trajectory is a
     helix wrapped around a CURVED guide, not a cylinder. Building it needs
     a moving frame along the field line, which is what makes it a real
     3D curve rather than a stretched primitive.

  3. FIELD SHELL — a surface of revolution swept from the dipole field line
     r = L·Re·cos^2(lambda), the classic dipole form. Sweeping that curve
     about the magnetic axis produces the L-shell: the surface on which
     trapped particles live, and whose feet are exactly where the auroral
     ovals sit.

  The magnetic axis is tilted ~9.3 deg from the rotation axis (the dipole
  pole is at 80.7N), which is why the belts sit askew and why the South
  Atlantic Anomaly exists. Everything here is in the EARTH-FIXED frame, so
  it belongs inside the rotating group with the coastlines.
*/

'use strict';

import { basisFromNormal } from '../core/geom.js';
import { DIPOLE_POLE } from './aurora.js';

const D2R = Math.PI / 180;
export const R_EARTH_KM = 6371;

/* belt geometry, in Earth radii */
export const BELTS = [
  { name: 'inner (protons)',   L: 1.6, halfWidth: 0.55, rgb: [232, 148, 82] },
  { name: 'outer (electrons)', L: 4.5, halfWidth: 1.45, rgb: [126, 176, 235] },
];

/* the geomagnetic axis in the earth-fixed core frame (left-handed: see
   core/math.js). This is the same pole the auroral oval model uses. */
export function magneticAxis(out) {
  const la = DIPOLE_POLE.latDeg * D2R, lo = DIPOLE_POLE.lonDeg * D2R;
  out[0] = Math.cos(la) * Math.cos(lo);
  out[1] = -Math.sin(la);
  out[2] = -Math.cos(la) * Math.sin(lo);
  return out;
}

export function dipoleTiltDeg() { return 90 - DIPOLE_POLE.latDeg; }

/* ---- 1. toroid ---------------------------------------------------------
   P(theta, phi) = (R + r cos phi)(cos theta u + sin theta v) + r sin phi A */
export function torusPoint(axis, basis, R, r, theta, phi, out, o = 0) {
  const ring = R + r * Math.cos(phi), h = r * Math.sin(phi);
  const ct = Math.cos(theta), st = Math.sin(theta);
  for (let k = 0; k < 3; k++)
    out[o + k] = ring * (basis[k] * ct + basis[3 + k] * st) + h * axis[k];
  return out;
}

/* ---- 3. dipole field line, and the shell swept from it -----------------
   r(lambda) = L cos^2(lambda), in Earth radii. The line reaches the
   surface where cos^2(lambda) = 1/L, giving the foot latitude. */
export function fieldLineRadiusRe(L, lambdaRad) {
  return L * Math.cos(lambdaRad) ** 2;
}
export function footLatitudeDeg(L) {
  return L <= 1 ? 0 : Math.acos(Math.sqrt(1 / L)) / D2R;
}
export function fieldLinePoint(axis, basis, L, lambdaRad, thetaRad, out, o = 0) {
  const rr = fieldLineRadiusRe(L, lambdaRad);
  const ct = Math.cos(thetaRad), st = Math.sin(thetaRad);
  const cl = Math.cos(lambdaRad), sl = Math.sin(lambdaRad);
  for (let k = 0; k < 3; k++)
    out[o + k] = rr * (cl * (basis[k] * ct + basis[3 + k] * st) + sl * axis[k]);
  return out;
}

/* ---- 2. helix wrapped around the curved field line ---------------------
   Samples the guide curve, builds a frame perpendicular to its tangent at
   each step, and offsets by the gyroradius. turns is the number of
   gyrations across the sampled span; gyroRe the radius in Earth radii. */
export function trappedHelix(axis, basis, L, thetaRad, {
  samples = 220, turns = 26, gyroRe = 0.12, phase = 0, span = 0.94,
} = {}, out) {
  const latMax = footLatitudeDeg(L) * D2R * span;
  const a = new Float64Array(3), b = new Float64Array(3), fr = new Float64Array(6);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const lam = -latMax + 2 * latMax * t;
    fieldLinePoint(axis, basis, L, lam, thetaRad, a);
    /* tangent by forward difference, wrapping at the final sample */
    const dl = 2 * latMax / (samples - 1) * (i === samples - 1 ? -1 : 1);
    fieldLinePoint(axis, basis, L, lam + dl, thetaRad, b);
    const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    basisFromNormal(tx, ty, tz, fr);
    /* gyroradius grows where the field is weaker, i.e. near the equator */
    const g = gyroRe * (0.35 + 0.65 * Math.cos(lam) ** 3);
    const ang = phase + turns * Math.PI * 2 * t;
    const c = Math.cos(ang) * g, s = Math.sin(ang) * g;
    for (let k = 0; k < 3; k++)
      out[i * 3 + k] = a[k] + fr[k] * c + fr[3 + k] * s;
  }
  return samples;
}

/* ---- shared wireframe emitters -----------------------------------------
   Both renderers build their meshes from these, so the two builds cannot
   drift into different geometry. Each writes segment endpoint pairs
   (6 floats per segment) and returns the segment count. */

export function torusSegmentCount(rings, sides) { return rings * sides * 2; }
export function torusWireframe(axis, basis, R, r, rings, sides, out) {
  const a = new Float64Array(3), b = new Float64Array(3);
  let n = 0;
  const seg = (t1, p1, t2, p2) => {
    torusPoint(axis, basis, R, r, t1, p1, a);
    torusPoint(axis, basis, R, r, t2, p2, b);
    out.set(a, n * 6); out.set(b, n * 6 + 3); n++;
  };
  const TAU = Math.PI * 2;
  for (let i = 0; i < rings; i++) {
    const t1 = i / rings * TAU, t2 = (i + 1) / rings * TAU;
    for (let j = 0; j < sides; j++) {
      const p1 = j / sides * TAU, p2 = (j + 1) / sides * TAU;
      seg(t1, p1, t1, p2);        // around the tube
      seg(t1, p1, t2, p1);        // along the ring
    }
  }
  return n;
}

export function shellSegmentCount(meridians, steps) {
  return meridians * steps + (steps + 1) * meridians;
}
export function fieldShellWireframe(axis, basis, L, meridians, steps, out) {
  const latMax = footLatitudeDeg(L) * D2R;
  const a = new Float64Array(3), b = new Float64Array(3);
  let n = 0;
  const TAU = Math.PI * 2;
  const put = () => { out.set(a, n * 6); out.set(b, n * 6 + 3); n++; };
  for (let m = 0; m < meridians; m++) {
    const th = m / meridians * TAU;
    for (let k = 0; k < steps; k++) {           // the field line itself
      fieldLinePoint(axis, basis, L, -latMax + 2 * latMax * (k / steps), th, a);
      fieldLinePoint(axis, basis, L, -latMax + 2 * latMax * ((k + 1) / steps), th, b);
      put();
    }
  }
  for (let k = 0; k <= steps; k++) {            // rings joining the meridians
    const lam = -latMax + 2 * latMax * (k / steps);
    for (let m = 0; m < meridians; m++) {
      fieldLinePoint(axis, basis, L, lam, m / meridians * TAU, a);
      fieldLinePoint(axis, basis, L, lam, (m + 1) / meridians * TAU, b);
      put();
    }
  }
  return n;
}

/* the helix as segments, so it batches with everything else */
export function helixWireframe(axis, basis, L, theta, opts, scratch, out) {
  const n = trappedHelix(axis, basis, L, theta, opts, scratch);
  for (let i = 0; i < n - 1; i++) {
    out.set(scratch.subarray(i * 3, i * 3 + 3), i * 6);
    out.set(scratch.subarray((i + 1) * 3, (i + 1) * 3 + 3), i * 6 + 3);
  }
  return n - 1;
}

/* convenience: the perpendicular basis for the magnetic axis */
export function magneticBasis(axis, out) {
  return basisFromNormal(axis[0], axis[1], axis[2], out);
}
