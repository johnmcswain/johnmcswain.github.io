/*
  sim/flares.js — solar flares from GOES X-ray flux.

  The sun in this piece has never done anything. GOES watches it continuously
  in soft X-rays, and the long channel (0.1-0.8 nm) is exactly what defines
  flare class, on a decade scale:

      A  1e-8    B  1e-7    C  1e-6    M  1e-5    X  1e-4   W/m^2

  with the magnitude being the mantissa, so 5.2e-6 is a C5.2. C-class is
  common, M is notable, X is a major event. Because flux is served as a time
  series, replaying it means flares fire when they actually fired.

  Pure. No renderer imports.
*/

'use strict';

export const CLASS_BASE = [
  ['A', 1e-8], ['B', 1e-7], ['C', 1e-6], ['M', 1e-5], ['X', 1e-4],
];

/* flux (W/m^2) -> { letter, magnitude, label, level } ; level orders classes */
export function flareClass(fluxWm2) {
  const f = Number(fluxWm2);
  if (!Number.isFinite(f) || f < CLASS_BASE[0][1]) {
    return { letter: 'A', magnitude: 0, label: 'quiet', level: -1 };
  }
  let idx = 0;
  for (let i = CLASS_BASE.length - 1; i >= 0; i--)
    if (f >= CLASS_BASE[i][1]) { idx = i; break; }
  const magnitude = f / CLASS_BASE[idx][1];
  return {
    letter: CLASS_BASE[idx][0],
    magnitude,
    label: CLASS_BASE[idx][0] + magnitude.toFixed(1),
    level: idx,
  };
}

/* 0..1 visual intensity: C-class barely registers, X-class saturates */
export function flareIntensity(fluxWm2) {
  const f = Number(fluxWm2);
  if (!Number.isFinite(f) || f <= 1e-7) return 0;
  return Math.max(0, Math.min(1, (Math.log10(f) + 7) / 3.2));
}

/* GOES serves both channels interleaved; the long one defines the class */
export function readXraySeries(payload) {
  if (!Array.isArray(payload)) return null;
  const out = [];
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    const energy = String(row.energy ?? '');
    if (energy && !energy.includes('0.1-0.8')) continue;
    const flux = Number(row.flux ?? row.observed_flux);
    const t = Date.parse(String(row.time_tag ?? '').replace(' ', 'T').replace(/Z?$/, 'Z'));
    if (Number.isFinite(flux) && Number.isFinite(t)) out.push({ tMs: t, flux });
  }
  return out.length >= 4 ? out.sort((a, b) => a.tMs - b.tMs) : null;
}

/* Watches replayed flux and reports a flare when the class steps UP, so a
   slow decay does not re-trigger. Rearming requires dropping a class. */
export class FlareWatch {
  #level = -1;
  #peak = 0;
  #count = 0;

  get count() { return this.#count; }
  get peakLabel() { return this.#peak ? flareClass(this.#peak).label : 'none'; }

  /* returns the flare event on the frame it begins, else null */
  update(fluxWm2) {
    const cls = flareClass(fluxWm2);
    let event = null;
    if (cls.level > this.#level && cls.level >= 2) {   // C-class and above
      event = { ...cls, flux: Number(fluxWm2) };
      this.#count++;
      if (fluxWm2 > this.#peak) this.#peak = Number(fluxWm2);
    }
    this.#level = cls.level;
    return event;
  }
}
