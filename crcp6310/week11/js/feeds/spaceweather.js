/*
  feeds/spaceweather.js — NOAA SWPC, the sun's effect on the ensemble.
  Implements the FEEDS interface shape (name, kind, load, normalize).

  Endpoints (public, keyless, services.swpc.noaa.gov):
    products/noaa-planetary-k-index.json   geomagnetic activity, Kp
    products/solar-wind/plasma-1-day.json  solar wind speed + density
    products/solar-wind/mag-1-day.json     IMF Bz (southward = coupling)
    products/noaa-scales.json              G / S / R storm scales
    json/f107_cm_flux.json                 F10.7 solar radio flux

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

  constructor({ fetchImpl } = {}) {
    this.#fetchImpl = fetchImpl ?? ((...a) => fetch(...a));
  }

  name = 'swpc';
  kind = 'conditions';
  /* conditions change on a ~minutes cadence; one refresh per 10 min is
     plenty and keeps us a polite client */
  refreshMs = 600000;

  urls() {
    return {
      kp:     `${BASE}/products/noaa-planetary-k-index.json`,
      plasma: `${BASE}/products/solar-wind/plasma-1-day.json`,
      mag:    `${BASE}/products/solar-wind/mag-1-day.json`,
      scales: `${BASE}/products/noaa-scales.json`,
      f107:   `${BASE}/json/f107_cm_flux.json`,
    };
  }

  /* Each request is independent: one failure costs one field, not the set. */
  async load() {
    const now = Date.now();
    if (this.#cache && now - this.#fetchedAt < this.refreshMs) return this.#cache;
    const u = this.urls();
    const get = async key => {
      try {
        const res = await this.#fetchImpl(u[key]);
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    };
    const [kpRaw, plasmaRaw, magRaw, scalesRaw, f107Raw] = await Promise.all(
      ['kp', 'plasma', 'mag', 'scales', 'f107'].map(get));
    this.#cache = this.normalize({ kpRaw, plasmaRaw, magRaw, scalesRaw, f107Raw });
    this.#fetchedAt = now;
    return this.#cache;
  }

  normalize({ kpRaw, plasmaRaw, magRaw, scalesRaw, f107Raw }) {
    const kp     = readField(kpRaw, 'kp');
    const speed  = readField(plasmaRaw, 'speed');
    const dens   = readField(plasmaRaw, 'density');
    const bz     = readField(magRaw, 'bz');
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
