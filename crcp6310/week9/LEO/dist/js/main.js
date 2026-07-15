/*
  main.js — ORBITA spike entry. p5 instance mode: nothing global, no
  namespace collisions with p5 2.x, and every subsystem gets its
  dependencies explicitly. DOM chrome is guarded (Seisma convention) so the
  same bundle runs bare in the p5.js Web Editor.

  CONTROLS
    drag rotate   scroll zoom   <- -> kaleidoscope folds   F focus tour   G group
    T time scale   E altitude scale   Space pause   M sound   S save PNG
*/

'use strict';

import feed from './feeds/celestrak.js';
import { fixtureObjects, RECORDED_AT } from './feeds/fixture.js';
import { orbitsMotif, scaledRadiusKm, R_EARTH_KM } from './render/orbits.js';
import { drawEarth } from './render/earth.js';
import { findClosePairs, Blooms } from './sim/conjunctions.js';
import { sunEphemeris, sunDiscRadius } from './sim/sun.js';
import { drawSky } from './render/sky.js';
import { pickNotables } from './sim/notables.js';
import { GroundTrack, eciToEarthFixed } from './sim/groundtrack.js';
import { orbital3D } from './render/orbits.js';
import { latLonToXYZ } from './render/earth.js';
import { Sonifier } from './audio.js';
import { CONFIG, state, timeScale, altExag } from './state.js';

const $ = id => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

const sonifier = new Sonifier();
const blooms = new Blooms(24);
let headsKm = new Float32Array(0);           // true-scale positions for sim
let fpsAcc = 0, fpsN = 0;
const crossings = [];
let notables = [];
const ghost = new Float32Array(97 * 3);      // focused orbit polyline scratch
const track = new GroundTrack(420);
const efScratch = new Float32Array(3);
let idleMs = 0, galleryAngle = 0, galleryHold = 0;

async function loadGroup() {
  const group = CONFIG.groups[state.groupIdx];
  state.dataMode = 'loading'; refreshHud();
  try {
    const objs = await feed.load(group);            // cached after first hit
    state.objects = orbitsMotif.prepare(objs.slice(0, CONFIG.maxRender));
    headsKm = new Float32Array(state.objects.length * 3);
    notables = pickNotables(state.objects);
    state.focusStep = 0; sonifier.solo(null); track.reset();
    state.dataMode = 'live';
  } catch (e) {
    state.objects = orbitsMotif.prepare(fixtureObjects());
    headsKm = new Float32Array(state.objects.length * 3);
    notables = pickNotables(state.objects);
    state.focusStep = 0; sonifier.solo(null); track.reset();
    state.dataMode = 'fixture';
  }
  if (state.soundOn) sonifier.setVoices(orbitsMotif.voices(state.objects));
  refreshHud();
}

function refreshHud() {
  setText('s-src',   state.dataMode === 'live' ? 'CelesTrak live'
                   : state.dataMode === 'fixture' ? `recorded ${RECORDED_AT}` : 'loading\u2026');
  setText('s-group', CONFIG.groups[state.groupIdx]);
  setText('s-count', String(state.objects.length));
  setText('s-time',  timeScale() + '\u00d7');
  setText('s-exag',  altExag() === 1 ? 'true scale' : 'altitude \u00d7' + altExag());
  if (state.objects.length) {
    const alts = state.objects.map(o => o.altKm);
    setText('s-alt', Math.round(Math.min(...alts)) + '\u2013' + Math.round(Math.max(...alts)) + ' km');
  }
  setText('s-snd', state.soundOn ? 'on' : 'off');
  setText('s-fold', state.folds === 1 ? 'off' : state.folds + '-fold');
  if (state.focusStep > 0 && notables.length) {
    const n = notables[(state.focusStep - 1) % notables.length];
    const o = state.objects[n.idx];
    setText('s-focus', n.key + ' \u00b7 ' + o.name);
    setText('s-fdet', Math.round(o.altKm) + ' km \u00b7 ' + o.periodMin.toFixed(1)
      + ' min \u00b7 ' + o.freqHz.toFixed(0) + ' Hz');
  } else { setText('s-focus', 'off'); setText('s-fdet', '\u2014'); }
  setText('s-conj', String(state.conjCount));
}

