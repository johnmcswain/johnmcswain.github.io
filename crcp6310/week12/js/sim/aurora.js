/*
  sim/aurora.js — where the aurora is, from live geomagnetic activity.

  TWO SOURCES, ONE INTERFACE. If SWPC's OVATION grid parses, we use it:
  that is the operational model's own output. If it does not, we compute
  an oval from the live Kp index instead. The fallback is not invented
  data — Kp is measured, and the oval's dependence on Kp is real physics
  (severe storms genuinely push the aurora toward 45 deg geomagnetic
  latitude) — but it IS a dipole approximation, and the HUD says which
  source is in use.

  DISCLOSED APPROXIMATIONS in the computed oval:
    - geomagnetic latitude from a dipole pole at 80.7N 72.7W (epoch ~2025;
      the real pole drifts and the field is not a clean dipole)
    - solar local time stands in for magnetic local time, so the oval's
      nightside offset is approximate
    - emission altitude fixed at 110 km

  All pure. No renderer imports.
*/

'use strict';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/* north geomagnetic (dipole) pole, epoch ~2025 — it drifts, hence the note */
export const DIPOLE_POLE = { latDeg: 80.7, lonDeg: -72.7, epoch: '~2025' };
export const EMISSION_ALT_KM = 110;

/* geomagnetic latitude of a geographic point (signed; south comes out negative) */
export function geomagneticLatDeg(latDeg, lonDeg) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  const lp = DIPOLE_POLE.latDeg * D2R, gp = DIPOLE_POLE.lonDeg * D2R;
  return Math.asin(Math.max(-1, Math.min(1,
    Math.sin(la) * Math.sin(lp) +
    Math.cos(la) * Math.cos(lp) * Math.cos(lo - gp)))) * R2D;
}

/* solar local time in hours: 12 at the subsolar longitude, 0 at midnight */
export function solarLocalTimeHours(lonDeg, subsolarLonDeg) {
  return (((lonDeg - subsolarLonDeg) / 15 + 12) % 24 + 24) % 24;
}

/* The oval has two boundaries, and it does not merely slide equatorward as
   activity rises — it also widens, because the poleward edge moves much
   less than the equatorward one. Modelling both separately reproduces that:
   ~6 deg wide when quiet, ~17 deg during a severe storm. */
export function ovalEquatorwardDeg(kp, sltHours) {
  const mlt = sltHours / 24 * Math.PI * 2;        // 0 at magnetic midnight
  return 67 - 2.2 * kp - 3.5 * Math.cos(mlt);
}
export function ovalPolewardDeg(kp, sltHours) {
  const mlt = sltHours / 24 * Math.PI * 2;
  return 73 - 0.7 * kp - 1.5 * Math.cos(mlt);
}
export function ovalWidthDeg(kp, sltHours = 0) {
  return ovalPolewardDeg(kp, sltHours) - ovalEquatorwardDeg(kp, sltHours);
}

/* Auroral intensity at a geographic point. The optional substorm terms come
   from sim/substorm.js: `polewardDeg` slides the whole band (equatorward
   while the tail loads, then a poleward surge at breakup) and `gain` scales
   the brightness. Gain may exceed 1 — a substorm breakup genuinely is several
   times brighter than the quiet oval, and the renderers use the excess. */
export function ovalIntensity(kp, latDeg, lonDeg, subsolarLonDeg, opts = {}) {
  const { gain = 1, polewardDeg = 0 } = opts;
  const mlat = Math.abs(geomagneticLatDeg(latDeg, lonDeg));
  const slt = solarLocalTimeHours(lonDeg, subsolarLonDeg);
  const eq = ovalEquatorwardDeg(kp, slt) + polewardDeg;
  const po = ovalPolewardDeg(kp, slt) + polewardDeg;
  if (mlat < eq || mlat > po || po <= eq) return 0;
  const band = Math.sin(Math.PI * (mlat - eq) / (po - eq));  // peak mid-band
  const mlt = slt / 24 * Math.PI * 2;
  const night = 0.55 + 0.45 * Math.cos(mlt);                 // brightest at midnight
  const base = Math.max(0, Math.min(1, band * night * (0.25 + kp / 9 * 0.75)));
  return Math.min(2.5, base * Math.max(0, gain));
}

/* ---- the sampling grid, shared by both renderers ------------------------
   Renderer-agnostic so the p5 and Three layers cannot drift apart on
   sampling density. Returns unit vectors in the core frame (north = -Y)
   plus the matching lat/lon pairs for intensity evaluation. */
export const GRID = { latMin: 40, latMax: 88, latStep: 2, lonStep: 5 };

export function auroraGrid(opts = {}) {
  const { latMin, latMax, latStep, lonStep } = { ...GRID, ...opts };
  const vecs = [], ll = [];
  for (let a = latMin; a <= latMax; a += latStep)
    for (const lat of [a, -a])
      for (let lon = 0; lon < 360; lon += lonStep) {
        const la = lat * D2R, lo = lon * D2R;
        vecs.push(Math.cos(la) * Math.cos(lo), -Math.sin(la), -Math.cos(la) * Math.sin(lo));
        ll.push(lat, lon);
      }
  return { vectors: Float32Array.from(vecs), latlon: Float32Array.from(ll),
           count: ll.length / 2 };
}

/* ---- OVATION grid: validate, then thin ---------------------------------
   Expected shape { coordinates: [[lon, lat, value], ...] } at roughly
   1024x512, which is far more points than the piece can draw. Validation
   is strict on purpose: a shape we do not recognise must fall through to
   the computed oval rather than render nonsense. Returns null on reject. */
export function parseOvation(payload, { stride = 6, minValue = 4 } = {}) {
  const coords = payload && payload.coordinates;
  if (!Array.isArray(coords) || coords.length < 1000) return null;
  const probe = coords[0];
  if (!Array.isArray(probe) || probe.length < 3) return null;
  if (!probe.every(v => Number.isFinite(Number(v)))) return null;
  const out = [];
  for (let i = 0; i < coords.length; i += stride) {
    const c = coords[i];
    if (!Array.isArray(c) || c.length < 3) continue;
    const lon = Number(c[0]), lat = Number(c[1]), val = Number(c[2]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(val)) continue;
    if (lat < -90 || lat > 90 || val < minValue) continue;
    out.push(lat, ((lon + 180) % 360 + 360) % 360 - 180, Math.min(1, val / 100));
  }
  if (out.length < 30) return null;                // nothing above threshold
  return {
    points: Float32Array.from(out),
    count: out.length / 3,
    observationTime: payload['Observation Time'] ?? payload.observationTime ?? null,
  };
}
