'use strict';
/* audio.js — Sonifier (a class expression): opt-in, gesture-gated Web Audio.
   Each step advances a cursor through the seeds (newest first, near the
   center) and sounds one event; the ACTIVE MOTIF chooses the timbre, so the
   audio iterates across the five variations exactly as the visuals do.
   Echoes the logistic->melody sequencer: magnitude->pitch, depth->filter. */

export const Sonifier = class Sonifier {
  constructor({ bpm = 184, penta = [0, 3, 5, 7, 10] } = {}){
    this.bpm = bpm;                                       // gentle pulse
    this.penta = penta;                                   // minor pentatonic scale degrees
    this.ctx = null; this.master = null; this.fxDelay = null;
    this.on = false;
    this.nextNoteT = 0;
    this.voiceCursor = 0;
  }

  ensure(){
    if(this.ctx) return true;
    try{
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = ctx.createGain(); this.master.gain.value = 0.16;
      this.fxDelay = ctx.createDelay(1.0); this.fxDelay.delayTime.value = 0.30;
      const fb = ctx.createGain(); fb.gain.value = 0.28;
      const wet = ctx.createGain(); wet.gain.value = 0.25;
      this.fxDelay.connect(fb); fb.connect(this.fxDelay);
      this.fxDelay.connect(wet); wet.connect(this.master);
      this.master.connect(ctx.destination);
      this.nextNoteT = ctx.currentTime + 0.1;
      return true;
    }catch(e){ this.ctx = null; return false; }
  }

  degToFreq(deg, oct){
    // map a scale-degree index onto the minor pentatonic across octaves, A-based
    const n = this.penta.length;
    const step = ((deg % n) + n) % n;
    const semis = this.penta[step] + 12 * (oct - 4);      // oct 4 ~= around A3..A4
    return 220 * Math.pow(2, semis / 12);
  }

  playVoice(v, t){
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = v.type; osc.frequency.value = this.degToFreq(v.deg, v.oct);
    if(v.detune) osc.detune.value = v.detune;             // cents — bends pitch with the shape state
    lp.type = 'lowpass'; lp.frequency.value = v.cutoff; lp.Q.value = 0.7;
    const dur = v.dur;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(lp); lp.connect(g); g.connect(this.master); g.connect(this.fxDelay);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  /* schedule from the shown seeds under the ACTIVE motif's timbre */
  schedule(shown, motif){
    if(!this.ctx || !shown.length) return;
    const stepDur = 60 / this.bpm / 2;
    // sonify the inner, newest seeds so the sequence stays musical rather than a wall of sound
    const pool = Math.min(shown.length, 64);
    while(this.nextNoteT < this.ctx.currentTime + 0.12){
      const q = shown[this.voiceCursor % pool];
      if(q && q.mag >= 2.0) this.playVoice(motif.voice(q), this.nextNoteT); // skip the micro-quakes
      this.voiceCursor++;
      this.nextNoteT += stepDur;
    }
  }

  /* returns the resulting on/off state */
  toggle(){
    if(!this.on){
      if(!this.ensure()) return false;
      if(this.ctx.state === 'suspended') this.ctx.resume();
      this.on = true;
    } else {
      this.on = false;
    }
    return this.on;
  }
};
