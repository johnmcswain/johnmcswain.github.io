'use strict';
/* smoke_test.mjs — headless checks for the modularized SEISMA (node smoke_test.mjs)
   No browser, no GPU: stubs the p5 globals the modules touch, then verifies
   the class contracts, determinism, and numeric sanity. */

import assert from 'node:assert/strict';

/* ---- stub the p5 global-mode surface the modules call at runtime ---- */
const noop = () => {};
for(const f of ['beginShape','endShape','vertex','noFill','noStroke','fill','stroke',
                'strokeWeight','circle','line','push','pop','rotate','translate'])
  globalThis[f] = noop;
globalThis.map = (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a));
globalThis.noise = (x, y = 0) => 0.5 + 0.4 * Math.sin(x * 1.7 + y * 2.3); // smooth, bounded
globalThis.CLOSE = 'close'; globalThis.POINTS = 'points';
globalThis.frameCount = 0;

const { ColorHarmony, lerpN } = await import('./palette.js');
const { ShapeAtlas }          = await import('./shapes.js');
const { Motif, CelticMotif, BotanicalMotif, FluidMotif, GirihMotif, AutomataMotif, GameOfLife }
                              = await import('./motifs.js');
const { Sonifier }            = await import('./audio.js');
const { QuakeFeed }           = await import('./data.js');

let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

/* ---- ColorHarmony: finite RGB in 0..255 across all harmonies and depths ---- */
ok('palette: all harmonies finite + in range', () => {
  const pal = new ColorHarmony(38);
  for(let h = 0; h < ColorHarmony.KEYS.length; h++){
    for(let d = 0; d <= 700; d += 70){
      const c = pal.depthColor(d);
      assert.equal(c.length, 3);
      for(const v of c){ assert.ok(Number.isFinite(v) && v >= 0 && v <= 255.0001, pal.name + ' d=' + d); }
    }
    pal.cycle();
  }
  assert.equal(pal.idx, 0);                              // cycled all the way around
});

ok('palette: hue scrub wraps', () => {
  const pal = new ColorHarmony(1); pal.shiftHue(-5);
  assert.ok(pal.baseHue >= 0 && pal.baseHue < 360);
});

/* ---- ShapeAtlas: cache identity + unit normalization ---- */
ok('shapes: polyline caches return identical arrays', () => {
  const sh = new ShapeAtlas();
  assert.equal(sh.knot(3, 5, 0.4, 84), sh.knot(3, 5, 0.4, 84));
  assert.equal(sh.superformula(8, 0.35, 0.9, 0.9, 84), sh.superformula(8, 0.35, 0.9, 0.9, 84));
  assert.equal(sh.star(10, 3), sh.star(10, 3));
});

ok('shapes: superformula normalized to unit radius, no NaN', () => {
  const pts = new ShapeAtlas().superformula(12, 0.3, 0.7, 0.7, 120);
  let maxr = 0;
  for(let i = 0; i < pts.length; i += 2){
    const r = Math.hypot(pts[i], pts[i + 1]);
    assert.ok(Number.isFinite(r)); if(r > maxr) maxr = r;
  }
  assert.ok(Math.abs(maxr - 1) < 1e-6);
});

ok('shapes: {n/k} star is closed and unicursal', () => {
  const pts = new ShapeAtlas().star(5, 2);
  assert.equal(pts.length, (5 + 1) * 2);                 // gcd(5,2)=1 -> n+1 points
  assert.ok(Math.abs(pts[0] - pts[pts.length - 2]) < 1e-9);
});

/* ---- Motifs: contract, determinism, draw without NaN/throw ---- */
const view = { hovered: null, reduceMotion: false, motion: 1 };
const shapes = new ShapeAtlas();
const motifs = [CelticMotif, BotanicalMotif, FluidMotif, GirihMotif, AutomataMotif].map(M => new M(view, shapes));

ok('motifs: five subclasses of Motif with unique names + defaultSym', () => {
  const names = new Set();
  for(const m of motifs){
    assert.ok(m instanceof Motif);
    assert.ok(typeof m.name === 'string' && m.name.length);
    assert.ok(Number.isInteger(m.defaultSym) && m.defaultSym >= 1);
    names.add(m.name);
  }
  assert.equal(names.size, 5);
});

const mkSeed = (idx, mag) => ({ idx, mag, depth: 120, time: Date.now(), place: 'x', url: '#',
  col: [200, 150, 90], size: 24, alpha: 200, phase: 0, recent: false, kp: 0, px: 0, py: 0, spinSpeed: 0 });

