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

/* Relative drag susceptibility (unitless; ranking and animation only).
   f107 is the 10.7 cm solar radio flux, the standard proxy for
   thermospheric density: at solar minimum (~70 sfu) the upper atmosphere
   is cool and thin, at maximum (~250) it is heated and expanded, and
   density at 400 km varies by roughly an order of magnitude between them.
   Modelling that as a scale height that grows with F10.7 replaces the
   fixed 60 km guess with a measured input. Still relative, still never a
   lifetime — but now driven by today's sun rather than a constant. */
export const F107_QUIET = 70;
export function scaleHeightKm(f107 = F107_QUIET) {
  const f = Math.max(60, Math.min(300, f107));
  return 50 + 40 * (f - F107_QUIET) / 180;         // ~50 km quiet, ~90 km active
}
export function dragProxy(bstar, altKm, f107 = F107_QUIET) {
  return Math.max(0, bstar) * Math.exp(-(altKm - 300) / scaleHeightKm(f107));
}

/* 0..1 emphasis for rendering: how susceptible this object is to drag right
   now, log-scaled because dragProxy spans several orders of magnitude. This
   is what lets F10.7 change what you SEE — as solar flux rises, the
   low-perigee objects swell and brighten while high shells barely move. */
export function dragEmphasis(bstar, altKm, f107 = F107_QUIET) {
  const d = dragProxy(bstar, altKm, f107);
  if (!(d > 0)) return 0;
  return Math.max(0, Math.min(1, (Math.log10(d) + 6.5) / 3.5));
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
  static fromOrbit({ altKm, ecc = 0, incl = 0, bstar = 0 }, f107 = F107_QUIET) {
    const r = R_EARTH_KM + altKm;
    return new GeomDynamics(
      orbitalSpeed(r), gravityAt(r), dragProxy(bstar, altKm, f107),
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
