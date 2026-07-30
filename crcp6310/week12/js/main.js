/*
  main.js — ORBITA spike entry. p5 instance mode: nothing global, no
  namespace collisions with p5 2.x, and every subsystem gets its
  dependencies explicitly. DOM chrome is guarded (Seisma convention) so the
  same bundle runs bare in the p5.js Web Editor.

  CONTROLS
    drag rotate   scroll zoom   O observer   A instrument   W aurora   R wind
    B magnetosphere   D demo storm   V view
    <- -> folds   F focus   G group
    T time scale   E altitude scale   Space pause   M sound   S save PNG
*/

'use strict';

import feed from './feeds/celestrak.js';
import { fixtureObjects, RECORDED_AT } from './feeds/fixture.js';
import { orbitsMotif, scaledRadiusKm, R_EARTH_KM } from './render/orbits.js';
import { drawEarth } from './render/earth.js';
import { findClosePairs, ConjunctionWatch } from './sim/conjunctions.js';
import { StructureField, PlaneRing, CageBurst } from './render/structures.js';
import { Armillary } from './render/armillary.js';
import { Dim3, GeomDynamics } from './core/dynamics.js';
import { Observer, compassPoint, audibleDoppler, MIN_ELEV_DEG }
  from './sim/observer.js';
import swpc, { QUIET_BASELINE } from './feeds/spaceweather.js';
import { AuroraLayer } from './render/aurora.js';
import { parseOvation } from './sim/aurora.js';
import { WindLayer } from './render/solarwind.js';
import { Magnetosphere } from './render/solids.js';
import { sampleSeries, SUN_DISTANCE_RE, sunDrawnRadiusKm } from './sim/solarwind.js';
import { SubstormCycle } from './sim/substorm.js';
import { FlareWatch, readXraySeries, flareClass, flareIntensity } from './sim/flares.js';
import { DemoMode, DEMO_LABEL, SCENARIO_MINUTES } from './sim/demo.js';
import { SkyTracker } from './sim/tracker.js';
import { sunEphemeris } from './sim/sun.js';
import { moonDrawDistanceKm, MOON_RADIUS_KM } from './sim/planets.js';
import { drawSky } from './render/sky.js';
import { pickNotables } from './sim/notables.js';
import { GroundTrack, eciToEarthFixed } from './sim/groundtrack.js';
import { drawSystem } from './render/system.js';
import { planetStates, moonState, eclipticToP5, planetHz } from './sim/planets.js';
import { orbital3D } from './render/orbits.js';
import { latLonToXYZ } from './render/earth.js';
import { Sonifier } from './audio.js';
import { CONFIG, state, timeScale, altExag } from './state.js';

const $ = id => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

const sonifier = new Sonifier();
const field = new StructureField(32);
const conjWatch = new ConjunctionWatch();

/* the instrument is rebuilt when its scale changes (altitude toggle or
   window resize); ring construction is trivial so this is cheaper than
   threading a scale parameter through every part */
let armillary = null, armSig = '';
function ensureArmillary(rOuterPx, rEarthPx, sig) {
  if (armSig !== sig) {
    const keep = armillary ? armillary.mode : 2;   // first load: full
    armillary = new Armillary(Dim3.cube(rOuterPx * 2 * 1.06), rEarthPx);
    while (armillary.mode !== keep) armillary.cycleMode();
    armSig = sig;
  }
  return armillary;
}
let headsKm = new Float32Array(0);           // true-scale positions for sim
let fpsAcc = 0, fpsN = 0;
const crossings = [];
let notables = [];
const ghost = new Float32Array(97 * 3);      // focused orbit polyline scratch
const track = new GroundTrack(420);
const efScratch = new Float32Array(3);
let idleMs = 0, galleryAngle = 0, galleryHold = 0;
const moonV = new Float32Array(3);
/* observer tracking: who is overhead, and is it actually visible */
let tracked = null, rangeRate = 0;
let aboveCount = 0, visibleCount = 0, passMin = 0;
const zenCore = new Float32Array(3);
const sightSat = new Float32Array(3);
/* space weather: the sun's effect on the ensemble */
const aurora = new AuroraLayer();
const tracker = new SkyTracker();
const wind = new WindLayer(260);
const magneto = new Magnetosphere();
/* The magnetosphere is an order of magnitude larger than LEO: the wind
   enters at 15 Earth radii, which is about three screen heights out at the
   default framing, so the layer drew correctly and entirely off-camera.
   Toggling a far-field layer eases the view out to fit it. */
