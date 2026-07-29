/*
  audio.js — Sonifier: the ensemble chord. Each voice is a sine at its
  object's orbital frequency shifted into the audible band; co-planar shells
  produce near-unisons that beat at their real relative rates. Opt-in only
  (browser autoplay rules), silent until start().

  All Web Audio state is #private — the public surface is start/stop/setVoices.
  Voices land ~2 octaves below the feed's freqHz (21 rather than 23 shifts)
  for a gentler register, ~350-380 Hz for LEO.
*/

'use strict';

const REGISTER_DROP = 4;                 // divide freqHz by 2^2

export class Sonifier {
  #ctx = null;
  #master = null;
  #oscs = [];
  #solo = null;

  get running() { return !!this.#ctx && this.#ctx.state === 'running'; }

  start(voices) {
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = 0.0;
      this.#master.connect(this.#ctx.destination);
    }
    this.#ctx.resume();
    this.setVoices(voices);
    this.#master.gain.linearRampToValueAtTime(0.5, this.#ctx.currentTime + 1.5);
  }

  setVoices(voices) {
    if (!this.#ctx) return;
    for (const o of this.#oscs) { try { o.osc.stop(); } catch {} }
    this.#oscs = [];
    const n = Math.max(1, voices.length);
    for (const v of voices) {
      const osc = this.#ctx.createOscillator();
      const g = this.#ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = v.hz / REGISTER_DROP;
      g.gain.value = 0.9 / n;                       // equal-power-ish per voice
      osc.connect(g); g.connect(this.#master);
      osc.start();
      this.#oscs.push({ osc, g });
    }
  }

  /* terminator crossing: brief note at the object's own voice —
     sunrise a fifth up and brighter, sunset an octave down and darker */
  crossing(hz, sunrise) {
    if (!this.running) return;
    const t = this.#ctx.currentTime;
    const osc = this.#ctx.createOscillator();
    const g = this.#ctx.createGain();
    osc.type = sunrise ? 'triangle' : 'sine';
    osc.frequency.value = sunrise ? hz * 1.5 / 2 : hz / 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(sunrise ? 0.11 : 0.08, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (sunrise ? 0.5 : 0.9));
    osc.connect(g); g.connect(this.#master);
    osc.start(t); osc.stop(t + 1.0);
  }

  /* conjunction chime: short bell at the mean of the pair's voices */
  ping(hzA, hzB) {
    if (!this.running) return;
    const t = this.#ctx.currentTime;
    const osc = this.#ctx.createOscillator();
    const g = this.#ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = (hzA + hzB) / 2 / 2;      // an octave below the pair
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(g); g.connect(this.#master);
    osc.start(t); osc.stop(t + 1.2);
  }

  /* focused object's voice, sustained above the ensemble; solo(null) ends it */
  solo(hz) {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    if (this.#solo) {
      this.#solo.g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      this.#solo.osc.stop(t + 0.5);
      this.#solo = null;
    }
    if (hz == null) return;
    const osc = this.#ctx.createOscillator();
    const g = this.#ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = hz / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.6);
    osc.connect(g); g.connect(this.#master);
    osc.start(t);
    this.#solo = { osc, g };
  }

  /* glide the solo voice — used by the Doppler curve during a pass, where
     restarting the oscillator each frame would click */
  soloPitch(hz) {
    if (!this.#solo || !this.#ctx) return;
    this.#solo.osc.frequency.linearRampToValueAtTime(
      hz / 2, this.#ctx.currentTime + 0.09);
  }

  stop() {
    if (!this.#ctx) return;
    this.#master.gain.linearRampToValueAtTime(0.0, this.#ctx.currentTime + 0.6);
  }
}
