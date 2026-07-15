'use strict';
/* engine.js — ViewState + MandalaEngine.
   MandalaEngine owns the p5 lifecycle (setup/draw/resize/input), the
   phyllotaxis layout, the motif transition dip, hover detection, and the
   live/synthetic data mode. It dispatches all seed rendering through the
   Motif interface — it never branches on which motif is active. */

import { QuakeFeed } from './data.js';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));              // ~137.5 degrees
const TAU    = Math.PI * 2;
const SIZE_EXP = 2.05, SIZE_MUL = 1.7, SIZE_MIN = 2.5, SIZE_MAX = 84;
const DENSE_AT = 1400;                                    // switch to lite drawing above this

/* the shared view/animation state the motifs read (breaks what would
   otherwise be a circular engine<->motif dependency) */
export class ViewState {
  constructor(){
    this.hovered = null;
    this.reduceMotion = false;
    this.motion = 1;
    this.paused = false;
    this.globalRot = 0;
  }
}

export class MandalaEngine {
  constructor({ view, palette, shapes, motifs, feed, sonifier, hud }){
    this.view = view; this.palette = palette; this.shapes = shapes;
    this.motifs = motifs;                                 // ordered: woven → grown → molten → constructed → emergent
    this.feed = feed; this.sonifier = sonifier; this.hud = hud;

    /* state */
    this.quakes = []; this.shown = []; this.specimen = null;
    this.symmetry = 1; this.seedVal = 1234;
    this.dataMode = 'live';                               // 'live' | 'synthetic'
    this.liveState = 'loading';

    /* motif + transition state */
    this.motifIdx = 0;                                    // index into this.motifs
    this.switchT = 0;                                     // 0..1 transition dip timer (1 = mid-switch)
    this.pendingMotif = -1;                               // motif to apply at the bottom of the dip
    this.userSetSym = false;                              // once true, the user's fold count persists
  }

  activeMotif(){ return this.motifs[this.motifIdx]; }

  maxSeedsFor(p){ return ({ hour: 700, day: 1000, week: 1600, month: 2600 })[p] || 1000; }