const FAR_FIT_RE = 24;   // wide enough for the magnetotail
let windSeries = null, windSampleT = 0;
let xraySeries = null, flareGlow = 0, lastFlare = null, currentClass = null;
const substorm = new SubstormCycle();
const flareWatch = new FlareWatch();
const demo = new DemoMode();
let lastSimT = 0;
let viewScale = 1, viewTarget = 1;
let weather = { ...QUIET_BASELINE, liveFields: 0, totalFields: 6 };
async function loadWeather() {
  try { weather = await swpc.load(); } catch { /* keeps the quiet baseline */ }
  try { windSeries = await swpc.loadSeries(); } catch { windSeries = null; }
  try { xraySeries = await swpc.loadXray(readXraySeries); } catch { xraySeries = null; }
  refreshHud();
  /* the real model output, if it is reachable and its shape is recognised */
  try {
    const grid = await swpc.loadAurora(parseOvation);
    if (grid) aurora.setOvation(grid);
  } catch { /* the computed oval stands in */ }
  refreshHud();
}

/* the drone follows the view: LEO ensemble, or the six planet-years
   octave-shifted into the audible band — Harmonices Mundi, computed */
function currentVoices() {
  if (state.view === 'system')
    return planetStates(state.simT).map(s => ({ id: s.name, hz: planetHz(s.periodDays) }));
  return orbitsMotif.voices(state.objects);
}

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
  } catch {
    state.objects = orbitsMotif.prepare(fixtureObjects());
    headsKm = new Float32Array(state.objects.length * 3);
    notables = pickNotables(state.objects);
    state.focusStep = 0; sonifier.solo(null); track.reset();
    state.dataMode = 'fixture';
  }
  if (state.soundOn) sonifier.setVoices(orbitsMotif.voices(state.objects));
  refreshHud();
}

/* the sky readout changes every frame, so it updates on the fps tick
   rather than only on input */
function updateObserverHud() {
  const banner = $('lookup');
  if (!state.observer) {
    setText('s-pass', '\u2014'); setText('s-dop', '\u2014');
    if (banner) banner.style.display = 'none';
    return;
  }
  if (!tracked) {
    setText('s-pass', 'nothing above ' + MIN_ELEV_DEG + '\u00b0');
    setText('s-dop', '\u2014');
    if (banner) banner.style.display = 'none';
    return;
  }
  setText('s-pass', tracked.name + ' \u00b7 ' + Math.round(tracked.elevDeg)
    + '\u00b0 ' + compassPoint(tracked.azDeg) + ' \u00b7 '
    + Math.round(tracked.rangeKm) + ' km \u00b7 ' + tracked.vis
    + ' (' + visibleCount + '/' + aboveCount + ' up)');
  setText('s-dop', (rangeRate >= 0 ? '+' : '') + rangeRate.toFixed(2)
    + ' km/s \u00b7 shift ' + ((audibleDoppler(1000, rangeRate) / 1000 - 1) * 100).toFixed(1)
    + '% (exaggerated \u00d72000 for audibility)');
  if (banner) {
    if (tracked.vis === 'visible') {
      banner.textContent = 'GO OUTSIDE \u00b7 ' + tracked.name + ' is '
        + Math.round(tracked.elevDeg) + '\u00b0 above your '
        + compassPoint(tracked.azDeg) + ' horizon, sunlit \u00b7 '
        + (passMin >= 20 ? '20+' : '~' + passMin.toFixed(1)) + ' min left';
      banner.style.display = 'block';
    } else banner.style.display = 'none';
  }
}

/* say WHY we are not live: a silent fallback that looks like fresh data is
   the one failure this project must never present */
function sourceLabel() {
  if (state.dataMode === 'loading') return 'loading\u2026';
  if (state.dataMode === 'live')
    return feed.lastSource === 'cached' ? 'CelesTrak (cached)' : 'CelesTrak live';
  const e = feed.lastError;
  return e ? `recorded ${RECORDED_AT} \u2014 ${e.message}`
           : `recorded ${RECORDED_AT}`;
}

