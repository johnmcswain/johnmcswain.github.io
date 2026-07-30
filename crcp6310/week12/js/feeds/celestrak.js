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

  USAGE POLICY, and the reason for the persistent cache. CelesTrak is a
  non-profit that rate-limits and will return 403 to clients it considers
  abusive. A per-session memory cache is not enough during development,
  where every page reload is a new session and every group cycle another
  request — that pattern earns a 403 quickly. Elements only update a few
  times a day, so results are also cached in localStorage for CACHE_TTL_MS
  and reused across reloads, which cuts requests from "every refresh" to a
  handful per day. A 403 or 429 sets a backoff window during which we do
  not ask again at all, and the HUD reports why rather than silently
  showing recorded data as if it were live.

  Storage is wrapped in try/catch: it is absent or throws in some embedding
  contexts, and the feed must work without it.

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
const STORE_PREFIX = 'orbita:gp:';
const BLOCK_KEY    = 'orbita:gp:blockedUntil';
export const CACHE_TTL_MS = 6 * 3600 * 1000;      // elements update a few times/day
export const BLOCK_BACKOFF_MS = 2 * 3600 * 1000;  // after a 403/429, stop asking

/* localStorage, defensively: absent or throwing in some contexts */
function storeGet(key) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function storeSet(key, value) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

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
  #now;

  constructor({ fetchImpl, now } = {}) {
    this.#fetchImpl = fetchImpl ?? ((...a) => fetch(...a));
    this.#now = now ?? (() => Date.now());
    /* how the last load resolved, for honest HUD reporting */
    this.lastSource = null;      // 'live' | 'cached' | null
    this.lastError = null;       // { status, message } | null
  }

  get blockedUntil() { return storeGet(BLOCK_KEY) || 0; }
  get isBlocked() { return this.#now() < this.blockedUntil; }
  get blockedMinutesLeft() {
    return Math.max(0, Math.ceil((this.blockedUntil - this.#now()) / 60000));
  }

  name = 'celestrak';
  kind = 'ensemble';                       // vs. 'events' for the USGS feed

  url(group) { return `${GP_BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=JSON`; }

  /* Memory cache, then persistent cache, then (if not backed off) network. */
  async load(group = 'starlink') {
    this.lastError = null;
    if (this.#cache.has(group)) { this.lastSource = 'cached'; return this.#cache.get(group); }

    const stored = storeGet(STORE_PREFIX + group);
    const fresh = stored && (this.#now() - stored.t) < CACHE_TTL_MS;
    if (fresh) {
      this.#cache.set(group, stored.objects);
      this.lastSource = 'cached';
      return stored.objects;
    }

    /* honouring a previous 403/429: do not ask again inside the window */
    if (this.isBlocked) {
      this.lastError = { status: 403,
        message: `backing off ${this.blockedMinutesLeft} min after a refusal` };
      if (stored) { this.lastSource = 'cached'; return stored.objects; }
      throw new Error(`celestrak ${group}: ${this.lastError.message}`);
    }

    let res;
    try {
      res = await this.#fetchImpl(this.url(group));
    } catch (e) {
      this.lastError = { status: 0, message: 'network unreachable' };
      if (stored) { this.lastSource = 'cached'; return stored.objects; }
      throw e;
    }
    if (!res.ok) {
      this.lastError = { status: res.status,
        message: res.status === 403 || res.status === 429
          ? 'CelesTrak declined the request (rate limit)'
          : `HTTP ${res.status}` };
      if (res.status === 403 || res.status === 429)
        storeSet(BLOCK_KEY, this.#now() + BLOCK_BACKOFF_MS);
      if (stored) { this.lastSource = 'cached'; return stored.objects; }
      throw new Error(`celestrak ${group}: ${this.lastError.message}`);
    }

    const objects = this.normalize(await res.json());
    this.#cache.set(group, objects);
    storeSet(STORE_PREFIX + group, { t: this.#now(), objects });
    this.lastSource = 'live';
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
