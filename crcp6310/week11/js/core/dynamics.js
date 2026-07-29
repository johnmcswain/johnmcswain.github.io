/*
  core/dynamics.js — GeomDynamics and Dim3, in the course module's shape
  (GeomDynamics.pde, Dim3.pde) with the tunable constants replaced by
  measured or computed orbital quantities. This mapping is the fingerprint
  of the extension, so it is stated plainly:

      course field   ORBITA's value
      ------------   --------------------------------------------------
      spd            orbital speed, sqrt(mu/r)                  km/s
      gravity        local gravitation, mu/r^2                  km/s^2
      damping        atmospheric drag susceptibility, from B*   relative
      friction       nodal regression from Earth's J2           deg/day

  Renderer-agnostic (core boundary). Everything pure and cross-checkable:
  ISS speed ~7.66 km/s, local g at 420 km ~8.64 m/s^2, ISS nodal
  regression ~-5 deg/day, and — the check that proves the J2 term rather
  than merely exercising it — a sun-synchronous orbit returns +0.9856
  deg/day, precisely the rate Earth's own orbit advances. That orbit type
  is DEFINED by the equality, so the number falling out is a verification,
  not a fit.

  DAMPING HONESTY: B* is a drag-like coefficient in inverse Earth radii
  that folds in area/mass and the drag model of the element set's own fit.
  Converting it to a decay rate needs an atmosphere model we do not have,
  so dragProxy() returns a RELATIVE, unitless susceptibility for ranking
  and animation only. It is never presented as a lifetime or a prediction.
*/

'use strict';

const D2R = Math.PI / 180;
export const MU_KM3_S2 = 398600.4418;      // Earth GM
export const R_EARTH_KM = 6371;
export const J2 = 1.08262668e-3;

/* --- the four quantities, pure ------------------------------------------- */

export function orbitalSpeed(rKm) {        // km/s, circular
  return Math.sqrt(MU_KM3_S2 / rKm);
}

export function gravityAt(rKm) {           // km/s^2
  return MU_KM3_S2 / (rKm * rKm);
}

/* nodal regression, deg/day. Secular J2 rate:
   dOmega/dt = -3/2 * n * J2 * (Re/p)^2 * cos i,   p = a(1 - e^2) */
export function nodalRegression(aKm, e, inclDeg) {
  const n = Math.sqrt(MU_KM3_S2 / (aKm * aKm * aKm));      // rad/s
  const p = aKm * (1 - e * e);
  const rate = -1.5 * n * J2 * (R_EARTH_KM / p) ** 2 * Math.cos(inclDeg * D2R);
  return rate * 86400 / D2R;                                // deg/day
}

/* relative drag susceptibility (unitless; ranking and animation only) */
export function dragProxy(bstar, altKm) {
  const scaleHeightKm = 60;                // crude exponential falloff
  return Math.max(0, bstar) * Math.exp(-(altKm - 300) / scaleHeightKm);
}

/* --- the collaborator classes (course idiom) ----------------------------- */

/* course: GeomDynamics { spd, gravity, damping, friction } */
export class GeomDynamics {
  constructor(spd = 0, gravity = 0, damping = 0, friction = 0) {
    this.spd = spd; this.gravity = gravity;
    this.damping = damping; this.friction = friction;
  }
  /* factory standing in for Processing's overloaded constructor: derive
     the whole set from one element set */
  static fromOrbit({ altKm, ecc = 0, incl = 0, bstar = 0 }) {
    const r = R_EARTH_KM + altKm;
    return new GeomDynamics(
      orbitalSpeed(r), gravityAt(r), dragProxy(bstar, altKm),
      nodalRegression(r, ecc, incl));
  }
  /* a constant angular rate, for kinetic instrument parts (rad/s in spd) */
  static spin(radPerSec) { return new GeomDynamics(radPerSec, 0, 0, 0); }
}

/* course: Dim3 { w, h, d } — the bounding volume, injected rather than read
   from a global (the module examples flag that global as "not ideal") */
export class Dim3 {
  constructor(w = 0, h = 0, d = 0) { this.w = w; this.h = h; this.d = d; }
  get maxExtent() { return Math.max(this.w, this.h, this.d); }
  static cube(s) { return new Dim3(s, s, s); }
}
