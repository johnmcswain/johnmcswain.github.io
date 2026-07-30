/*
  sim/demo.js — demonstration conditions.

  WHY THIS EXISTS, stated plainly because it is the one place the piece shows
  numbers that were not measured: the sun is quiet most of the time. On a
  calm day the substorm cycle never fires, the magnetopause sits still, the
  aurora is a thin band and the sun does nothing — so none of the physics is
  visible. This lets the piece be shown on demand.

  EVERY value here is invented, and the piece says so: the HUD switches to
  SIMULATED, the footer line changes, and the provenance labels flip from
  live to demonstration. Nothing here ever silently substitutes for measured
  data — the mode is explicit, one keypress on and one keypress off, and the
  live values resume untouched because they were never overwritten.

  The scenario is a plausible severe storm, sequenced so a viewer sees the
  whole chain in about two minutes of simulated time: a southward turning
  that loads the tail and fires substorms, a pressure pulse that visibly
  compresses the boundary, and an X-class flare.
*/

'use strict';

export const DEMO_LABEL = 'SIMULATED \u2014 demonstration, not live data';

/* keyframes over a 120-minute simulated scenario; interpolated between */
const SCENARIO = [
  { t:   0, speedKmS: 380, density:  4, bzNt:  +2, flux: 2e-8 },
  { t:  10, speedKmS: 430, density:  6, bzNt:  -4, flux: 5e-7 },
  { t:  25, speedKmS: 560, density: 11, bzNt: -12, flux: 4e-6 },
  { t:  40, speedKmS: 700, density: 18, bzNt: -18, flux: 3e-5 },
  { t:  55, speedKmS: 780, density: 22, bzNt: -22, flux: 1.6e-4 },  // X1.6
  { t:  70, speedKmS: 720, density: 16, bzNt: -15, flux: 2e-5 },
  { t:  90, speedKmS: 600, density:  9, bzNt:  -6, flux: 3e-6 },
  { t: 120, speedKmS: 450, density:  5, bzNt:  +1, flux: 3e-7 },
];
export const SCENARIO_MINUTES = SCENARIO[SCENARIO.length - 1].t;

/* conditions at a point in the scenario; minutes wraps so it loops */
export function demoConditions(minutes) {
  const m = ((minutes % SCENARIO_MINUTES) + SCENARIO_MINUTES) % SCENARIO_MINUTES;
  let i = 1;
  while (i < SCENARIO.length - 1 && SCENARIO[i].t < m) i++;
  const a = SCENARIO[i - 1], b = SCENARIO[i];
  const f = b.t === a.t ? 0 : (m - a.t) / (b.t - a.t);
  const mix = (x, y) => x + (y - x) * f;
  return {
    speedKmS: mix(a.speedKmS, b.speedKmS),
    density:  mix(a.density,  b.density),
    bzNt:     mix(a.bzNt,     b.bzNt),
    flux:     Math.exp(mix(Math.log(a.flux), Math.log(b.flux))),   // log-interp
    minutes:  m,
  };
}

/* Kp implied by the scenario, so the aurora oval widens with it too */
export function demoKp(bzNt, speedKmS) {
  const drive = Math.max(0, -bzNt) * speedKmS / 1000;
  return Math.max(0, Math.min(9, 1.5 + drive * 0.55));
}

export class DemoMode {
  #on = false;
  #minutes = 0;
  get active() { return this.#on; }
  get minutes() { return this.#minutes; }
  toggle() { this.#on = !this.#on; this.#minutes = 0; return this.#on; }

  /* advance and return conditions, or null when the mode is off */
  update(dtSimSec) {
    if (!this.#on) return null;
    this.#minutes += dtSimSec / 60;
    const c = demoConditions(this.#minutes);
    return { ...c, kp: demoKp(c.bzNt, c.speedKmS) };
  }
}