function refreshHud() {
  setText('s-view',  state.view === 'system' ? 'solar system' : 'earth orbit');
  setText('s-src', sourceLabel());
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
  setText('s-inst', armillary ? armillary.label : 'off');
  const dbanner = $('demobanner');
  if (dbanner) dbanner.style.display = demo.active ? 'block' : 'none';
  if (dbanner && demo.active) dbanner.textContent = DEMO_LABEL
    + ' \u00b7 storm scenario, ' + Math.round(demo.minutes % SCENARIO_MINUTES)
    + '/' + SCENARIO_MINUTES + ' min';
  setText('s-kp', demo.active ? 'SIMULATED \u2014 demonstration conditions'
    : 'Kp ' + weather.kp.toFixed(1) + ' \u00b7 G' + weather.scaleG
      + ' \u00b7 ' + weather.liveFields + '/' + weather.totalFields + ' live ('
      + weather.source + ')');
  setText('s-sw', Math.round(weather.windSpeedKmS) + ' km/s \u00b7 '
    + weather.windDensity.toFixed(1) + ' p/cm\u00b3 \u00b7 Bz '
    + weather.bzNt.toFixed(1) + ' nT \u00b7 F10.7 ' + Math.round(weather.f107));
  const wl = $('wxlegend');
  if (wl) wl.style.display = wind.visible ? 'block' : 'none';
  setText('s-wind', wind.visible
    ? 'magnetopause ' + wind.standoffRe.toFixed(1) + ' R\u2091 \u00b7 flaring '
      + wind.alpha.toFixed(2) + ' \u00b7 ' + wind.activeCount
      + ' parcels (flow scaled)' : 'hidden');
  setText('s-storm', substorm.phase + ' \u00b7 load '
    + Math.round(substorm.loadFraction * 100) + '% \u00b7 gain '
    + substorm.auroraGain.toFixed(2) + ' \u00b7 ' + substorm.onsets + ' onsets');
  setText('s-xray', currentClass
    ? currentClass.label + (lastFlare ? ' \u00b7 last flare ' + lastFlare.label : '')
      + ' \u00b7 ' + flareWatch.count + ' this session'
    : (xraySeries ? 'waiting' : 'no X-ray series'));
  setText('s-swseries', windSeries
    ? (swpc.seriesSource || 'series') + ' \u00b7 ' + windSeries.length + ' samples'
      + (windSampleT ? ' \u00b7 replaying ' + new Date(windSampleT)
          .toISOString().slice(11, 16) + 'Z' : '')
    : 'snapshot only \u2014 ' + (swpc.seriesError || 'not loaded'));
  setText('s-frame', (wind.visible || magneto.visible)
    ? 'wide \u2014 fits ' + FAR_FIT_RE + ' R\u2091 (magnetosphere)'
    : 'close \u2014 orbital shells');
  setText('s-belt', magneto.visible
    ? magneto.parts + ' objects \u00b7 ' + magneto.segmentCount + ' segments' : 'hidden');
  setText('s-aur', aurora.visible
    ? aurora.source + ' \u00b7 ' + aurora.activeCount + ' cells' : 'hidden');
  setText('s-obs', state.observer
    ? state.observer.label + ' (' + state.observer.source + ')' : 'off');
  updateObserverHud();
  if (state.focusStep > 0 && notables.length) {
    const n = notables[(state.focusStep - 1) % notables.length];
    const o = state.objects[n.idx];
    setText('s-focus', n.key + ' \u00b7 ' + o.name);
    setText('s-fdet', Math.round(o.altKm) + ' km \u00b7 ' + o.periodMin.toFixed(1)
      + ' min \u00b7 ' + o.freqHz.toFixed(0) + ' Hz');
    /* the four GeomDynamics values, measured rather than tuned */
    const gd = GeomDynamics.fromOrbit(o, weather.f107);
    setText('s-fdyn', gd.spd.toFixed(2) + ' km/s \u00b7 g '
      + (gd.gravity * 1000).toFixed(2) + ' m/s\u00b2 \u00b7 node '
      + gd.friction.toFixed(2) + '\u00b0/day \u00b7 drag '
      + gd.damping.toExponential(1) + ' rel');
  } else { setText('s-focus', 'off'); setText('s-fdet', '\u2014');
           setText('s-fdyn', '\u2014'); }
  setText('s-conj', state.conjCount + ' encounters \u00b7 '
    + conjWatch.activeCount + ' close now');
}

