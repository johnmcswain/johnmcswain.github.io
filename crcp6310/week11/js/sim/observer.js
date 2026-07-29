/*
  sim/observer.js — the viewer's place in the sky. Pure topocentric
  geometry: where each object sits above a real horizon, whether it is
  actually visible to the naked eye right now, and how its range rate
  Dopplers its voice.

  FRAME DISCIPLINE: the standard topocentric formulation is written in ECI
  (X to the equinox, Z north, right-handed), so this module works there and
  converts at the edges. The renderers use the core frame (y-down, north =
  -Y); coreToEci/eciToCore are the only bridge, and both are tested.

  VISIBILITY is the real thing, not a proxy: an object is naked-eye visible
  when it is sunlit (the same cylindrical shadow test that dims the
  ensemble), the observer is in darkness (solar elevation below civil
  twilight), and it stands far enough above the horizon to clear obstruction.
  All three conditions come from geometry already computed elsewhere.

  DOPPLER HONESTY: the shift is real and computed truly (1 - v_r/c), but at
  a 7.7 km/s closing rate it is 2.6e-5 — about 0.04 Hz on a 1.5 kHz voice,
  far below audibility. audibleDoppler() therefore exaggerates the true
  ratio by a stated factor, and the HUD says so. The curve's shape and sign
  are physical; only its depth is scaled.

  PRIVACY: an Observer holds coordinates in memory for this session only.
  Nothing here transmits, stores, or logs them.
*/

'use strict';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const R_EARTH_KM = 6371;
export const C_KM_S = 299792.458;
export const TWILIGHT_DEG = -6;            // civil twilight: observer dark
export const MIN_ELEV_DEG = 10;            // clears typical obstruction

/* --- frame bridge (core is (X, -Z, Y) of ECI) ---------------------------- */
export function coreToEci(x, y, z, out, o = 0) {
  out[o] = x; out[o + 1] = z; out[o + 2] = -y;
  return out;
}
export function eciToCore(x, y, z, out, o = 0) {
  out[o] = x; out[o + 1] = -z; out[o + 2] = y;
  return out;
}

/* --- solar elevation at a place -----------------------------------------
   The hour angle reduces to (lon - subsolarLon), since the subsolar
   longitude already carries RA and GMST from the ephemeris. */
export function solarElevationDeg(latDeg, lonDeg, declDeg, subsolarLonDeg) {
  const H = (lonDeg - subsolarLonDeg) * D2R;
  const la = latDeg * D2R, de = declDeg * D2R;
  return Math.asin(Math.sin(la) * Math.sin(de) +
                   Math.cos(la) * Math.cos(de) * Math.cos(H)) * R2D;
}

/* --- compass rose -------------------------------------------------------- */
const POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function compassPoint(azDeg) {
  return POINTS[Math.round(((azDeg % 360) + 360) % 360 / 22.5) % 16];
}

/* --- Doppler ------------------------------------------------------------- */
export function dopplerRatio(rangeRateKmS) {   // true, dimensionless
  return 1 - rangeRateKmS / C_KM_S;
}
export function audibleDoppler(baseHz, rangeRateKmS, exaggeration = 2000) {
  return baseHz * (1 + exaggeration * (dopplerRatio(rangeRateKmS) - 1));
}

/* --- naked-eye visibility ----------------------------------------------- */
export function visibilityState({ elevDeg, sunlit, solarElevDeg }) {
  if (elevDeg < MIN_ELEV_DEG) return 'below horizon';
  if (!sunlit) return 'in eclipse';
  if (solarElevDeg > TWILIGHT_DEG) return 'sky too bright';
  return 'visible';
}

/* How much longer the pass stays visible. atTime(tMs) is injected by the
   caller and returns { elevDeg, sunlit, solarElevDeg } at that instant, so
   this stays pure and testable without a propagator. Returns minutes, or
   maxMin if it is still visible at the end of the search window. */
export function passEndsInMin(atTime, tMs, maxMin = 20, stepS = 30) {
  for (let sec = stepS; sec <= maxMin * 60; sec += stepS)
    if (visibilityState(atTime(tMs + sec * 1000)) !== 'visible') return sec / 60;
  return maxMin;
}

/* --- the observer (encapsulated; course-idiom collaborator) ------------- */
export class Observer {
  #lat; #lon; #altKm; #label; #source;
  constructor(latDeg, lonDeg, { altKm = 0, label = '', source = 'manual' } = {}) {
    this.#lat = latDeg; this.#lon = lonDeg; this.#altKm = altKm;
    this.#label = label; this.#source = source;
  }
  get lat() { return this.#lat; }
  get lon() { return this.#lon; }
  get label() { return this.#label; }
  get source() { return this.#source; }     // 'geolocation' | 'fallback' | 'manual'

  /* local sidereal time, degrees */
  lstDeg(gmstDeg) { return ((gmstDeg + this.#lon) % 360 + 360) % 360; }

  /* observer position in ECI, km */
  eci(gmstDeg, out) {
    const la = this.#lat * D2R, lst = this.lstDeg(gmstDeg) * D2R;
    const r = R_EARTH_KM + this.#altKm;
    out[0] = r * Math.cos(la) * Math.cos(lst);
    out[1] = r * Math.cos(la) * Math.sin(lst);
    out[2] = r * Math.sin(la);
    return out;
  }

  /* zenith direction in the CORE frame, for the horizon/meridian rings */
  zenithCore(gmstDeg, out) {
    const la = this.#lat * D2R, lst = this.lstDeg(gmstDeg) * D2R;
    return eciToCore(Math.cos(la) * Math.cos(lst),
                     Math.cos(la) * Math.sin(lst), Math.sin(la), out);
  }

  /* look angles to a satellite given in ECI km (Vallado SEZ formulation) */
  lookAt(sx, sy, sz, gmstDeg) {
    const la = this.#lat * D2R, lst = this.lstDeg(gmstDeg) * D2R;
    const r = R_EARTH_KM + this.#altKm;
    const ox = r * Math.cos(la) * Math.cos(lst);
    const oy = r * Math.cos(la) * Math.sin(lst);
    const oz = r * Math.sin(la);
    const rx = sx - ox, ry = sy - oy, rz = sz - oz;
    const range = Math.hypot(rx, ry, rz);
    const rS = Math.sin(la) * Math.cos(lst) * rx +
               Math.sin(la) * Math.sin(lst) * ry - Math.cos(la) * rz;
    const rE = -Math.sin(lst) * rx + Math.cos(lst) * ry;
    const rZ = Math.cos(la) * Math.cos(lst) * rx +
               Math.cos(la) * Math.sin(lst) * ry + Math.sin(la) * rz;
    /* clamp: exactly at the zenith or nadir the ratio can land a hair
       outside [-1,1] in floating point, and asin would return NaN */
    const sinEl = range > 0 ? Math.max(-1, Math.min(1, rZ / range)) : 0;
    return {
      rangeKm: range,
      elevDeg: Math.asin(sinEl) * R2D,
      azDeg: (Math.atan2(rE, -rS) * R2D + 360) % 360,
    };
  }
}
