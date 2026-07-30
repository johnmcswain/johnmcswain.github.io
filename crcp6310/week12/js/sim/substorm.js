/*
  sim/substorm.js — the magnetosphere's own cycle, driven by measured wind.

  A substorm is the real drama of this system and the piece has been missing
  it. Southward IMF Bz opens dayside reconnection, which loads energy into
  the magnetotail over tens of minutes (GROWTH: the tail stretches, the
  auroral oval creeps equatorward and dims). The tail then reconnects
  explosively (EXPANSION: the aurora brightens several-fold and surges
  poleward over ~15 minutes), followed by an hour of RECOVERY.

  The driver is not invented: it is the dawn-dusk coupling electric field

      Ey = v * Bs / 1000     mV/m,  Bs = max(0, -Bz)

  with v in km/s and Bz in nT — the standard solar wind/magnetosphere
  coupling term. Quiet wind gives a few tenths of a mV/m; a storm gives
  5-10. Energy accumulates as the integral of Ey above a dissipation floor,
  and onset fires when it crosses a threshold. So a substorm here happens
  because the measured field actually turned south and stayed there, not on
  a timer.

  MODEL, NOT PREDICTION. Real onset timing depends on tail state, prior
  history and internal instability. This reproduces the sequence and its
  dependence on the driver; it does not forecast when the sky will light up.

  Pure. Times are in SIMULATED seconds, so at 240x an hour of loading passes
  in fifteen seconds and the cycle is visible on the timescale of watching.
*/

'use strict';

export const ONSET_THRESHOLD = 6000;     // mV/m * s of accumulated coupling
export const DISSIPATION = 0.35;         // mV/m continuously bled off
export const EXPANSION_S = 15 * 60;      // simulated seconds
export const RECOVERY_S = 60 * 60;

/* the coupling electric field, mV/m */
export function couplingEy(speedKmS, bzNt) {
  return Math.max(0, -bzNt) * Math.max(0, speedKmS) / 1000;
}

export class SubstormCycle {
  #energy = 0;
  #phase = 'quiet';
  #tPhase = 0;
  #onsets = 0;

  get phase() { return this.#phase; }
  get energy() { return this.#energy; }
  get onsets() { return this.#onsets; }
  get loadFraction() { return Math.min(1, this.#energy / ONSET_THRESHOLD); }

  /* how far through the current phase, 0..1 */
  get phaseProgress() {
    if (this.#phase === 'expansion') return Math.min(1, this.#tPhase / EXPANSION_S);
    if (this.#phase === 'recovery') return Math.min(1, this.#tPhase / RECOVERY_S);
    return this.loadFraction;
  }

  /* auroral brightness multiplier: dims while loading, surges at breakup */
  /* Continuity matters here: the phases hand over to each other, so the
     curves are built to meet. Attack is fast (real breakup brightens within
     a minute or two), decay is slow, and expansion ends exactly where
     recovery begins. */
  get auroraGain() {
    switch (this.#phase) {
      case 'quiet':
      case 'growth':    return 1 - 0.25 * this.loadFraction;
      case 'expansion': {
        /* starts where growth ended (0.75), snaps up over the attack, then
           decays to exactly where recovery begins (1.7) */
        const t = this.phaseProgress, ATTACK = 0.12;
        return t < ATTACK
          ? 0.75 + 2.85 * (t / ATTACK)
          : 1.7 + 1.9 * ((1 - t) / (1 - ATTACK)) ** 0.6;
      }
      case 'recovery':  return 1 + 0.7 * (1 - this.phaseProgress);
      default:          return 1;
    }
  }

  /* degrees the oval shifts: equatorward (negative) while loading, then a
     poleward surge at breakup — the signature motion of a substorm */
  get polewardDeg() {
    switch (this.#phase) {
      case 'quiet':
      case 'growth':    return -2.5 * this.loadFraction;
      /* continues from where growth left the oval (-2.5) up to the poleward
         limit recovery starts from (6.5) */
      case 'expansion': return -2.5 + 9 * this.phaseProgress;
      case 'recovery':  return 6.5 * (1 - this.phaseProgress);
      default:          return 0;
    }
  }

  /* how far the tail is stretched, 0..1 — peaks just before onset */
  get tailStretch() {
    if (this.#phase === 'growth' || this.#phase === 'quiet') return this.loadFraction;
    if (this.#phase === 'expansion') return Math.max(0, 1 - this.phaseProgress * 1.6);
    return 0;
  }

  /* returns 'onset' on the frame a substorm breaks, otherwise null */
  update(dtSimSec, { speedKmS = 400, bzNt = 0 } = {}) {
    const dt = Math.max(0, Math.min(600, dtSimSec));
    const ey = couplingEy(speedKmS, bzNt);
    let event = null;

    if (this.#phase === 'quiet' || this.#phase === 'growth') {
      this.#energy = Math.max(0, this.#energy + (ey - DISSIPATION) * dt);
      this.#phase = this.#energy > ONSET_THRESHOLD * 0.08 ? 'growth' : 'quiet';
      if (this.#energy >= ONSET_THRESHOLD) {
        this.#phase = 'expansion'; this.#tPhase = 0;
        this.#energy = 0; this.#onsets++;
        event = 'onset';
      }
    } else {
      this.#tPhase += dt;
      /* Loading continues through the cycle, but is capped below the
         threshold: a tail that has just unloaded cannot be fully reloaded
         before recovery ends. Without this cap the cycle could jump straight
         from quiet to expansion, skipping the growth phase entirely — which
         is both unphysical and a visible discontinuity in the oval. */
      this.#energy = Math.max(0, Math.min(ONSET_THRESHOLD * 0.6,
        this.#energy + (ey - DISSIPATION) * dt * 0.4));
      if (this.#phase === 'expansion' && this.#tPhase >= EXPANSION_S) {
        this.#phase = 'recovery'; this.#tPhase = 0;
      } else if (this.#phase === 'recovery' && this.#tPhase >= RECOVERY_S) {
        /* the cycle closes with the tail unloaded, so the next growth phase
           starts from rest instead of resuming mid-curve */
        this.#phase = 'quiet'; this.#tPhase = 0; this.#energy = 0;
      }
    }
    return event;
  }
}
