/*
  sim/sun.js — the sun, and what it does to the ensemble. Low-precision
  solar ephemeris (Meeus-style, good to ~0.01 deg — far beyond what the
  piece needs), Greenwich sidereal angle, and a cylindrical Earth-shadow
  test. Everything pure and headlessly testable against known dates:
  equinox declination ~0, June solstice ~ +23.4, December ~ -23.4.

  Frames: satellites live in an ECI-ish frame (RAAN from the equinox);
  the globe is earth-fixed and rotates under them by GMST. The same
  ephemeris feeds both: eciDir shades the ensemble, earth-fixed subsolar
  lat/lon shades the coastlines inside the rotated frame.
*/

'use strict';

const D2R = Math.PI / 180;
const R_EARTH_KM = 6371;

/* The sun's mean angular radius from Earth: 0.267 deg. True distance
   (23,455 Earth radii) can't fit any canvas, but angular size can be
   honest: at whatever distance the marker sits, the photosphere disc
   subtends what the real sun subtends. Glare/corona is artistic. */
export const SUN_ANGULAR_RADIUS_RAD = 0.267 * D2R;
export function sunDiscRadius(distPx) {
  return distPx * Math.tan(SUN_ANGULAR_RADIUS_RAD);
}

export function sunEphemeris(tMs) {
  const n = tMs / 86400000 + 2440587.5 - 2451545.0;    // days since J2000
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * D2R;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;

  const decl = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = ((280.46061837 + 360.98564736629 * n) % 360 + 360) % 360;
  const subsolarLon = ((ra / D2R - gmst) % 360 + 540) % 360 - 180;   // [-180,180)

  /* ECI unit vector (X to equinox, Z north) -> p5 space (X, -Z, Y) */
  const eciDir = [
    Math.cos(lam),
    -Math.sin(eps) * Math.sin(lam),
    -Math.cos(eps) * Math.sin(lam),
  ];
  return { declDeg: decl / D2R, subsolarLonDeg: subsolarLon, gmstDeg: gmst, eciDir };
}

/* Cylindrical shadow: dark iff behind the terminator plane AND within one
   Earth radius of the anti-solar axis. pos in km (p5 frame), sun = unit. */
export function inShadow(x, y, z, sun) {
  const along = x * sun[0] + y * sun[1] + z * sun[2];
  if (along >= 0) return false;                        // sun side: lit
  const px = x - along * sun[0], py = y - along * sun[1], pz = z - along * sun[2];
  return px * px + py * py + pz * pz < R_EARTH_KM * R_EARTH_KM;
}
