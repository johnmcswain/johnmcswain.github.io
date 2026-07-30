/*
  core/geom.js — pure orientation and graduation math, shared by both
  renderers. Lifted out of render/ when the Three build needed the same
  ring geometry: duplicating it there is how the two builds drift.
  Renderer-agnostic (core boundary). Core frame: y-down, north = -Y.
*/

'use strict';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
export const OBLIQUITY_DEG = 23.43928;

/* an orthonormal basis (u, v) spanning the plane with the given normal */
export function basisFromNormal(nx, ny, nz, out) {
  const d = Math.hypot(nx, ny, nz) || 1;
  nx /= d; ny /= d; nz /= d;
  let ax = 0, ay = 0, az = 1;
  if (Math.abs(nz) > 0.9) { ax = 1; az = 0; }
  let ux = ny * az - nz * ay, uy = nz * ax - nx * az, uz = nx * ay - ny * ax;
  const du = Math.hypot(ux, uy, uz);
  ux /= du; uy /= du; uz /= du;
  out[0] = ux; out[1] = uy; out[2] = uz;
  out[3] = ny * uz - nz * uy; out[4] = nz * ux - nx * uz; out[5] = nx * uy - ny * ux;
  return out;
}

/* major divisions with minor subdivisions around a circle */
export function tickAngles(major, minorPerMajor) {
  const out = [];
  for (let i = 0; i < major; i++) {
    out.push({ theta: i / major * TAU, major: true });
    for (let j = 1; j < minorPerMajor; j++)
      out.push({ theta: (i + j / minorPerMajor) / major * TAU, major: false });
  }
  return out;
}

/* the Greenwich meridian plane's normal in the celestial frame at GMST */
export function meridianNormal(gmstDeg, out) {
  const g = gmstDeg * D2R;
  out[0] = Math.sin(g); out[1] = 0; out[2] = Math.cos(g);
  return out;
}

/* the local meridian plane: perpendicular to both zenith and the pole.
   With north = -Y this reduces to (zz, 0, -zx). */
export function localMeridianNormal(zx, zy, zz, out) {
  const d = Math.hypot(zz, zx);
  if (d < 1e-9) { out[0] = 1; out[1] = 0; out[2] = 0; return out; }
  out[0] = zz / d; out[1] = 0; out[2] = -zx / d;
  return out;
}

/* the ecliptic pole, tilted from the celestial pole by the obliquity */
export function eclipticPole(out) {
  const e = OBLIQUITY_DEG * D2R;
  out[0] = 0; out[1] = -Math.cos(e); out[2] = Math.sin(e);
  return out;
}

/* a point on a ring: centre + u*cos + v*sin, scaled by radius */
export function ringPoint(basis, theta, radius, out, o = 0) {
  const c = Math.cos(theta) * radius, s = Math.sin(theta) * radius;
  out[o]     = basis[0] * c + basis[3] * s;
  out[o + 1] = basis[1] * c + basis[4] * s;
  out[o + 2] = basis[2] * c + basis[5] * s;
  return out;
}
