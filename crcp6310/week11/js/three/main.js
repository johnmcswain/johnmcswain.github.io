/*
  three/main.js — the Three.js composition root: high-fidelity reading.
  Naturalistic where the p5 build is graphic: real bloom, soft attenuated
  sprites, damped camera, atmosphere. Both roots are thin wrappers over the
  SAME core/, feeds/, sim/, audio.js — one tested physics, two aesthetics.

  PARITY: everything below the renderer boundary is shared, including the
  observer's pass tracking (sim/tracker.js), the aurora model
  (sim/aurora.js), the ground-track buffer (sim/groundtrack.js) and the
  orientation math (core/geom.js). Only geometry is written twice.
  Deliberately NOT ported: the kaleidoscope folds and the OOP event
  structures, which belong to the mandala reading, and the system view.

  Frame note: core math is y-down (north = -Y); three is y-up. Every write
  from core into three negates y.

  Controls: drag/scroll camera · O observer · A instrument · W aurora
            F focus · G group · T time · E scale · Space pause · M sound · S save
*/

'use strict';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import feed from '../feeds/celestrak.js';
import { fixtureObjects, RECORDED_AT } from '../feeds/fixture.js';
import swpc, { QUIET_BASELINE } from '../feeds/spaceweather.js';
import { CONFIG, state, timeScale, altExag } from '../state.js';
import { R_EARTH_KM, scaledRadiusKm, orbital3D, inclHue, staleAlpha,
         trailSpanDeg } from '../core/math.js';
import { GeomDynamics } from '../core/dynamics.js';
import { hsv } from '../render/color.js';
import { sunEphemeris, inShadow, sunDiscRadius } from '../sim/sun.js';
import { pickNotables } from '../sim/notables.js';
import { moonState, eclipticToP5 } from '../sim/planets.js';
import { Observer, compassPoint, audibleDoppler, MIN_ELEV_DEG } from '../sim/observer.js';
import { SkyTracker } from '../sim/tracker.js';
import { GroundTrack, eciToEarthFixed } from '../sim/groundtrack.js';
import { Sonifier } from '../audio.js';
import { EnsemblePoints, TrailLines } from './ensemble.js';
import { Earth, Sky, Sun } from './scenery.js';
import { AuroraPoints } from './aurora.js';
import { ArmillaryThree } from './instrument.js';

const $ = id => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

const KM2U = 0.045;                       // world units per km
const SEGS = 3;
const GALLERY_IDLE_MS = 20000;

class OrbitaThree {
  constructor(parent) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    parent.appendChild(this.renderer.domElement);