new p5(p => {
  let lastReal = 0;

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.pixelDensity(1);
    state.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastReal = performance.now();
    loadGroup();
    loadWeather();
    setInterval(loadWeather, swpc.refreshMs);
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

    if (state.view === 'system') {
      /* THE SYSTEM VIEW — positions true, distances log-compressed */
      const rSys = Math.min(p.width, p.height) * 0.46;
      p.blendMode(p.ADD);
      drawSky(p, rSys * 5.5);
      p.push(); p.noStroke();                      // the sun, center of it all
      p.fill(255, 252, 240, 255); p.sphere(7, 12, 9);
      for (const [mul, r_, g_, b_, a_] of [
        [2.0, 255, 244, 205, 60], [3.6, 255, 226, 160, 34],
        [6.0, 255, 200, 120, 18], [9.5, 255, 176, 96, 8],
      ]) { p.fill(r_, g_, b_, a_); p.sphere(7 * mul, 12, 9); }
      p.pop();
      drawSystem(p, { simT: state.simT, rMaxPx: rSys,
        earthPulse: 0.5 + 0.5 * Math.sin(p.frameCount * 0.05) });
      p.blendMode(p.BLEND);
      fpsAcc += p.frameRate(); fpsN++;
      if (fpsN >= 30) { setText('s-fps', Math.round(fpsAcc / fpsN) + ' fps'); fpsAcc = 0; fpsN = 0; }
      return;
    }

    /* km -> px: outermost shell at current exaggeration fills ~46% of the
       short edge; Earth radius follows from the same factor (honest scale) */
    const exag = altExag();
    const rOuterKm = scaledRadiusKm(CONFIG.altMaxKm, exag);
    /* fit the far field when it is showing, otherwise frame the shells */
    const shortEdge = Math.min(p.width, p.height);
    const farOn = wind.visible || magneto.visible;
    viewTarget = farOn
      ? (0.44 * rOuterKm) / (0.46 * FAR_FIT_RE * R_EARTH_KM) : 1;
    viewScale += (viewTarget - viewScale) * 0.07;          // eased, not snapped
    const kmToPx = (shortEdge * 0.46) / rOuterKm * viewScale;

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
    p.rotateY(sun.gmstDeg * Math.PI / 180);
    drawEarth(p, R_EARTH_KM * kmToPx, sunEF);
    /* auroral ovals: geographic, so inside the earth-fixed frame, at the
       real 110 km emission altitude and additive like real airglow */
    aurora.update(auroraKp, sun.subsolarLonDeg,
      { gain: substorm.auroraGain, polewardDeg: substorm.polewardDeg });
    p.blendMode(p.ADD);
    aurora.draw(p, R_EARTH_KM * kmToPx, kmToPx);
    /* the magnetosphere: toroidal belts, L-shells and trapped particle
       helices, all earth-fixed because the field turns with the planet */
    magneto.update(p.deltaTime / 1000);
    magneto.draw(p, kmToPx);
    p.blendMode(p.BLEND);
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

    /* the Moon, geocentric, at its true distance — zoom out to find it */
    const moon = moonState(state.simT);
    {
      const mR = moonDrawDistanceKm(moon.distKm) * kmToPx;
      const la = moon.latDeg * Math.PI / 180, lo = moon.lonDeg * Math.PI / 180;
      eclipticToP5(Math.cos(la) * Math.cos(lo) * mR,
                   Math.cos(la) * Math.sin(lo) * mR,
                   Math.sin(la) * mR, moonV);
      p.push(); p.translate(moonV[0], moonV[1], moonV[2]);
      p.noStroke(); p.fill(200, 200, 205, 235);
      p.sphere(Math.max(2.2, MOON_RADIUS_KM * kmToPx), 12, 10);
      p.pop();
    }

    /* THE SUN — direction true, photosphere at true angular size for its
       distance; the corona is glare, i.e. artistic. Nested additive shells. */
    /* beyond the wind inflow edge, so the stream leaves the sun */
    const sunD = SUN_DISTANCE_RE * R_EARTH_KM * kmToPx;
    const sx = sun.eciDir[0] * sunD, sy = sun.eciDir[1] * sunD, sz = sun.eciDir[2] * sunD;
    const flare = flareGlow * (lastFlare ? flareIntensity(lastFlare.flux) : 0);
    const disc = Math.max(3, sunDrawnRadiusKm() * kmToPx) * (1 + 0.22 * flare);
    p.blendMode(p.ADD);
    p.push();
    p.translate(sx, sy, sz);
    p.noStroke();
    p.fill(255, 252, 240, 255); p.sphere(disc, 12, 9);          // photosphere
    /* corona multipliers, tightened to match the smaller disc: the previous
       set reached 107 Re, four times the whole wide frame */
    for (const [mul, r_, g_, b_, a_] of [
      [1.5, 255, 244, 205, 54], [2.2, 255, 226, 160, 30],
      [3.2, 255, 200, 120, 16], [4.5, 255, 176, 96, 8],
      [6.0, 255, 150, 80, 4],
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
      f107:    weather.f107,
    });
    for (const c of crossings) {
      sonifier.crossing(c.hz, c.sunrise);
      const i3 = c.idx * 3;
      const rr = scaledRadiusKm(state.objects[c.idx].altKm, exag) * kmToPx;
      const nx = headsKm[i3], ny = headsKm[i3+1], nz = headsKm[i3+2];
      const nd = Math.hypot(nx, ny, nz) || 1;
      const ring = c.sunrise ? PlaneRing.sunrise : PlaneRing.sunset;
      field.spawn(ring(nx/nd*rr, ny/nd*rr, nz/nd*rr, nx, ny, nz,
                       Math.min(p.width, p.height) * 0.016));
    }

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
      const pairs = conjWatch.update(
        findClosePairs(headsKm, state.objects.length, CONFIG.conjKm));
      for (const [i, j] of pairs.slice(0, 3)) {
        const a = state.objects[i], b = state.objects[j];
        const rr = scaledRadiusKm(a.altKm, exag) * kmToPx;
        const mid = new Float32Array(3);
        for (let k = 0; k < 3; k++)
          mid[k] = (headsKm[i*3+k] + headsKm[j*3+k]) / 2;
        const norm = Math.hypot(mid[0], mid[1], mid[2]) || 1;
        field.spawn(CageBurst.conjunction(
          mid[0]/norm*rr, mid[1]/norm*rr, mid[2]/norm*rr,
          Math.min(p.width, p.height) * 0.03));
        sonifier.ping(a.freqHz, b.freqHz);
        state.conjCount++;
      }
      if (pairs.length) refreshHud();
    }
    field.update(p.deltaTime / 1000);
    field.draw(p, state.folds);                    // polymorphic: rings + cages

    /* the measured solar wind, flowing down the sun line into the
       magnetopause it compresses. When the propagated series is available
       the conditions are replayed from it, so the boundary breathes on an
       hour of real 1-minute measurements rather than one static value. */
    const dSim = Math.max(0, Math.min(3600, (state.simT - lastSimT) / 1000));
    lastSimT = state.simT;

    /* DEMONSTRATION MODE (D). Every value below is invented; the HUD, the
       banner and the provenance footer all say so, and the measured values
       are never overwritten — they resume the moment it is switched off. */
    const demoC = state.paused ? null : demo.update(dSim);
    const live = sampleSeries(windSeries, state.simT);
    const conditions = demo.active && demoC ? { ...weather, ...demoC }
                     : live ? { ...weather, ...live } : weather;
    const auroraKp = demo.active && demoC ? demoC.kp : weather.kp;
    windSampleT = live && !demo.active ? live.tMs : 0;
    if (!state.paused && substorm.update(dSim, conditions) === 'onset')
      sonifier.crossing(220, true);              // breakup gets a voice

    /* flares: replay the X-ray series and flash the sun when one fires */
    const xr = demo.active && demoC ? { flux: demoC.flux }
      : sampleSeries(xraySeries && xraySeries.map(
          r => ({ tMs: r.tMs, flux: r.flux })), state.simT);
    if (xr) {
      currentClass = flareClass(xr.flux);
      const ev = state.paused ? null : flareWatch.update(xr.flux);
      if (ev) { lastFlare = ev; flareGlow = 1; sonifier.ping(1400, 1900); }
    }
    flareGlow = Math.max(0, flareGlow - p.deltaTime / 2600);
    wind.update(p.deltaTime / 1000, conditions, sun.eciDir, substorm.tailStretch);
    wind.draw(p, kmToPx, sun.eciDir);

    /* the armillary instrument, in the celestial frame (outside the
       earth-fixed rotation, since its rings represent celestial circles) */
    const arm = ensureArmillary(rOuterKm * kmToPx, R_EARTH_KM * kmToPx,
                                exag + '|' + p.width + '|' + p.height);

    /* OBSERVER MODE — the viewer's own sky. The tracking itself lives in
       sim/tracker.js so the high-fidelity build shares it rather than
       duplicating it; this root only wires positions in and geometry out. */
    const obs = state.observer;
    if (obs) {
      obs.zenithCore(sun.gmstDeg, zenCore);
      arm.observer.sync(zenCore);
      const res = tracker.update({
        observer: obs, objects: state.objects, headsKm, sun,
        sunAt: sunEphemeris, simT: state.simT,
        isDark: i => !!state.objects[i]._dark,
        positionAtKm: (o, tt, out) => {
          const fp = feed.propagate(o, tt);
          orbital3D(o.incl, o.raan, o.argp + fp.meanAnomaly,
                    scaledRadiusKm(o.altKm, 1), out, 0);
        },
      });
      aboveCount = res ? res.above : 0;
      visibleCount = res ? res.visible : 0;
      tracked = res && res.tracked ? res.tracked : null;
      rangeRate = res && res.tracked ? res.rangeRate : 0;
      passMin = res && res.tracked ? res.passMin : 0;
      if (tracked && res.isVisible) {
        const o = tracked.obj;
        const ph2 = feed.propagate(o, state.simT);
        orbital3D(o.incl, o.raan, o.argp + ph2.meanAnomaly,
                  scaledRadiusKm(o.altKm, exag) * kmToPx, sightSat, 0);
        const rE = R_EARTH_KM * kmToPx;
        arm.observer.sight.set(zenCore[0]*rE, zenCore[1]*rE, zenCore[2]*rE,
                               sightSat[0], sightSat[1], sightSat[2]);
      } else arm.observer.sight.clear();
      /* the pass Dopplers its own voice (focus tour keeps priority) */
      if (tracked && state.soundOn && state.focusStep === 0) {
        if (res.changed) sonifier.solo(tracked.obj.freqHz);
        sonifier.soloPitch(audibleDoppler(tracked.obj.freqHz, rangeRate));
      }
    } else if (arm.observer.active) {
      arm.observer.active = false; arm.observer.sight.clear(); tracked = null;
    }
    const md = Math.hypot(moonV[0], moonV[1], moonV[2]) || 1;
    arm.sync({ sunEci: sun.eciDir, gmstDeg: sun.gmstDeg,
               moonDir: [moonV[0] / md, moonV[1] / md, moonV[2] / md] });
    arm.draw(p, state.folds);
    p.blendMode(p.BLEND);

    /* fps meter (perf work should be measurable) */
    fpsAcc += p.frameRate(); fpsN++;
    if (fpsN >= 30) {
      setText('s-fps', Math.round(fpsAcc / fpsN) + ' fps');
      let dark = 0;
      for (const o of state.objects) if (o._dark) dark++;
      setText('s-ecl', state.objects.length
        ? Math.round(100 * dark / state.objects.length) + '%' : '\u2014');
      updateObserverHud();
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
    else if (k === 'o') {
      if (state.observer) { state.observer = null; refreshHud(); }
      else {
        const useFallback = () => {
          const f = CONFIG.fallbackObserver;
          state.observer = new Observer(f.lat, f.lon,
            { label: f.label, source: 'fallback' });
          refreshHud();
        };
        if (navigator.geolocation) {
          setText('s-obs', 'requesting\u2026');
          navigator.geolocation.getCurrentPosition(
            pos => { state.observer = new Observer(
                       pos.coords.latitude, pos.coords.longitude,
                       { label: 'your location', source: 'geolocation' });
                     refreshHud(); },
            useFallback, { timeout: 8000 });
        } else useFallback();
      }
    }
    else if (k === 'w') { aurora.visible = !aurora.visible; refreshHud(); }
    else if (k === 'r') { wind.visible = !wind.visible; refreshHud(); }
    else if (k === 'b') { magneto.visible = !magneto.visible; refreshHud(); }
    else if (k === 'd') { demo.toggle(); refreshHud(); }
    else if (k === 'a') { if (armillary) armillary.cycleMode(); refreshHud(); }
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
      if (state.soundOn) sonifier.start(currentVoices());
      else sonifier.stop();
      refreshHud();
    }
    else if (k === 'v') {
      state.view = state.view === 'orbit' ? 'system' : 'orbit';
      if (state.view === 'system') { sonifier.solo(null); }
      if (state.soundOn) sonifier.setVoices(currentVoices());
      const leg = $('legend'); if (leg) leg.style.display = state.view === 'system' ? 'block' : 'none';
      refreshHud();
    }
  };
});
