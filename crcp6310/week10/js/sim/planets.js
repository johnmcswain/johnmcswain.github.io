/*
  sim/planets.js — the six classical planets and the Moon, from JPL's
  "Approximate Positions of the Planets" mean elements (Standish),
  Kepler-solved. Good to well under a degree over centuries around J2000 —
  far beyond what the piece needs, and headlessly cross-checkable: Earth's
  heliocentric longitude must sit 180 deg from the sun ephemeris's
  geocentric one, two independent code paths agreeing on one geometry.

  All pure. Ecliptic -> equatorial -> p5 (y-down, north = -Y) provided here
  so render code never touches frames.
*/

'use strict';

const D2R = Math.PI / 180;
const OBLIQUITY = 23.43928 * D2R;

/* [name, a, aDot, e, eDot, I, IDot, L, LDot, peri, periDot, node, nodeDot]
   AU / deg, rates per Julian century (JPL approx. elements, 1800-2050) */
export const ELEMENTS = [
  ['Mercury', 0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749,
    252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  ['Venus', 0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890,
    181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  ['Earth', 1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
    100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
  ['Mars', 1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131,
    -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  ['Jupiter', 5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714,
    34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  ['Saturn', 9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609,
    49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
];

export const PLANET_META = {                 // radius km, sidereal period d, [r,g,b]
  Mercury: { radiusKm: 2440,  periodDays: 87.969,   rgb: [169, 160, 152] },
  Venus:   { radiusKm: 6052,  periodDays: 224.701,  rgb: [232, 202, 152] },
  Earth:   { radiusKm: 6371,  periodDays: 365.256,  rgb: [110, 150, 210] },
  Mars:    { radiusKm: 3390,  periodDays: 686.980,  rgb: [214, 121, 79]  },
  Jupiter: { radiusKm: 69911, periodDays: 4332.589, rgb: [216, 176, 132] },
  Saturn:  { radiusKm: 58232, periodDays: 10759.22, rgb: [226, 200, 150] },
};

export function solveKepler(Mrad, e) {       // Newton; returns E (rad)
  let E = e < 0.8 ? Mrad : Math.PI;
  for (let k = 0; k < 12; k++) {
    const d = (E - e * Math.sin(E) - Mrad) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

const wrap = d => ((d % 360) + 360) % 360;

/* heliocentric ecliptic xyz (AU) + longitude for each planet at tMs */
export function planetStates(tMs) {
  const T = (tMs / 86400000 + 2440587.5 - 2451545.0) / 36525;   // centuries
  return ELEMENTS.map(([name, a0, aD, e0, eD, I0, ID, L0, LD, p0, pD, n0, nD]) => {
    const a = a0 + aD * T, e = e0 + eD * T;
    const I = (I0 + ID * T) * D2R, peri = p0 + pD * T, node = n0 + nD * T;
    const M = wrap(L0 + LD * T - peri) * D2R;
    const w = (peri - node) * D2R, O = node * D2R;
    const E = solveKepler(M, e);
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O);
    const ci = Math.cos(I), si = Math.sin(I);
    const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
    const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
    const z = (sw * si) * xp + (cw * si) * yp;
    return { name, xyzAU: [x, y, z], a,
             lonDeg: wrap(Math.atan2(y, x) / D2R),
             distAU: Math.hypot(x, y, z), ...PLANET_META[name] };
  });
}

/* the Moon, geocentric, low-precision (few-arcmin class — plenty) */
export function moonState(tMs) {
  const n = tMs / 86400000 + 2440587.5 - 2451545.0;
  const L = 218.316 + 13.176396 * n;         // mean longitude
  const M = (134.963 + 13.064993 * n) * D2R; // mean anomaly
  const F = (93.272 + 13.229350 * n) * D2R;  // argument of latitude
  return {
    lonDeg: wrap(L + 6.289 * Math.sin(M)),
    latDeg: 5.128 * Math.sin(F),
    distKm: 385001 - 20905 * Math.cos(M),
  };
}

/* ecliptic (x to equinox, z ecliptic north) -> p5 space, in place */
export function eclipticToP5(x, y, z, out, o = 0) {
  const ce = Math.cos(OBLIQUITY), se = Math.sin(OBLIQUITY);
  const yq = y * ce - z * se, zq = y * se + z * ce;   // equatorial
  out[o] = x; out[o + 1] = -zq; out[o + 2] = yq;       // (X, -Z, Y)
  return out;
}

/* log-compressed radial mapping for the system view: monotone, disclosed */
export function compressAU(rAU, rMaxPx, aMaxAU = 9.6) {
  const k = a => Math.log1p(a / 0.25);
  return rMaxPx * k(Math.max(0, rAU)) / k(aMaxAU);
}

/* a planet-year as an audible voice (Harmonices Mundi, computed) */
export function planetHz(periodDays, octaves = 35) {
  return (1 / (periodDays * 86400)) * 2 ** octaves;
}