    this.contextLost = false;
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.contextLost = true;
      console.warn('ORBITA: WebGL context lost — pausing render loop');
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false; this.lastReal = performance.now();
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d13);
    this.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 2e5);
    this.camera.position.set(0, 320, 900);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotateSpeed = 0.28;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.9, 0.55, 0.62);
    this.composer.addPass(this.bloom);

    const rE = R_EARTH_KM * KM2U;
    this.earth = new Earth(rE);
    this.sky = new Sky(scaledRadiusKm(CONFIG.altMaxKm, 4) * KM2U * 5.5);
    this.sun = new Sun(Math.max(4, sunDiscRadius(
      scaledRadiusKm(CONFIG.altMaxKm, 4) * KM2U * 2.6)));
    this.scene.add(this.earth.group, this.sky.points,
                   this.sun.mesh, this.sun.light, this.sun.ambient);

    /* aurora rides the earth-fixed group so it inherits Earth's rotation */
    this.aurora = new AuroraPoints(rE, KM2U);
    this.earth.group.add(this.aurora.points);

    /* the Moon, at its true distance — scroll out to find it */
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(2, 1737 * KM2U), 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xc8c8cd }));
    this.scene.add(this.moon);

    this.ensemble = new EnsemblePoints(CONFIG.maxRender);
    this.trails = new TrailLines(CONFIG.maxRender * SEGS);
    this.scene.add(this.ensemble.points, this.trails.lines);

    this.instrument = null; this.instrumentSig = '';
    this.ghost = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(96 * 3), 3)),
      new THREE.LineBasicMaterial({ color: 0xdde4f2, transparent: true, opacity: 0.45 }));
    this.ghost.visible = false; this.ghost.frustumCulled = false;
    this.scene.add(this.ghost);

    /* ground track, in the earth-fixed group like the aurora */
    this.track = new GroundTrack(420);
    this.trackLine = new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(420 * 3), 3)),
      new THREE.LineBasicMaterial({ color: 0xfff5dc, transparent: true,
        opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.trackLine.frustumCulled = false;
    this.earth.group.add(this.trackLine);

    this.sonifier = new Sonifier();
    this.tracker = new SkyTracker();
    this.weather = { ...QUIET_BASELINE, liveFields: 0, totalFields: 6 };
    this.notables = [];
    this.headsKm = new Float32Array(0);
    this.scratch = new Float64Array(3 * (SEGS + 1));
    this.zen = new Float64Array(3);
    this.ef = new Float64Array(3);
    this.sightScratch = new Float64Array(3);
    this.tracked = null; this.rangeRate = 0; this.passMin = 0;
    this.above = 0; this.visibleCount = 0;
    this.idleMs = 0;
    this.lastReal = performance.now();
    this.hudFrame = 0;

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });
    addEventListener('keydown', e => this.onKey(e));
    for (const ev of ['pointerdown', 'pointermove', 'wheel'])
      addEventListener(ev, () => { this.idleMs = 0; });

    this.loadGroup();
    this.loadWeather();
    setInterval(() => this.loadWeather(), swpc.refreshMs);
  }

  async loadWeather() {
    try { this.weather = await swpc.load(); } catch { /* quiet baseline */ }
    this.hud();
  }

  async loadGroup() {
    const group = CONFIG.groups[state.groupIdx];
    state.dataMode = 'loading'; this.hud();
    try {
      state.objects = (await feed.load(group)).slice(0, CONFIG.maxRender);
      state.dataMode = 'live';
    } catch {
      state.objects = fixtureObjects();
      state.dataMode = 'fixture';
    }
    for (const o of state.objects) o._rgb = hsv(inclHue(o.incl), 0.72, 1);
    this.headsKm = new Float32Array(state.objects.length * 3);
    this.notables = pickNotables(state.objects);
    state.focusStep = 0; this.sonifier.solo(null);
    this.ghost.visible = false; this.track.reset();
    this.hud();
  }

  ensureInstrument(exag) {
    const sig = String(exag);
    if (this.instrumentSig === sig) return this.instrument;
    const keep = this.instrument ? this.instrument.mode : 1;
    if (this.instrument) this.scene.remove(this.instrument.group);
    const R = scaledRadiusKm(CONFIG.altMaxKm, exag) * KM2U * 1.06;
    this.instrument = new ArmillaryThree(R, R_EARTH_KM * KM2U);
    while (this.instrument.mode !== keep) this.instrument.cycleMode();
    this.scene.add(this.instrument.group);
    this.instrumentSig = sig;
    return this.instrument;
  }

  onKey(e) {
    this.idleMs = 0;
    const k = e.key.toLowerCase();
    if (k === 'g') { state.groupIdx = (state.groupIdx + 1) % CONFIG.groups.length; this.loadGroup(); }
    else if (k === 't') { state.timeIdx = (state.timeIdx + 1) % CONFIG.timeScales.length; this.hud(); }
    else if (k === 'e') { state.exagIdx = (state.exagIdx + 1) % CONFIG.altExags.length; this.hud(); }
    else if (k === 'a') { if (this.instrument) this.instrument.cycleMode(); this.hud(); }
    else if (k === 'w') { this.aurora.visible = !this.aurora.visible; this.hud(); }
    else if (k === ' ') { state.paused = !state.paused; e.preventDefault(); }
    else if (k === 's') {
      const a = document.createElement('a');
      a.href = this.renderer.domElement.toDataURL('image/png');
      a.download = 'orbita-hf.png'; a.click();
    }
    else if (k === 'o') {
      if (state.observer) { state.observer = null; this.track.reset(); this.hud(); }
      else {
        const fallback = () => {
          const f = CONFIG.fallbackObserver;
          state.observer = new Observer(f.lat, f.lon, { label: f.label, source: 'fallback' });
          this.hud();
        };
        if (navigator.geolocation) {
          setText('s-obs', 'requesting\u2026');
          navigator.geolocation.getCurrentPosition(
            pos => { state.observer = new Observer(pos.coords.latitude,
                       pos.coords.longitude,
                       { label: 'your location', source: 'geolocation' });
                     this.hud(); },
            fallback, { timeout: 8000 });
        } else fallback();
      }
    }
    else if (k === 'm') {
      state.soundOn = !state.soundOn;
      if (state.soundOn) this.sonifier.start(
        state.objects.slice(0, 12).map(o => ({ hz: o.freqHz })));
      else this.sonifier.stop();
      this.hud();
    }
    else if (k === 'f') {
      state.focusStep = (state.focusStep + 1) % (this.notables.length + 1);
      const on = state.focusStep > 0 && this.notables.length;
      this.ghost.visible = !!on;
      this.track.reset();
      this.sonifier.solo(on
        ? state.objects[this.notables[(state.focusStep - 1) % this.notables.length].idx].freqHz
        : null);
      this.hud();
    }
  }

  frame() {
    requestAnimationFrame(() => this.frame());
    if (this.contextLost) return;
    const now = performance.now(), dtReal = now - this.lastReal;
    if (!state.paused) state.simT += dtReal * timeScale();
    this.lastReal = now;

    /* gallery mode: the piece performs itself when left alone */
    this.idleMs += dtReal;
    this.controls.autoRotate = this.idleMs > GALLERY_IDLE_MS && !state.reduceMotion;

    const exag = altExag(), tScale = timeScale();
    const sun = sunEphemeris(state.simT);
    this.sun.setDirection(sun.eciDir[0], -sun.eciDir[1], sun.eciDir[2],
      scaledRadiusKm(CONFIG.altMaxKm, exag) * KM2U * 2.6);
    this.earth.setGMST(sun.gmstDeg * Math.PI / 180);
    this.aurora.update(this.weather.kp, sun.subsolarLonDeg);

    /* the Moon, geocentric, true distance (core frame -> three: negate y) */
    const mo = moonState(state.simT);
    const la = mo.latDeg * Math.PI / 180, lo = mo.lonDeg * Math.PI / 180;
    const mR = mo.distKm * KM2U;
    eclipticToP5(Math.cos(la) * Math.cos(lo) * mR, Math.cos(la) * Math.sin(lo) * mR,
                 Math.sin(la) * mR, this.scratch);
    this.moon.position.set(this.scratch[0], -this.scratch[1], this.scratch[2]);

    const objs = state.objects;
    let pv = 0, tv = 0;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const ph = feed.propagate(o, state.simT);
      const u = o.argp + ph.meanAnomaly;
      const rU = scaledRadiusKm(o.altKm, exag) * KM2U;
      const span = trailSpanDeg(o.meanMotion, tScale);
      for (let s = 0; s <= SEGS; s++)
        orbital3D(o.incl, o.raan, u - span * (s / SEGS), rU, this.scratch, s * 3);
      orbital3D(o.incl, o.raan, u, scaledRadiusKm(o.altKm, 1), this.headsKm, i * 3);

      let a = staleAlpha(ph.staleDays) / 255;
      const dark = inShadow(this.headsKm[i*3], this.headsKm[i*3+1],
                            this.headsKm[i*3+2], sun.eciDir);
      if (o._dark === undefined) o._dark = dark;
      else if (dark !== o._dark) { o._dark = dark; this.sonifier.crossing(o.freqHz, !dark); }
      if (dark) a *= 0.3;
      const [cr, cg, cb] = o._rgb;

      this.ensemble.pos[pv*3] = this.scratch[0];
      this.ensemble.pos[pv*3+1] = -this.scratch[1];
      this.ensemble.pos[pv*3+2] = this.scratch[2];
      this.ensemble.col[pv*3] = cr / 255 * a;
      this.ensemble.col[pv*3+1] = cg / 255 * a;
      this.ensemble.col[pv*3+2] = cb / 255 * a;
      this.ensemble.size[pv] = 6.5;
      pv++;
      for (let s = 0; s < SEGS; s++) {
        const fade = a * 0.55 * (1 - s / SEGS);
        for (const kk of [s, s + 1]) {
          this.trails.pos[tv*3] = this.scratch[kk*3];
          this.trails.pos[tv*3+1] = -this.scratch[kk*3+1];
          this.trails.pos[tv*3+2] = this.scratch[kk*3+2];
          this.trails.col[tv*3] = cr / 255 * fade;
          this.trails.col[tv*3+1] = cg / 255 * fade;
          this.trails.col[tv*3+2] = cb / 255 * fade;
          tv++;
        }
      }
    }
    this.ensemble.commit(pv);
    this.trails.commit(tv);

    /* focus: ghost orbit ring + ground track */
    const focusIdx = state.focusStep > 0 && this.notables.length
      ? this.notables[(state.focusStep - 1) % this.notables.length].idx : -1;
    if (focusIdx >= 0) {
      const o = objs[focusIdx];
      const rF = scaledRadiusKm(o.altKm, exag) * KM2U;
      const arr = this.ghost.geometry.attributes.position.array;
      for (let s = 0; s < 96; s++) {
        orbital3D(o.incl, o.raan, s * 3.75, rF, this.scratch, 0);
        arr[s*3] = this.scratch[0]; arr[s*3+1] = -this.scratch[1];
        arr[s*3+2] = this.scratch[2];
      }
      this.ghost.geometry.attributes.position.needsUpdate = true;
      if (!state.paused) {
        eciToEarthFixed(this.headsKm[focusIdx*3], this.headsKm[focusIdx*3+1],
                        this.headsKm[focusIdx*3+2], sun.gmstDeg * Math.PI / 180, this.ef);
        this.track.push(this.ef[0], this.ef[1], this.ef[2]);
      }
      const tArr = this.trackLine.geometry.attributes.position.array;
      const rT = R_EARTH_KM * KM2U * 1.006;
      let n = 0;
      this.track.each((x, y, z) => {
        tArr[n*3] = x * rT; tArr[n*3+1] = -y * rT; tArr[n*3+2] = z * rT; n++;
      });
      this.trackLine.geometry.setDrawRange(0, n);
      this.trackLine.geometry.attributes.position.needsUpdate = true;
      this.trackLine.visible = n > 1;
    } else this.trackLine.visible = false;

    /* observer mode, via the shared tracker */
    const inst = this.ensureInstrument(exag);
    const obs = state.observer;
    if (obs) {
      obs.zenithCore(sun.gmstDeg, this.zen);
      inst.observerActive = true;
      const res = this.tracker.update({
        observer: obs, objects: objs, headsKm: this.headsKm, sun,
        sunAt: sunEphemeris, simT: state.simT,
        isDark: i => !!objs[i]._dark,
        positionAtKm: (o, tt, out) => {
          const fp = feed.propagate(o, tt);
          orbital3D(o.incl, o.raan, o.argp + fp.meanAnomaly,
                    scaledRadiusKm(o.altKm, 1), out, 0);
        },
      });
      this.above = res ? res.above : 0;
      this.visibleCount = res ? res.visible : 0;
      this.tracked = res && res.tracked ? res.tracked : null;
      this.rangeRate = this.tracked ? res.rangeRate : 0;
      this.passMin = this.tracked ? res.passMin : 0;
      if (this.tracked && res.isVisible) {
        const o = this.tracked.obj;
        const fp = feed.propagate(o, state.simT);
        orbital3D(o.incl, o.raan, o.argp + fp.meanAnomaly,
                  scaledRadiusKm(o.altKm, exag) * KM2U, this.sightScratch, 0);
        const rEo = R_EARTH_KM * KM2U;
        inst.sight = [this.zen[0]*rEo, -this.zen[1]*rEo, this.zen[2]*rEo,
                      this.sightScratch[0], -this.sightScratch[1], this.sightScratch[2]];
      } else inst.sight = null;
      if (this.tracked && state.soundOn && state.focusStep === 0) {
        if (res.changed) this.sonifier.solo(this.tracked.obj.freqHz);
        this.sonifier.soloPitch(audibleDoppler(this.tracked.obj.freqHz, this.rangeRate));
      }
    } else { inst.observerActive = false; inst.sight = null; this.tracked = null; }

    /* the instrument's live readings: core frame -> three (negate y) */
    inst.sync({
      sunEci: [sun.eciDir[0], -sun.eciDir[1], sun.eciDir[2]],
      gmstDeg: sun.gmstDeg,
      moonDir: [this.moon.position.x, this.moon.position.y, this.moon.position.z]
        .map((v, _, arr) => v / (Math.hypot(...arr) || 1)),
      zenithCore: [this.zen[0], -this.zen[1], this.zen[2]],
    });

    this.controls.update();
    this.composer.render();
    if (this.hudFrame++ % 20 === 0) this.hud();
  }

  hud() {
    setText('s-src', state.dataMode === 'live' ? 'CelesTrak live'
      : state.dataMode === 'fixture' ? `recorded ${RECORDED_AT}` : 'loading\u2026');
    setText('s-group', CONFIG.groups[state.groupIdx]);
    setText('s-count', String(state.objects.length));
    setText('s-time', timeScale() + '\u00d7');
    setText('s-exag', altExag() === 1 ? 'true scale' : 'altitude \u00d7' + altExag());
    setText('s-snd', state.soundOn ? 'on' : 'off');
    setText('s-inst', this.instrument ? this.instrument.label : 'off');
    const w = this.weather;
    setText('s-kp', 'Kp ' + w.kp.toFixed(1) + ' \u00b7 G' + w.scaleG + ' \u00b7 '
      + w.liveFields + '/' + w.totalFields + ' live (' + w.source + ')');
    setText('s-sw', Math.round(w.windSpeedKmS) + ' km/s \u00b7 Bz '
      + w.bzNt.toFixed(1) + ' nT \u00b7 F10.7 ' + Math.round(w.f107));
    setText('s-aur', this.aurora.visible
      ? 'oval from live Kp \u00b7 ' + this.aurora.activeCount + ' cells' : 'hidden');
    setText('s-obs', state.observer
      ? state.observer.label + ' (' + state.observer.source + ')' : 'off');
    const banner = $('lookup');
    if (!state.observer || !this.tracked) {
      setText('s-pass', state.observer ? 'nothing above ' + MIN_ELEV_DEG + '\u00b0' : '\u2014');
      setText('s-dop', '\u2014');
      if (banner) banner.style.display = 'none';
    } else {
      const t = this.tracked;
      setText('s-pass', t.name + ' \u00b7 ' + Math.round(t.elevDeg) + '\u00b0 '
        + compassPoint(t.azDeg) + ' \u00b7 ' + Math.round(t.rangeKm) + ' km \u00b7 '
        + t.vis + ' (' + this.visibleCount + '/' + this.above + ' up)');
      setText('s-dop', (this.rangeRate >= 0 ? '+' : '') + this.rangeRate.toFixed(2)
        + ' km/s \u00b7 shift '
        + ((audibleDoppler(1000, this.rangeRate) / 1000 - 1) * 100).toFixed(1)
        + '% (exaggerated \u00d72000)');
      if (banner) {
        if (t.vis === 'visible') {
          banner.textContent = 'GO OUTSIDE \u00b7 ' + t.name + ' is '
            + Math.round(t.elevDeg) + '\u00b0 above your ' + compassPoint(t.azDeg)
            + ' horizon, sunlit \u00b7 '
            + (this.passMin >= 20 ? '20+' : '~' + this.passMin.toFixed(1)) + ' min left';
          banner.style.display = 'block';
        } else banner.style.display = 'none';
      }
    }
    if (state.focusStep > 0 && this.notables.length) {
      const n = this.notables[(state.focusStep - 1) % this.notables.length];
      const o = state.objects[n.idx];
      setText('s-focus', n.key + ' \u00b7 ' + o.name);
      const gd = GeomDynamics.fromOrbit(o, w.f107);
      setText('s-fdyn', Math.round(o.altKm) + ' km \u00b7 ' + gd.spd.toFixed(2)
        + ' km/s \u00b7 node ' + gd.friction.toFixed(2) + '\u00b0/day \u00b7 drag '
        + gd.damping.toExponential(1) + ' rel');
    } else { setText('s-focus', 'off'); setText('s-fdyn', '\u2014'); }
  }
}

const app = new OrbitaThree(document.body);
app.frame();
export { OrbitaThree };