  /* ---------------- p5 lifecycle ---------------- */
  setup(){
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);                                      // perf: no HiDPI oversampling
    this.view.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(this.view.reduceMotion) this.view.motion = 0;
    const cv = document.querySelector('canvas'); if(cv) cv.style.cursor = 'crosshair';
    this.hud.bindButtons({
      onHarmony: () => this.cycleHarmony(),
      onData:    () => this.toggleData(),
      onMotif:   () => this.requestMotif((this.motifIdx + 1) % this.motifs.length),
      onSound:   () => this.toggleSound(),
    });
    this.hud.updateHarmonyButton(this.palette);
    this.symmetry = this.activeMotif().defaultSym;
    this.hud.updateRamp(this.palette);
    this.hud.refreshMotifUI(this);
    this.refreshFeed();
    setInterval(() => this.refreshFeed(), 60000);
  }

  windowResized(){ resizeCanvas(windowWidth, windowHeight); this.layout(); }

  draw(){
    const view = this.view;

    // hold-to-scrub base hue ([ = 219, ] = 221)
    if(keyIsDown(219) || keyIsDown(221)){
      this.palette.shiftHue((keyIsDown(221) ? 1.6 : 0) - (keyIsDown(219) ? 1.6 : 0));
      this.recolor(); this.hud.updateRamp(this.palette);
      this.hud.updatePalLabel(this.palette);
    }

    background(10, 13, 19);

    // transition dip: ease seed-layer alpha down, swap motif at the bottom, ease back up
    let layerMul = 1;
    if(this.switchT > 0){
      this.switchT = Math.max(0, this.switchT - 0.05);
      const x = this.switchT;                             // 1 -> 0
      layerMul = 1 - 0.85 * Math.sin(x * Math.PI);        // dips to ~0.15 at midpoint
      if(this.pendingMotif >= 0 && this.switchT <= 0.5){  // apply at the bottom of the dip
        this.motifIdx = this.pendingMotif; this.pendingMotif = -1;
        if(!this.userSetSym) this.symmetry = this.activeMotif().defaultSym; // user's fold count persists once set
        this.reprepare(); this.hud.refreshMotifUI(this); this.hud.updatePanel(this);
      }
    }

    push();
    translate(width / 2, height / 2);
    if(!view.paused && !view.reduceMotion) view.globalRot += 0.0011;
    rotate(view.globalRot);

    this.drawChart();

    const motif = this.activeMotif();
    const lite = this.shown.length > DENSE_AT;
    const step = TAU / this.symmetry;
    blendMode(ADD);
    for(let s = 0; s < this.symmetry; s++){
      push(); rotate(s * step);
      for(let i = 0; i < this.shown.length; i++){
        const q = this.shown[i];
        const savedA = q.alpha; q.alpha *= layerMul;      // apply transition dip
        push(); translate(q.px, q.py);
        if(!lite && q.spinSpeed) rotate(q.spin + frameCount * q.spinSpeed * view.motion);
        motif.draw(q, lite);
        pop();
        q.alpha = savedA;
      }
      pop();
    }
    blendMode(BLEND);

    noStroke(); fill(233, 228, 214, 30); circle(0, 0, 6);
    pop();

    if(this.sonifier.on) this.sonifier.schedule(this.shown, motif);

    // perf: only re-test hover on mouse-move, with a periodic catch-up for rotation
    if(mouseX !== pmouseX || mouseY !== pmouseY || frameCount % 6 === 0) this.detectHover();
  }

  drawChart(){
    const maxR = Math.min(width, height) * 0.47;
    noFill(); stroke(233, 228, 214, 12); strokeWeight(1);
    for(let i = 1; i <= 6; i++) circle(0, 0, maxR * 2 * i / 6);
    if(this.symmetry > 1){
      stroke(233, 228, 214, 8);
      for(let i = 0; i < this.symmetry; i++){
        const a = i * TAU / this.symmetry;
        line(0, 0, Math.cos(a) * maxR, Math.sin(a) * maxR);
      }
    }
  }

  /* ---------------- data ---------------- */
  async refreshFeed(){
    if(this.dataMode === 'live') this.setStatus('loading');
    const state = await this.feed.fetch();                // 'live' | 'offline'
    this.setStatus(state);
    if(this.dataMode === 'live'){ this.quakes = this.feed.live; this.layout(); }
  }

  setStatus(s){ this.liveState = s; this.hud.renderStatus(this.liveState, this.dataMode); }

  /* ---------------- layout ---------------- */
  layout(){
    randomSeed(this.seedVal);
    if(this.dataMode === 'synthetic'){ this.layoutSpecimen(); this.hud.updatePanel(this); return; }

    // LIVE: phyllotaxis spiral with density-aware sizing
    this.shown = this.quakes.slice(0, this.maxSeedsFor(this.feed.period)); // newest-first
    const shown = this.shown;
    const n = Math.max(shown.length, 1);
    const c = (Math.min(width, height) * 0.46) / Math.sqrt(n);
    const sizeScale = Math.min(Math.max(c / 24, 0.14), 1.0); // shrink as density rises
    const now = Date.now();
    const motif = this.activeMotif();
    for(let i = 0; i < shown.length; i++){
      const q = shown[i];
      q.idx = i;                                          // stable index for deterministic motif prep
      const ang = i * GOLDEN + random(-0.04, 0.04);
      const rad = c * Math.sqrt(i + 0.5);
      q.px = Math.cos(ang) * rad; q.py = Math.sin(ang) * rad; // precomputed screen position
      const base = Math.min(SIZE_MAX, SIZE_MIN + Math.pow(Math.max(q.mag, 0.1), SIZE_EXP) * SIZE_MUL);
      q.size = Math.max(1.5, base * sizeScale);
      q.col = this.palette.depthColor(q.depth);
      q.kp = 0; motif.prepare(q);
      q.spin = random(TAU);
      q.spinSpeed = random(-0.004, 0.004);
      q.phase = random(TAU);
      q.recent = (now - q.time) < 3600 * 1000;
      const ageH = (now - q.time) / 3600000;
      q.alpha = Math.min(Math.max(map(ageH, 0, 72, 235, 95), 95), 235);
    }
    this.hud.updatePanel(this);
  }

  /* re-run only the active motif's per-seed prep — cheap, called on a motif switch */
  reprepare(){
    const m = this.activeMotif();
    for(let i = 0; i < this.shown.length; i++){ this.shown[i].kp = 0; m.prepare(this.shown[i]); }
  }

  layoutSpecimen(){
    this.shown = this.quakes;
    const shown = this.shown;
    const maxR = Math.min(width, height) * 0.44;
    const motif = this.activeMotif();
    for(let idx = 0; idx < shown.length; idx++){
      const q = shown[idx];
      q.idx = idx;
      const rad = q.radFrac * maxR;
      q.px = Math.cos(q.ang) * rad; q.py = Math.sin(q.ang) * rad;
      q.size = Math.max(2, q.sizeFrac * maxR);
      q.col = this.palette.depthColor(q.depth);
      q.spin = 0; q.spinSpeed = 0;                        // crisp, static symmetry
      q.phase = random(TAU);
      q.recent = false; q.alpha = 215;
      motif.prepare(q);
    }
  }

  recolor(){ for(let i = 0; i < this.shown.length; i++) this.shown[i].col = this.palette.depthColor(this.shown[i].depth); }

  /* ---------------- hover ---------------- */
  detectHover(){
    const view = this.view;
    const mx = mouseX - width / 2, my = mouseY - height / 2, step = TAU / this.symmetry;
    let best = null, bestD = 1e9;
    for(let s = 0; s < this.symmetry; s++){
      const ang = -(view.globalRot + s * step), ca = Math.cos(ang), sa = Math.sin(ang);
      const rx = mx * ca - my * sa, ry = mx * sa + my * ca;
      for(let i = 0; i < this.shown.length; i++){
        const q = this.shown[i];
        const dx = rx - q.px, dy = ry - q.py;
        const d = dx * dx + dy * dy, hit = (q.size + 9) * (q.size + 9);
        if(d < hit && d < bestD){ bestD = d; best = q; }
      }
    }
    view.hovered = best;
    this.hud.hover(best);
  }

  /* ---------------- controls ---------------- */
  cycleHarmony(){
    this.palette.cycle();
    this.hud.updateHarmonyButton(this.palette);
    this.recolor(); this.hud.updateRamp(this.palette); this.hud.updatePanel(this);
  }

  toggleData(){
    this.dataMode = this.dataMode === 'live' ? 'synthetic' : 'live';
    if(this.dataMode === 'synthetic'){
      this.specimen = QuakeFeed.buildSpecimen();          // rebuild so motif prep is fresh
      this.quakes = this.specimen;
    } else {
      if(this.feed.live.length){ this.quakes = this.feed.live; } else { this.refreshFeed(); }
    }
    this.hud.updateDataButton(this.dataMode);
    this.layout();
    this.hud.renderStatus(this.liveState, this.dataMode);
    this.hud.updatePanel(this);
  }

  /* request a motif switch — begins the transition dip; the swap happens mid-dip */
  requestMotif(idx){
    if(idx === this.motifIdx || this.switchT > 0) return;
    this.pendingMotif = idx; this.switchT = 1;
  }

  toggleSound(){
    this.sonifier.toggle();
    this.hud.refreshMotifUI(this);
  }

  keyPressed(){
    const view = this.view;
    if(keyCode === RIGHT_ARROW){ this.symmetry = Math.min(12, this.symmetry + 1); this.userSetSym = true; }
    else if(keyCode === LEFT_ARROW){ this.symmetry = Math.max(1, this.symmetry - 1); this.userSetSym = true; }
    else if(key >= '1' && key <= String(this.motifs.length)){ this.requestMotif(parseInt(key, 10) - 1); }
    else if(key === 'f' || key === 'F'){ this.feed.cycleMag(); if(this.dataMode === 'live') this.refreshFeed(); }
    else if(key === 'p' || key === 'P'){ this.feed.cyclePeriod(); if(this.dataMode === 'live') this.refreshFeed(); }
    else if(key === 'c' || key === 'C'){ this.cycleHarmony(); }
    else if(key === 'd' || key === 'D'){ this.toggleData(); }
    else if(key === 'm' || key === 'M'){ this.toggleSound(); }
    else if(key === 'r' || key === 'R'){ this.seedVal = Math.floor(Math.random() * 99999); this.layout(); }
    else if(key === ' '){ view.paused = !view.paused; }
    else if(key === 's' || key === 'S'){ saveCanvas('seisma', 'png'); return false; }
    this.hud.updatePanel(this);
  }

  mousePressed(){
    const h = this.view.hovered;
    if(h && h.url && h.url !== '#'){ window.open(h.url, '_blank'); }
  }
}