new p5(p => {
  let lastReal = 0;

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.pixelDensity(1);
    state.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastReal = performance.now();
    loadGroup();
  };

  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);

  p.draw = () => {
    const now = performance.now();
    const dtReal = now - lastReal;
    if (!state.paused) state.simT += dtReal * timeScale();
    lastReal = now;

    /* gallery mode: after 20 s idle the piece performs itself — slow drift
       plus an auto-advancing focus tour. Any input reclaims control. */
    idleMs += dtReal;
    const gallery = idleMs > 20000 && !state.reduceMotion;
    if (gallery) {
      galleryAngle += dtReal * 0.000045;
      galleryHold += dtReal;
      if (galleryHold > 30000 && notables.length) {
        galleryHold = 0;
        state.focusStep = (state.focusStep % notables.length) + 1;
        track.reset();
        if (state.soundOn) sonifier.solo(
          state.objects[notables[(state.focusStep - 1) % notables.length].idx].freqHz);
        refreshHud();
      }
    } else galleryHold = 0;

    p.background(10, 13, 19);
    p.orbitControl(1.4, 1.4, 0.2);                 // drag rotate, scroll zoom
    p.rotateY(galleryAngle);

    /* km -> px: outermost shell at current exaggeration fills ~46% of the
       short edge; Earth radius follows from the same factor (honest scale) */
    const exag = altExag();
    const rOuterKm = scaledRadiusKm(CONFIG.altMaxKm, exag);
    const kmToPx = (Math.min(p.width, p.height) * 0.46) / rOuterKm;

    /* the real sky, fixed in the equatorial frame the orbits share */
    p.blendMode(p.ADD);
    drawSky(p, scaledRadiusKm(CONFIG.altMaxKm, exag) * kmToPx * 5.5);
    p.blendMode(p.BLEND);

    /* the sun: one ephemeris feeds the globe, the ensemble, and the score */
    const sun = sunEphemeris(state.simT);
    const sunEF = latLonToXYZ(sun.declDeg, sun.subsolarLonDeg);

    /* earth-fixed frame rotates under the orbits at sidereal rate.
       VISUAL CHECK: continents should drift eastward (against satellite
       motion in prograde shells) — if reversed, flip this sign. */
    /* focused object's sub-satellite point (headsKm holds LAST frame's
       positions here — one frame of lag is invisible at any time scale) */
    const focused = state.focusStep > 0 && notables.length
      ? notables[(state.focusStep - 1) % notables.length].idx : -1;
    if (focused >= 0 && !state.paused && state.objects.length) {
      const i3 = focused * 3;
      eciToEarthFixed(headsKm[i3], headsKm[i3+1], headsKm[i3+2],
                      sun.gmstDeg * Math.PI / 180, efScratch);
      track.push(efScratch[0], efScratch[1], efScratch[2]);
    }

    p.push();
    p.rotateY(-sun.gmstDeg * Math.PI / 180);
    drawEarth(p, R_EARTH_KM * kmToPx, sunEF);
    if (focused >= 0 && track.n > 1) {             // the westward sinusoid
      const rT = R_EARTH_KM * kmToPx * 1.006;
      p.strokeWeight(1.6);
      let px = null, py = 0, pz = 0;
      track.each((x, y, z, rec) => {
        p.stroke(255, 245, 220, 25 + 150 * rec);
        if (px !== null) p.line(px * rT, py * rT, pz * rT, x * rT, y * rT, z * rT);
        px = x; py = y; pz = z;
      });
    }
    p.pop();

    /* THE SUN — direction true, photosphere at true angular size for its
       distance; the corona is glare, i.e. artistic. Nested additive shells. */
    const sunD = scaledRadiusKm(CONFIG.altMaxKm, exag) * kmToPx * 2.6;
    const sx = sun.eciDir[0] * sunD, sy = sun.eciDir[1] * sunD, sz = sun.eciDir[2] * sunD;
    const disc = Math.max(2.5, sunDiscRadius(sunD));
    p.blendMode(p.ADD);
    p.push();
    p.translate(sx, sy, sz);
    p.noStroke();
    p.fill(255, 252, 240, 255); p.sphere(disc, 12, 9);          // photosphere
    for (const [mul, r_, g_, b_, a_] of [
      [2.2, 255, 244, 205, 60], [4.0, 255, 226, 160, 34],
      [7.0, 255, 200, 120, 18], [11.5, 255, 176, 96, 9],
      [17.0, 255, 150, 80, 4],
    ]) { p.fill(r_, g_, b_, a_); p.sphere(disc * mul, 12, 9); }  // corona
    p.pop();
    p.blendMode(p.BLEND);

    p.blendMode(p.ADD);                    // density -> luminance
    crossings.length = 0;
    orbitsMotif.draw(p, {
      objects: state.objects,
      simT:    state.simT,
      kmToPx,
      altExag: exag,
      tScale:  timeScale(),
      folds:   state.folds,
      headsKm,
      sunEci:  sun.eciDir,
      crossings,
    });
    for (const c of crossings) sonifier.crossing(c.hz, c.sunrise);

    /* focus tour: ghost orbit + pulsing head for the focused object */
    if (state.focusStep > 0 && notables.length) {
      const o = state.objects[notables[(state.focusStep - 1) % notables.length].idx];
      const rF = scaledRadiusKm(o.altKm, exag) * kmToPx;
      for (let s = 0; s <= 96; s++)
        orbital3D(o.incl, o.raan, s * 3.75, rF, ghost, s * 3);
      p.stroke(235, 240, 250, 70); p.strokeWeight(1);
      p.beginShape();
      for (let i = 0; i < ghost.length; i += 3)
        p.vertex(ghost[i], ghost[i+1], ghost[i+2]);
      p.endShape();
      const ph = feed.propagate(o, state.simT);
      orbital3D(o.incl, o.raan, o.argp + ph.meanAnomaly, rF, ghost, 0);
      p.stroke(255, 255, 255, 160 + 70 * Math.sin(p.frameCount * 0.12));
      p.strokeWeight(11);
      p.point(ghost[0], ghost[1], ghost[2]);
    }

    /* conjunctions on true-scale positions; bloom + chime, fold-replicated */
    if (!state.paused && state.objects.length > 1) {
      const pairs = findClosePairs(headsKm, state.objects.length, CONFIG.conjKm);
      for (const [i, j] of pairs.slice(0, 3)) {
        const a = state.objects[i], b = state.objects[j];
        const rr = scaledRadiusKm(a.altKm, exag) * kmToPx;
        const mid = new Float32Array(3);
        for (let k = 0; k < 3; k++)
          mid[k] = (headsKm[i*3+k] + headsKm[j*3+k]) / 2;
        const norm = Math.hypot(mid[0], mid[1], mid[2]) || 1;
        blooms.spawn(mid[0]/norm*rr, mid[1]/norm*rr, mid[2]/norm*rr);
        sonifier.ping(a.freqHz, b.freqHz);
        state.conjCount++;
      }
      if (pairs.length) refreshHud();
    }
    blooms.step(p.deltaTime / 1000);
    const TAU = Math.PI * 2;
    for (const b of blooms.items) {
      if (b.life <= 0) continue;
      const e = 1 - b.life;                        // 0 -> 1
      p.stroke(255, 235, 190, 200 * b.life);
      p.strokeWeight(2 + 26 * e);
      for (let f = 0; f < state.folds; f++) {
        const th = f * TAU / state.folds, c = Math.cos(th), s = Math.sin(th);
        p.point(b.x * c + b.z * s, b.y, -b.x * s + b.z * c);
      }
    }
    p.blendMode(p.BLEND);

    /* fps meter (perf work should be measurable) */
    fpsAcc += p.frameRate(); fpsN++;
    if (fpsN >= 30) {
      setText('s-fps', Math.round(fpsAcc / fpsN) + ' fps');
      let dark = 0;
      for (const o of state.objects) if (o._dark) dark++;
      setText('s-ecl', state.objects.length
        ? Math.round(100 * dark / state.objects.length) + '%' : '\u2014');
      fpsAcc = 0; fpsN = 0;
    }
  };

  p.mousePressed = () => { idleMs = 0; };
  p.mouseDragged = () => { idleMs = 0; };
  p.mouseWheel   = () => { idleMs = 0; };

  p.keyPressed = () => {
    idleMs = 0;
    const k = p.key.toLowerCase();
    if (k === 'g') { state.groupIdx = (state.groupIdx + 1) % CONFIG.groups.length; loadGroup(); }
    else if (k === 't') { state.timeIdx = (state.timeIdx + 1) % CONFIG.timeScales.length; refreshHud(); }
    else if (k === 'e') { state.exagIdx = (state.exagIdx + 1) % CONFIG.altExags.length; refreshHud(); }
    else if (p.keyCode === 39) { state.folds = Math.min(CONFIG.maxFolds, state.folds + 1); refreshHud(); }
    else if (p.keyCode === 37) { state.folds = Math.max(1, state.folds - 1); refreshHud(); }
    else if (k === 'f') {
      state.focusStep = (state.focusStep + 1) % (notables.length + 1);
      track.reset();
      const on = state.focusStep > 0 && notables.length;
      sonifier.solo(on
        ? state.objects[notables[(state.focusStep - 1) % notables.length].idx].freqHz
        : null);
      refreshHud();
    }
    else if (k === ' ') state.paused = !state.paused;
    else if (k === 's') p.saveCanvas('orbita', 'png');
    else if (k === 'm') {
      state.soundOn = !state.soundOn;
      if (state.soundOn) sonifier.start(orbitsMotif.voices(state.objects));
      else sonifier.stop();
      refreshHud();
    }
  };
});
