/*
  core/math.js — renderer-agnostic orbital + presentation math.
  THE BOUNDARY: this module (and feeds/, sim/, audio.js, state.js) never
  imports p5-specific or three-specific code. Both renderers compose on
  top of it; build.py enforces the import direction. Coordinates are in
  the shared frame (y-down, north = -Y); the three renderer converts.
*/

'use strict';

const D2R = Math.PI / 180, TRAIL_S = 1.6, TRAIL_MIN = 2, TRAIL_MAX = 42;
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

