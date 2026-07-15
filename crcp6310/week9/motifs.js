'use strict';
/* motifs.js — the five iterative variations behind ONE class interface.
   =====================================================================
   MOTIF-RENDERER INTERFACE (now a base class)
   ---------------------------------------------------------------------
   Each motif subclass keeps the uniform contract:
     name        short id (also the on-canvas label)
     defaultSym  symmetry the tradition opens in (its "native" k-fold)
     prepare(q)  deterministic per-seed setup from q.idx + q.mag (no random();
                 so re-running on a motif switch is idempotent and stable)
     draw(q,lite) render one seed at the local origin (caller has already
                 translated/rotated/colored); reads q.col, q.size, q.alpha
     voice(q)    sonification descriptor {deg, oct, type, cutoff, dur}
   The engine never branches on which motif is active — it dispatches
   through polymorphism. Adding a sixth motif is one subclass here plus one
   entry in the registry main.js builds; nothing else changes.
   ===================================================================== */

import { lerpN } from './palette.js';
import { ShapeAtlas, TAU, GLOW } from './shapes.js';

/* base class — shared pulse/hover treatment + the contract defaults */
export class Motif {
  /* view: a ViewState (hovered / reduceMotion / motion); shapes: a ShapeAtlas */
  constructor(view, shapes){
    this.view = view;
    this.shapes = shapes;
    this.name = 'motif';
    this.defaultSym = 6;
  }

  prepare(q){}                                            // eslint-disable-line no-unused-vars
  draw(q, lite){}                                         // eslint-disable-line no-unused-vars
  voice(q){ return { deg: 0, oct: 4, type: 'sine', cutoff: 1200, dur: 0.4 }; }

  /* recent-event pulse + hover brightening, identical across the five */
  seedAlpha(q){
    let a = q.alpha;
    if(q.recent && !this.view.reduceMotion) a *= 0.55 + 0.45 * Math.sin(frameCount * 0.07 + q.phase);
    if(q === this.view.hovered) a = Math.min(255, a * 1.45);
    return a;
  }

  hoverRing(q, s, r, g, b, k = 2.6){
    if(q === this.view.hovered){
      noFill(); stroke(r, g, b, 210); strokeWeight(1.2); circle(0, 0, s * k + 10);
    }
  }
}

/* ---- 1 · CELTIC — torus knots + rings (the inherited anchor, unchanged) ---- */
export class CelticMotif extends Motif {
  constructor(view, shapes){
    super(view, shapes);
    this.name = 'celtic';
    this.defaultSym = 6;
  }
  prepare(q){
    if(q.kp) return;                                      // already set (specimen)
    // deterministic knot pick from index (was random([...]) before the refactor)
    if(q.mag >= 6){       const v = [[3,5],[5,3],[3,4],[4,3]][q.idx & 3]; q.kp = v[0]; q.kq = v[1]; }
    else if(q.mag >= 4.5){ const v = [[2,3],[3,2],[2,5],[5,2]][q.idx & 3]; q.kp = v[0]; q.kq = v[1]; }
  }
  draw(q, lite){
    const sh = this.shapes;
    const c = q.col, r = c[0], g = c[1], b = c[2];
    const a = this.seedAlpha(q);
    const s = q.size;
    if(q.mag < 2.5){
      noStroke();
      if(lite){ fill(r, g, b, a); circle(0, 0, Math.max(1.3, s * 0.6)); }
      else {
        fill(r, g, b, a * 0.14); circle(0, 0, s * 1.7);
        noFill(); stroke(r, g, b, a); strokeWeight(0.8); circle(0, 0, s * 0.95);
      }
    } else if(q.mag < 4.5){
      sh.ringGlow(s, s * 0.5, 8, a, r, g, b, 1.0, lite);
    } else if(q.mag < 6){
      sh.knotGlow(q.kp, q.kq, 0.378, s * 0.9, a, r, g, b, 1.1, lite);
      if(!lite){ noFill(); stroke(r, g, b, a * 0.22); strokeWeight(0.7); circle(0, 0, (s * 0.9 + s * 0.34) * 2.1); }
    } else {
      noFill(); stroke(r, g, b, a * 0.5); sh.ripple(s * 1.9, 3);
      sh.ringGlow(s * 1.15, s * 0.72, 12, a * 0.85, r, g, b, 0.9, lite);
      sh.knotGlow(q.kp, q.kq, 0.421, s * 0.95, a, r, g, b, 1.3, lite);
    }
    this.hoverRing(q, s, r, g, b, 2.6);
  }
  voice(q){
    // woven, plucked: triangle, mid register, brightness from shallowness
    return { deg: q.idx, oct: q.mag >= 6 ? 2 : q.mag >= 4.5 ? 3 : 4, type: 'triangle',
             cutoff: lerpN(2600, 700, Math.min(q.depth, 700) / 700), dur: 0.42 };
  }
}

