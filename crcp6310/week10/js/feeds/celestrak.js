/*
  feeds/celestrak.js — LEO orbital ensemble via CelesTrak GP API (OMM JSON)
  ---------------------------------------------------------------------------
  First module of the modular refactor. Exports a feed object implementing
  the FEEDS interface (mirror of the MOTIFS registry pattern):

      { name, kind, load(opts), normalize(records), propagate(obj, tMs) }

  Privacy model demonstrated here:
    - module scope   : MU_KM3_S2, parseEpoch, meanMotionToSMA are invisible
                       outside this file — no export, no window pollution
    - #private field : CelestrakFeed keeps its cache + fetch impl private

  Usage policy: CelesTrak is a non-profit; elements update a few times/day.
  Fetch ONCE per session per group. No polling loop. The #cache enforces this.

  Format note: catalog numbers exceeded 99999 on 2026-07-11; new objects are
  6-digit and unrepresentable in TLE format. JSON/OMM is mandatory, not a
  preference. NORAD_CAT_ID is the stable id field.
*/

'use strict';

/* ---------------- module-private constants + helpers (not exported) ------ */

const MU_KM3_S2   = 398600.4418;          // Earth GM, km^3/s^2
const R_EARTH_KM  = 6371.0;               // mean radius, for altitude
const SEC_PER_DAY = 86400;
const GP_BASE     = 'https://celestrak.org/NORAD/elements/gp.php';

/* OMM EPOCH is ISO 8601 UTC without a trailing Z, e.g. 2026-07-14T06:21:44.  */
function parseEpoch(iso) {
  const t = Date.parse(iso.endsWith('Z') ? iso : iso + 'Z');
  return Number.isFinite(t) ? t : NaN;
}

/* mean motion (rev/day) -> semi-major axis (km) via Kepler's third law */
function meanMotionToSMA(revPerDay) {
  const nRadS = revPerDay * 2 * Math.PI / SEC_PER_DAY;   // rad/s
  return Math.cbrt(MU_KM3_S2 / (nRadS * nRadS));
}

function wrap360(deg) { return ((deg % 360) + 360) % 360; }

/* ---------------- public interface --------------------------------------- */

/* Curated groups worth pointing the mandala at. Keys are CelesTrak GROUP=. */
export const GROUPS = {
  active:        'all active payloads (~large; cap client-side)',
  starlink:      'Starlink shells — dense co-planar rings, near-unison voices',
  'last-30-days':'newest catalog entries — the "recent events" layer',
  stations:      'crewed stations (ISS, Tiangong)',
  'cosmos-2251-debris': 'collision debris cloud — the entropy layer',
};

/* Map an ensemble's orbital frequency into the audible band.
   f_orbit = revPerDay / 86400 Hz; +23 octaves puts LEO at ~1.2–1.7 kHz.
   Exported because the Sonifier will share it. */
export const OCTAVE_SHIFT = 23;
export function orbitalHz(revPerDay, octaves = OCTAVE_SHIFT) {
  return (revPerDay / SEC_PER_DAY) * 2 ** octaves;
}

export class CelestrakFeed {
  /* private state: session cache and injectable fetch (for headless tests) */
  #cache = new Map();
  #fetchImpl;

  constructor({ fetchImpl } = {}) {
    this.#fetchImpl = fetchImpl ?? ((...a) => fetch(...a));
  }

  name = 'celestrak';
  kind = 'ensemble';                       // vs. 'events' for the USGS feed

  url(group) { return `${GP_BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=JSON`; }

  /* Fetch once per group per session; later calls hit the private cache. */
  async load(group = 'starlink') {
    if (this.#cache.has(group)) return this.#cache.get(group);
    const res = await this.#fetchImpl(this.url(group));
    if (!res.ok) throw new Error(`celestrak ${group}: HTTP ${res.status}`);
    const objects = this.normalize(await res.json());
    this.#cache.set(group, objects);
    return objects;
  }

  /* OMM records -> renderer-neutral objects. Drops records that would put
     NaN into the draw loop (the Physarum lesson). */
  normalize(records) {
    const out = [];
    for (const r of records ?? []) {
      const n     = Number(r.MEAN_MOTION);
      const epoch = parseEpoch(String(r.EPOCH ?? ''));
      if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(epoch)) continue;

      const smaKm = meanMotionToSMA(n);
      out.push({
        id:        String(r.NORAD_CAT_ID),          // 6-digit safe
        name:      r.OBJECT_NAME ?? 'UNKNOWN',
        intdes:    r.OBJECT_ID ?? '',
        epoch,                                       // ms UTC
        meanMotion: n,                               // rev/day
        incl:      Number(r.INCLINATION)   || 0,     // deg, 0..~180
        ecc:       Number(r.ECCENTRICITY)  || 0,
        raan:      Number(r.RA_OF_ASC_NODE) || 0,    // deg
        argp:      Number(r.ARG_OF_PERICENTER) || 0, // deg
        m0:        Number(r.MEAN_ANOMALY)  || 0,     // deg at epoch
        bstar:     Number(r.BSTAR)         || 0,
        smaKm,
        altKm:     smaKm - R_EARTH_KM,
        periodMin: 1440 / n,
        freqHz:    orbitalHz(n),
      });
    }
    return out;
  }

  /* Phase now. Mean-element circular approximation: no SGP4, no deps.
     Accuracy is irrelevant here — the mandala needs phase, not position. */
  propagate(obj, tMs = Date.now()) {
    const dtDays = (tMs - obj.epoch) / (SEC_PER_DAY * 1000);
    return {
      meanAnomaly: wrap360(obj.m0 + obj.meanMotion * 360 * dtDays), // deg
      /* in-plane angle projected as mandala angle: RAAN offsets the plane,
         mean anomaly turns within it — co-planar shells rotate in lockstep */
      angle:       wrap360(obj.raan + obj.m0 + obj.meanMotion * 360 * dtDays),
      staleDays:   dtDays,                 // -> alpha; stale elements fade
    };
  }
}

export default new CelestrakFeed();