ok('motifs: prepare is deterministic (idempotent per idx+mag)', () => {
  for(const m of motifs){
    const a = mkSeed(7, 5.1), b = mkSeed(7, 5.1);
    m.prepare(a); m.prepare(b);
    for(const k of Object.keys(a)){
      if(k === 'life' || k === 'time') continue;         // life holds typed arrays; compare below
      assert.deepEqual(a[k], b[k], m.name + '.' + k);
    }
    if(a.life){ assert.deepEqual(Array.from(a.life.S), Array.from(b.life.S), m.name + ' CA state'); }
  }
});

ok('motifs: draw + voice run headless across mag bands, voices finite', () => {
  for(const m of motifs){
    for(const mag of [1.2, 3.0, 5.1, 7.2]){
      const q = mkSeed(3, mag); m.prepare(q);
      globalThis.frameCount = 42;
      m.draw(q, false); m.draw(q, true);
      const v = m.voice(q);
      for(const k of ['deg', 'oct', 'cutoff', 'dur']) assert.ok(Number.isFinite(v[k]), m.name + ' voice.' + k);
      assert.ok(['sine', 'triangle', 'square', 'sawtooth'].includes(v.type));
    }
  }
});

ok('fluid: blob stays finite, morph in sane range, one pass per frame', () => {
  const m = motifs[2], q = mkSeed(11, 6.5); m.prepare(q);
  globalThis.frameCount = 10; m.computeBlob(q);
  const first = q._mframe;
  m.computeBlob(q);                                      // same frame -> guarded
  assert.equal(q._mframe, first);
  for(const r of q._blob) assert.ok(Number.isFinite(r) && r > 0);
  assert.ok(q.morph >= 0 && q.morph <= 1);
});

/* ---- GameOfLife: B3/S23 on the polar grid, self-reviving, no NaN ---- */
ok('life: steps stay populated and points stay finite', () => {
  const life = new GameOfLife(9, 16, 4, 48);
  for(let i = 0; i < 200; i++) life.step();
  life.build();
  assert.ok(life.pop > 0);                               // reseed guarantees survival
  for(const v of life.points) assert.ok(Number.isFinite(v));
});

ok('life: same seed -> same evolution (mulberry32 determinism)', () => {
  const a = new GameOfLife(5, 12, 4, 40), b = new GameOfLife(5, 12, 4, 40);
  for(let i = 0; i < 60; i++){ a.step(); b.step(); }
  assert.deepEqual(Array.from(a.S), Array.from(b.S));
});

/* ---- Sonifier: pitch mapping monotonic in octave, correct on degrees ---- */
ok('audio: degToFreq monotonic across octaves, pentatonic within one', () => {
  const s = new Sonifier();
  assert.ok(Math.abs(s.degToFreq(0, 4) - 220) < 1e-9);
  for(let o = 2; o < 6; o++) assert.ok(s.degToFreq(0, o + 1) / s.degToFreq(0, o) - 2 < 1e-9);
  let prev = 0;
  for(let d = 0; d < 5; d++){ const f = s.degToFreq(d, 4); assert.ok(f > prev); prev = f; }
  assert.ok(Math.abs(s.degToFreq(7, 4) - s.degToFreq(2, 4)) < 1e-9); // degree wrap
});

/* ---- QuakeFeed: offline fallback + specimen shape ---- */
ok('feed: offline fallback sorted newest-first, sane fields', () => {
  const evs = QuakeFeed.offline('day');
  assert.equal(evs.length, 240);
  for(let i = 1; i < evs.length; i++) assert.ok(evs[i - 1].time >= evs[i].time);
  for(const e of evs){ assert.ok(e.mag >= -0.5 && e.mag <= 7.5 && e.depth >= 0 && e.depth <= 300); }
});

ok('feed: specimen has 57 seeds, knots only where variants given', () => {
  const sp = QuakeFeed.buildSpecimen();
  assert.equal(sp.length, 1 + 8 + 8 + 16 + 24);
  assert.ok(sp[0].kp === 3 && sp[0].kq === 5);
  assert.ok(sp[sp.length - 1].kp === 0);
});

ok('feed: mag/period cycling wraps', () => {
  const f = new QuakeFeed();
  for(let i = 0; i < QuakeFeed.MAG_KEYS.length; i++) f.cycleMag();
  for(let i = 0; i < QuakeFeed.PERIODS.length; i++) f.cyclePeriod();
  assert.equal(f.magKey, 'all'); assert.equal(f.period, 'day');
});

ok('misc: lerpN endpoints', () => { assert.equal(lerpN(2, 10, 0), 2); assert.equal(lerpN(2, 10, 1), 10); });

console.log('\nall ' + pass + ' checks passed');