/* ---- 2 · BOTANICAL — superformula florets (phyllotaxis revealed as botany) ---- */
export class BotanicalMotif extends Motif {
  constructor(view, shapes){
    super(view, shapes);
    this.name = 'botanical';
    this.defaultSym = 1;                                  // the spiral itself is the symmetry
  }
  prepare(q){
    // magnitude -> petal count + bloom complexity; jitter from index (deterministic)
    const band = q.mag < 2.5 ? 0 : q.mag < 4.5 ? 1 : q.mag < 6 ? 2 : 3;
    q.b_m  = [5, 6, 8, 12][band] + (q.idx % 3);           // petals
    q.b_n1 = [0.6, 0.45, 0.35, 0.3][band];                // sharper points as mag rises
    q.b_n2 = [1.7, 1.2, 0.9, 0.7][band];
    q.b_n3 = q.b_n2;
    q.b_core = band;                                      // inner-floret rings
  }
  draw(q, lite){
    const sh = this.shapes;
    const c = q.col, r = c[0], g = c[1], b = c[2];
    const a = this.seedAlpha(q);
    const s = q.size * 1.15;
    const pts = sh.superformula(q.b_m, q.b_n1, q.b_n2, q.b_n3, ShapeAtlas.lodSteps(s));
    // soft filled petal body (glows under ADD blend), then a crisp outline
    noStroke(); fill(r, g, b, a * 0.13); sh.emit(pts, s, true);
    if(!lite){ noFill(); stroke(r, g, b, a * 0.22 * GLOW); strokeWeight(2.6); sh.emit(pts, s, true); }
    noFill(); stroke(r, g, b, a); strokeWeight(1.0); sh.emit(pts, s, true);
    // inner florets: a few shrinking, counter-rotated copies = seed-head depth
    if(!lite){
      for(let k = 1; k <= q.b_core; k++){
        const f = 1 - k * 0.24; if(f <= 0.12) break;
        push(); rotate(k * 0.4 + (this.view.motion ? frameCount * 0.002 * (k % 2 ? 1 : -1) : 0));
        stroke(lerpN(r, 255, 0.4), lerpN(g, 255, 0.4), lerpN(b, 255, 0.4), a * 0.5);
        strokeWeight(0.8); sh.emit(pts, s * f, true); pop();
      }
    }
    noStroke(); fill(lerpN(r, 255, 0.5), lerpN(g, 255, 0.5), lerpN(b, 255, 0.5), a * 0.8);
    circle(0, 0, Math.max(1.4, s * 0.12));
    this.hoverRing(q, s, r, g, b, 2.4);
  }
  voice(q){
    // airier: sine, a register up, brighter overall
    return { deg: q.idx + 2, oct: q.mag >= 6 ? 3 : q.mag >= 4.5 ? 4 : 5, type: 'sine',
             cutoff: lerpN(3400, 1100, Math.min(q.depth, 700) / 700), dur: 0.5 };
  }
}

