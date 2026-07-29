/*
  feeds/spaceweather.js — NOAA SWPC, the sun's effect on the ensemble.
  Implements the FEEDS interface shape (name, kind, load, normalize).

  Endpoints (public, keyless, services.swpc.noaa.gov). Each field has a
  CANDIDATE CHAIN, tried in order, because two things bite in the browser:
  the legacy /products/solar-wind/ paths do not send Access-Control-Allow-
  Origin (so a page on another domain cannot read them), and SWPC listed
  those RTSW products for deprecation around 2026-04-30. The
  /products/summary/ equivalents are the supported, much smaller products
  and are tried first.

    Kp        products/noaa-planetary-k-index.json
    speed     products/summary/solar-wind-speed.json
              -> products/solar-wind/plasma-1-day.json   (legacy, no CORS)
    density   products/solar-wind/plasma-1-day.json       (legacy only)
    Bz        products/summary/solar-wind-mag-field.json
              -> products/solar-wind/mag-1-day.json       (legacy, no CORS)
    scales    products/noaa-scales.json
    F10.7     products/10cm-flux-30-day.json -> json/f107_cm_flux.json

  A blocked cross-origin request is logged by the browser no matter how the
  code handles it, so the console will show CORS lines for any legacy URL
  that gets tried. FAILED_URLS remembers them for the session so each is
  attempted at most once rather than on every refresh.

  TOLERANT PARSING, ON PURPOSE. SWPC serves several shapes: arrays of
  arrays with a header row, and arrays of objects. Rather than hard-code
  one, each reader finds its column by name and fails to null. A null
  field is reported as such and the HUD shows which values are live —
  per-field provenance, not a single all-or-nothing flag. This also means
  a format change degrades one number instead of the whole layer.

  FALLBACK: quiet-baseline values, clearly labeled 'fallback'. They are
  plausible solar-minimum conditions, never invented "current" readings.
*/

'use strict';

const BASE = 'https://services.swpc.noaa.gov';

/* the honest quiet baseline used when a fetch or a field fails */
export const QUIET_BASELINE = {
  kp: 2, windSpeedKmS: 400, windDensity: 5, bzNt: 0, f107: 90,
  scaleG: 0, source: 'fallback',
};

/* ---- module-private tolerant readers ------------------------------------ */

/* SWPC "array of arrays with a header row" -> value from the last row */
function fromHeaderTable(rows, namePart) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const header = rows[0];
  if (!Array.isArray(header)) return null;
  const col = header.findIndex(h =>
    String(h).toLowerCase().replace(/[_\s]/g, '').includes(namePart));
  if (col < 0) return null;
  for (let i = rows.length - 1; i > 0; i--) {          // last non-null upward
    const v = Number(rows[i][col]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/* "array of objects" -> value from the last entry whose key matches */
function fromObjectList(list, namePart) {
  if (!Array.isArray(list) || !list.length) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (!o || typeof o !== 'object') continue;
    const key = Object.keys(o).find(k =>
      k.toLowerCase().replace(/[_\s]/g, '').includes(namePart));
    if (!key) continue;
    const v = Number(o[key]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/* either shape */
export function readField(payload, namePart) {
  return fromHeaderTable(payload, namePart) ?? fromObjectList(payload, namePart);
}

/* noaa-scales.json is keyed by day index with { G: { Scale } } */
export function readScaleG(payload) {
  if (!payload || typeof payload !== 'object') return null;
  for (const key of Object.keys(payload)) {
    const g = payload[key] && payload[key].G;
    const v = g && Number(g.Scale ?? g.scale);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/* ---- the feed ------------------------------------------------------------ */

export class SpaceWeatherFeed {
  #cache = null;
  #fetchImpl;
  #fetchedAt = 0;
  #failed = new Set();          // URLs that failed this session; not retried

  constructor({ fetchImpl } = {}) {
    this.#fetchImpl = fetchImpl ?? ((...a) => fetch(...a));
  }

  name = 'swpc';
  kind = 'conditions';
  /* conditions change on a ~minutes cadence; one refresh per 10 min is
     plenty and keeps us a polite client */
  refreshMs = 600000;

  /* ordered candidates per field; first success wins */
  chains() {
    return {
      kp:     [`${BASE}/products/noaa-planetary-k-index.json`],
      speed:  [`${BASE}/products/summary/solar-wind-speed.json`,
               `${BASE}/products/solar-wind/plasma-1-day.json`],
      plasma: [`${BASE}/products/solar-wind/plasma-1-day.json`],
      bz:     [`${BASE}/products/summary/solar-wind-mag-field.json`,
               `${BASE}/products/solar-wind/mag-1-day.json`],
      scales: [`${BASE}/products/noaa-scales.json`],
      f107:   [`${BASE}/products/10cm-flux-30-day.json`,
               `${BASE}/json/f107_cm_flux.json`],
    };
  }

  get failedUrls() { return this.#failed; }

  /* Each field is independent: one failure costs one number, not the set. */
  async load() {
    const now = Date.now();
    if (this.#cache && now - this.#fetchedAt < this.refreshMs) return this.#cache;
    const chains = this.chains();
    const tryChain = async key => {
      for (const url of chains[key]) {
        if (this.#failed.has(url)) continue;      // known bad this session
        try {
          const res = await this.#fetchImpl(url);
          if (!res.ok) { this.#failed.add(url); continue; }
          return await res.json();
        } catch { this.#failed.add(url); }
      }
      return null;
    };
    const keys = ['kp', 'speed', 'plasma', 'bz', 'scales', 'f107'];
    const [kpRaw, speedRaw, plasmaRaw, bzRaw, scalesRaw, f107Raw] =
      await Promise.all(keys.map(tryChain));
    this.#cache = this.normalize({ kpRaw, speedRaw, plasmaRaw, bzRaw,
                                   scalesRaw, f107Raw });
    this.#fetchedAt = now;
    return this.#cache;
  }

  normalize({ kpRaw, speedRaw, plasmaRaw, bzRaw, magRaw, scalesRaw, f107Raw }) {
    const kp     = readField(kpRaw, 'kp');
    /* the summary products name the value 'WindSpeed' / 'Bz'; the legacy
       tables use 'speed' / 'bz_gsm'. The tolerant reader matches either. */
    const speed  = readField(speedRaw, 'speed') ?? readField(plasmaRaw, 'speed');
    const dens   = readField(plasmaRaw, 'density');
    const bz     = readField(bzRaw, 'bz') ?? readField(magRaw ?? bzRaw, 'bz');
    const f107   = readField(f107Raw, 'flux');
    const scaleG = readScaleG(scalesRaw);
    const live = [kp, speed, dens, bz, f107, scaleG].filter(v => v !== null).length;
    return {
      kp:           kp     ?? QUIET_BASELINE.kp,
      windSpeedKmS: speed  ?? QUIET_BASELINE.windSpeedKmS,
      windDensity:  dens   ?? QUIET_BASELINE.windDensity,
      bzNt:         bz     ?? QUIET_BASELINE.bzNt,
      f107:         f107   ?? QUIET_BASELINE.f107,
      scaleG:       scaleG ?? QUIET_BASELINE.scaleG,
      /* per-field provenance: how many of the six arrived live */
      liveFields: live,
      totalFields: 6,
      source: live === 0 ? 'fallback' : live === 6 ? 'live' : 'partial',
    };
  }
}

export default new SpaceWeatherFeed();