/* ---- 3 · FLUID — Perlin flow blobs (the restless earth as molten, not woven) ---- */
export class FluidMotif extends Motif {
  constructor(view, shapes){
    super(view, shapes);
    this.name = 'fluid';
    this.defaultSym = 3;                                  // gentle organic mandala; arrows change it live
  }
  prepare(q){
    // magnitude -> turbulence + outline detail; index -> a unique noise field per seed
    const band = q.mag < 2.5 ? 0 : q.mag < 4.5 ? 1 : q.mag < 6 ? 2 : 3;
    q.f_rough = [0.18, 0.30, 0.46, 0.62][band];           // deformation amount (bigger quake = more violent)
    q.f_freq  = [0.9, 1.2, 1.6, 2.1][band];               // spatial frequency (more, finer lobes)
    q.f_steps = [22, 30, 42, 54][band];                   // outline resolution by band
    q.f_ox = (q.idx % 97) * 0.37;                         // deterministic per-seed noise offsets
    q.f_oy = (q.idx % 89) * 0.53 + 11.0;
    q.morph = 0.3;                                        // seed value until first draw
  }
  /* Fluid blob: a closed organic outline whose radius churns with evolving
     Perlin noise. Recomputed ONCE per seed per frame (guarded by frameCount)
     and reused across all symmetry copies, so the cost is one noise pass + a
     couple of emits per seed regardless of k-fold. The mean deviation from a
     circle is stored as q.morph — the live "shape condition" the
     sonification reads for pitch. */
  computeBlob(q){
    if(q._mframe === frameCount) return;                  // already done this frame
    q._mframe = frameCount;
    const steps = q.f_steps;
    if(!q._blob || q._blob.length !== steps) q._blob = new Float32Array(steps);
    const t = (this.view.reduceMotion ? 0 : frameCount * 0.012); // flow speed (frozen if reduced-motion)
    let agg = 0;
    for(let i = 0; i < steps; i++){
      const ang = i / steps * TAU;
      // sample 2-D noise around a ring -> smooth, seamless lobes that flow over time
      const nx = q.f_ox + Math.cos(ang) * q.f_freq;
      const ny = q.f_oy + Math.sin(ang) * q.f_freq;
      const dev = (noise(nx + t, ny + t * 0.7) - 0.5) * 2; // ~ -1..1
      const rdev = q.f_rough * dev;                       // actual radial deviation
      q._blob[i] = 1 + rdev;                              // radius multiplier
      agg += Math.abs(rdev);
    }
    q.morph = agg / steps;                                // mean radial deviation = visible agitation
  }
  draw(q, lite){
    this.computeBlob(q);
    const c = q.col, r = c[0], g = c[1], b = c[2];
    const a = this.seedAlpha(q);
    const s = q.size * 1.25, steps = q.f_steps, blob = q._blob;
    const blobShape = (scl) => {
      beginShape();
      for(let i = 0; i < steps; i++){ const ang = i / steps * TAU, rr = blob[i] * scl; vertex(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      endShape(CLOSE);
    };
    // soft molten body (glows under ADD), optional halo, then a fluid rim
    noStroke(); fill(r, g, b, a * 0.13); blobShape(s);
    if(!lite){ noFill(); stroke(r, g, b, a * 0.22 * GLOW); strokeWeight(2.8); blobShape(s); }
    noFill(); stroke(r, g, b, a); strokeWeight(1.0); blobShape(s);
    // bright nucleus scaled by current agitation — a visible echo of the pitch mapping
    noStroke(); fill(lerpN(r, 255, 0.55), lerpN(g, 255, 0.55), lerpN(b, 255, 0.55), a * 0.85);
    circle(0, 0, Math.max(1.4, s * (0.12 + 0.18 * q.morph)));
    this.hoverRing(q, s, r, g, b, 2.4);
  }
  voice(q){
    // pitch tracks the live shape: visible agitation -> scale degree + continuous
    // detune. Register comes from magnitude, so a big quake churns low and restless.
    const ag = Math.min(1, (q.morph ?? 0.06) / 0.25);     // normalized 0..1
    return { deg: Math.round(ag * 6), oct: q.mag >= 6 ? 2 : q.mag >= 4.5 ? 3 : 4, type: 'sine',
             cutoff: lerpN(2600, 700, Math.min(q.depth, 700) / 700),
             detune: (ag - 0.5) * 220,                    // +-110 cents glide with the shape
             dur: 0.55 };
  }
}

/* ---- 4 · GIRIH — Islamic star strapwork (compass-and-rule construction) ---- */
export class GirihMotif extends Motif {
  constructor(view, shapes){
    super(view, shapes);
    this.name = 'girih';
    this.defaultSym = 5;                                  // echoes the pentagonal/decagonal girih tradition
  }
  prepare(q){
    // magnitude -> star order; the four classic single-path stars
    const band = q.mag < 2.5 ? 0 : q.mag < 4.5 ? 1 : q.mag < 6 ? 2 : 3;
    const sk = [[5,2],[8,3],[10,3],[12,5]][band];
    q.gi_n = sk[0]; q.gi_k = sk[1];
  }
  draw(q, lite){
    const sh = this.shapes;
    const c = q.col, r = c[0], g = c[1], b = c[2];
    const a = this.seedAlpha(q);
    const s = q.size * 1.05;
    const star = sh.star(q.gi_n, q.gi_k);
    // faint outer frame (the regular n-gon the star is inscribed in)
    if(!lite){
      noFill(); stroke(r, g, b, a * 0.16); strokeWeight(0.7);
      beginShape();
      for(let i = 0; i < q.gi_n; i++){ const ang = i / q.gi_n * TAU - Math.PI / 2; vertex(Math.cos(ang) * s * 1.04, Math.sin(ang) * s * 1.04); }
      endShape(CLOSE);
    }
    // strapwork ribbon: halo -> body -> bright inner strand (interlace reading)
    noFill();
    if(!lite){ stroke(r, g, b, a * 0.22 * GLOW); strokeWeight(3.2); sh.emit(star, s, true); }
    stroke(r, g, b, a); strokeWeight(1.2); sh.emit(star, s, true);
    if(!lite){
      stroke(lerpN(r, 255, 0.6), lerpN(g, 255, 0.6), lerpN(b, 255, 0.6), a * 0.6);
      strokeWeight(0.5); sh.emit(star, s, true);
    }
    noStroke(); fill(lerpN(r, 255, 0.5), lerpN(g, 255, 0.5), lerpN(b, 255, 0.5), a * 0.8);
    circle(0, 0, Math.max(1.4, s * 0.12));
    this.hoverRing(q, s, r, g, b, 2.6);
  }
  voice(q){
    // rigid, crystalline: square through a tight filter, STRICTLY quantized (no detune).
    // star order picks the degree, so each star order rings at its own pitch.
    return { deg: q.gi_n, oct: q.mag >= 6 ? 2 : q.mag >= 4.5 ? 3 : 4, type: 'square',
             cutoff: lerpN(2000, 600, Math.min(q.depth, 700) / 700), dur: 0.4 };
  }
}

/* CONWAY'S GAME OF LIFE on a small polar grid (C angular x R radial). Standard
   B3/S23 rule, Moore (8) neighborhood with angular wraparound and bounded
   radius. Small grids collapse to still-lifes or die, so each instance keeps
   itself alive: it reseeds (from its own mulberry32 PRNG) when it goes static,
   empties, or reaches a max age — with the age offset per seed so the field
   never reseeds in sync. Double-buffered, stepped in place; live cells are
   published as one Float32Array point cloud.
   (A class EXPRESSION — one automaton instance is owned per seed as q.life.) */
export const GameOfLife = class GameOfLife {
  static STEP_FRAMES = 18;                                // ~3 generations/sec at 60fps (calm)

  constructor(seed, C, R, maxGen){
    this.C = C; this.R = R; this.maxGen = maxGen;
    this.S  = new Uint8Array(C * R);
    this.S2 = new Uint8Array(C * R);
    this.rngState = ((seed * 2654435761) >>> 0) || 1;     // per-seed PRNG seed
    this.sinceSeed = 0;
    this.pop = 0;                                         // live fraction 0..1 (the voice reads this)
    this.points = new Float32Array(0);
    this.reseed();
    for(let i = 0; i < 3; i++) this.step();               // warm up to mid-evolution
    this.sinceSeed = seed % maxGen;                       // desync reseeds across the field
    this.stepPhase = seed % GameOfLife.STEP_FRAMES;       // stagger steps
    this.lastStep = -1;
    this.build();
  }

  rng(){                                                  // mulberry32, advances state
    let t = (this.rngState = (this.rngState + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  reseed(){                                               // sprinkle a fresh live pattern
    const S = this.S, n = S.length;
    for(let i = 0; i < n; i++) S[i] = this.rng() < 0.42 ? 1 : 0;
    this.sinceSeed = 0;
  }

  step(){
    const C = this.C, R = this.R, S = this.S, T = this.S2; let pop = 0, same = true;
    for(let r = 0; r < R; r++){
      for(let a = 0; a < C; a++){
        let n = 0;
        for(let dr = -1; dr <= 1; dr++){
          const rr = r + dr; if(rr < 0 || rr >= R) continue;
          for(let da = -1; da <= 1; da++){ if(!dr && !da) continue; n += S[rr * C + ((a + da + C) % C)]; }
        }
        const i = r * C + a, live = S[i];
        const v = (live ? (n === 2 || n === 3) : (n === 3)) ? 1 : 0;
        T[i] = v; pop += v; if(v !== live) same = false;
      }
    }
    this.S = T; this.S2 = S;                              // swap buffers
    this.sinceSeed++;
    if(pop === 0 || same || this.sinceSeed >= this.maxGen) this.reseed(); // keep it alive
  }

  build(){                                                // live cells -> polar point cloud
    const C = this.C, R = this.R, S = this.S, out = []; let on = 0;
    for(let r = 0; r < R; r++){
      const rad = R > 1 ? lerpN(0.30, 0.82, r / (R - 1)) : 0.55;
      for(let a = 0; a < C; a++){
        if(S[r * C + a]){ const ang = a / C * TAU; out.push(Math.cos(ang) * rad, Math.sin(ang) * rad); on++; }
      }
    }
    this.points = Float32Array.from(out);
    this.pop = on / (C * R);
  }

  /* advance (time-gated, staggered, once per frame); fc = frameCount */
  maybeStep(fc){
    if(this.lastStep !== fc && (fc + this.stepPhase) % GameOfLife.STEP_FRAMES === 0){
      this.step(); this.build(); this.lastStep = fc;
    }
  }
};

/* ---- 5 · AUTOMATA — Conway's Game of Life (the earth as emergent rule) ---- */
/* Conceptual close: Conway's Life is the canonical demonstration that complex,
   lifelike behaviour emerges from simple local rules — and CA models like
   Olami–Feder–Christensen model seismic self-organized criticality, so each
   quake is shown as a small living automaton. */
export class AutomataMotif extends Motif {
  constructor(view, shapes){
    super(view, shapes);
    this.name = 'automata';
    this.defaultSym = 4;
  }
  prepare(q){
    const band = q.mag < 2.5 ? 0 : q.mag < 4.5 ? 1 : q.mag < 6 ? 2 : 3;
    const C      = [12, 16, 20, 24][band];                // angular cells
    const R      = [4, 4, 5, 6][band];                    // radial rings
    const maxGen = [40, 48, 56, 64][band];                // reseed after this many static-free gens
    q.life = new GameOfLife(q.idx, C, R, maxGen);
  }
  draw(q, lite){
    const sh = this.shapes, life = q.life;
    // advance the automaton (time-gated, staggered, once per seed per frame)
    if(!lite && !this.view.reduceMotion) life.maybeStep(frameCount);
    const c = q.col, r = c[0], g = c[1], b = c[2];
    const a = this.seedAlpha(q);
    const s = q.size * 0.95;
    const cellW = Math.max(1.6, s / life.R * 0.62);       // cell dot size ~ ring spacing
    if(!lite){ stroke(r, g, b, a * 0.25 * GLOW); strokeWeight(cellW * 2.4); sh.emitPoints(life.points, s); }
    stroke(r, g, b, a); strokeWeight(cellW); sh.emitPoints(life.points, s);
    noStroke(); fill(lerpN(r, 255, 0.55), lerpN(g, 255, 0.55), lerpN(b, 255, 0.55), a * 0.85);
    circle(0, 0, Math.max(1.4, s * 0.12));
    this.hoverRing(q, s, r, g, b, 2.6);
  }
  voice(q){
    // digital pluck; LIVE population drives pitch, so the tone breathes as Life evolves
    const ag = Math.min(1, Math.max(0, ((q.life?.pop ?? 0.2) - 0.08) / 0.24));
    return { deg: Math.round(ag * 6), oct: q.mag >= 6 ? 2 : q.mag >= 4.5 ? 3 : 4, type: 'sawtooth',
             cutoff: lerpN(2800, 800, Math.min(q.depth, 700) / 700), dur: 0.34 };
  }
}
