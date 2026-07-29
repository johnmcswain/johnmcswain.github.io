/*
  three/main.js — the Three.js composition root: high-fidelity reading.
  ROLE OF THIS RENDERER: naturalistic — real bloom (UnrealBloomPass),
  soft attenuated sprites, damped camera, atmosphere. The p5 renderer
  keeps the kaleidoscope/mandala reading and the course sketch.js.
  Both are thin roots over the SAME core/, feeds/, sim/, audio.js —
  one tested physics, two aesthetics.

  Frame note: core math is y-down (north = -Y); three is y-up. Every
  write from core into three buffers negates y ("toThree").

  Controls: G group · T time · E altitude scale · F focus · Space · M sound
*/

'use strict';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import feed from '../feeds/celestrak.js';
import { fixtureObjects, RECORDED_AT } from '../feeds/fixture.js';
import { CONFIG, state, timeScale, altExag } from '../state.js';
import { R_EARTH_KM, scaledRadiusKm, orbital3D, inclHue, staleAlpha,
         trailSpanDeg } from '../core/math.js';
import { hsv } from '../render/color.js';
import { sunEphemeris, inShadow, sunDiscRadius } from '../sim/sun.js';
import { pickNotables } from '../sim/notables.js';
import { Sonifier } from '../audio.js';
import { EnsemblePoints, TrailLines } from './ensemble.js';
import { Earth, Sky, Sun } from './scenery.js';

const $ = id => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

const KM2PX = 0.045;                        // world scale: Earth radius ~287 units
const SEGS = 3;

class OrbitaThree {
  constructor(canvasParent) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true,
      powerPreference: 'high-performance' });
    /* VRAM discipline: DPR capped at 1.5 — bloom multiplies render-target
       cost, and DPR 2 + bloom is the classic context-loss recipe */
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    canvasParent.appendChild(this.renderer.domElement);

    /* a lost GPU context must not cascade into a browser tab reload:
       swallow the default, pause, resume on restore */
    this.contextLost = false;
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.contextLost = true;
      console.warn('ORBITA: WebGL context lost — pausing render loop');
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.warn('ORBITA: context restored — resuming');
      this.contextLost = false; this.lastReal = performance.now();
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d13);
    this.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 2e5);
    this.camera.position.set(0, 320, 900);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.06;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    /* bloom is inherently blurry — half-resolution targets look the same
       and cost a quarter of the memory/bandwidth */
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.9, 0.55, 0.62);
    this.composer.addPass(this.bloom);

    this.earth = new Earth(R_EARTH_KM * KM2PX);
    this.sky = new Sky(scaledRadiusKm(CONFIG.altMaxKm, 4) * KM2PX * 5.5);
    this.sun = new Sun(Math.max(4, sunDiscRadius(
      scaledRadiusKm(CONFIG.altMaxKm, 4) * KM2PX * 2.6)));
    this.scene.add(this.earth.group, this.sky.points,
                   this.sun.mesh, this.sun.light, this.sun.ambient);

    this.ensemble = new EnsemblePoints(CONFIG.maxRender);
    this.trails = new TrailLines(CONFIG.maxRender * SEGS);
    this.scene.add(this.ensemble.points, this.trails.lines);

    this.ghost = new THREE.LineLoop(
      (() => { const g = new THREE.BufferGeometry();
        g.setAttribute('position',
          new THREE.BufferAttribute(new Float32Array(96 * 3), 3));
        return g; })(),
      new THREE.LineBasicMaterial({ color: 0xdde4f2, transparent: true, opacity: 0.4 }));
    this.ghost.visible = false; this.ghost.frustumCulled = false;
    this.scene.add(this.ghost);

    this.sonifier = new Sonifier();
    this.notables = [];
    this.headsKm = new Float32Array(0);
    this.scratch = new Float32Array(3 * (SEGS + 1));
    this.rgb = new Float32Array(3);
    this.lastReal = performance.now();

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });
    addEventListener('keydown', e => this.onKey(e));
    this.loadGroup();
  }

  async loadGroup() {
    const group = CONFIG.groups[state.groupIdx];
    state.dataMode = 'loading'; this.hud();
    try {
      const objs = await feed.load(group);
      state.objects = objs.slice(0, CONFIG.maxRender);
      state.dataMode = 'live';
    } catch {
      state.objects = fixtureObjects();
      state.dataMode = 'fixture';
    }
    for (const o of state.objects) o._rgb = hsv(inclHue(o.incl), 0.72, 1);
    this.headsKm = new Float32Array(state.objects.length * 3);
    this.notables = pickNotables(state.objects);
    state.focusStep = 0; this.sonifier.solo(null); this.ghost.visible = false;
    this.hud();
  }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'g') { state.groupIdx = (state.groupIdx + 1) % CONFIG.groups.length; this.loadGroup(); }
    else if (k === 't') { state.timeIdx = (state.timeIdx + 1) % CONFIG.timeScales.length; this.hud(); }
    else if (k === 'e') { state.exagIdx = (state.exagIdx + 1) % CONFIG.altExags.length; this.hud(); }
    else if (k === ' ') { state.paused = !state.paused; e.preventDefault(); }
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
      this.sonifier.solo(on
        ? state.objects[this.notables[(state.focusStep - 1) % this.notables.length].idx].freqHz
        : null);
      this.hud();
    }
  }

  frame() {
    if (this.contextLost) { requestAnimationFrame(() => this.frame()); return; }
    const now = performance.now();
    if (!state.paused) state.simT += (now - this.lastReal) * timeScale();
    this.lastReal = now;

    const exag = altExag(), tScale = timeScale();
    const sun = sunEphemeris(state.simT);
    /* toThree: negate y of the core-frame direction */
    this.sun.setDirection(sun.eciDir[0], -sun.eciDir[1], sun.eciDir[2],
      scaledRadiusKm(CONFIG.altMaxKm, exag) * KM2PX * 2.6);
    this.earth.setGMST(sun.gmstDeg * Math.PI / 180);

    const objs = state.objects;
    let pv = 0, tv = 0;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const ph = feed.propagate(o, state.simT);
      const u = o.argp + ph.meanAnomaly;
      const rPx = scaledRadiusKm(o.altKm, exag) * KM2PX;
      const span = trailSpanDeg(o.meanMotion, tScale);
      for (let s = 0; s <= SEGS; s++)
        orbital3D(o.incl, o.raan, u - span * (s / SEGS), rPx, this.scratch, s * 3);
      orbital3D(o.incl, o.raan, u, scaledRadiusKm(o.altKm, 1), this.headsKm, i * 3);

      let a = staleAlpha(ph.staleDays) / 255;
      const dark = inShadow(this.headsKm[i*3], this.headsKm[i*3+1], this.headsKm[i*3+2], sun.eciDir);
      if (o._dark === undefined) o._dark = dark;
      else if (dark !== o._dark) {
        o._dark = dark;
        this.sonifier.crossing(o.freqHz, !dark);
      }
      if (dark) a *= 0.3;
      const [cr, cg, cb] = o._rgb;

      this.ensemble.pos[pv*3]   = this.scratch[0];
      this.ensemble.pos[pv*3+1] = -this.scratch[1];
      this.ensemble.pos[pv*3+2] = this.scratch[2];
      this.ensemble.col[pv*3]   = cr / 255 * a;
      this.ensemble.col[pv*3+1] = cg / 255 * a;
      this.ensemble.col[pv*3+2] = cb / 255 * a;
      this.ensemble.size[pv] = 6.5;
      pv++;

      for (let s = 0; s < SEGS; s++) {
        const fade = a * 0.55 * (1 - s / SEGS);
        for (const kk of [s, s + 1]) {
          this.trails.pos[tv*3]   = this.scratch[kk*3];
          this.trails.pos[tv*3+1] = -this.scratch[kk*3+1];
          this.trails.pos[tv*3+2] = this.scratch[kk*3+2];
          this.trails.col[tv*3]   = cr / 255 * fade;
          this.trails.col[tv*3+1] = cg / 255 * fade;
          this.trails.col[tv*3+2] = cb / 255 * fade;
          tv++;
        }
      }
    }
    this.ensemble.commit(pv);
    this.trails.commit(tv);

    /* focused ghost ring */
    if (state.focusStep > 0 && this.notables.length) {
      const o = objs[this.notables[(state.focusStep - 1) % this.notables.length].idx];
      const rF = scaledRadiusKm(o.altKm, exag) * KM2PX;
      const arr = this.ghost.geometry.attributes.position.array;
      const tmp = this.scratch;
      for (let s = 0; s < 96; s++) {
        orbital3D(o.incl, o.raan, s * 3.75, rF, tmp, 0);
        arr[s*3] = tmp[0]; arr[s*3+1] = -tmp[1]; arr[s*3+2] = tmp[2];
      }
      this.ghost.geometry.attributes.position.needsUpdate = true;
    }

    this.controls.update();
    this.composer.render();
    requestAnimationFrame(() => this.frame());
  }

  hud() {
    setText('s-src', state.dataMode === 'live' ? 'CelesTrak live'
      : state.dataMode === 'fixture' ? `recorded ${RECORDED_AT}` : 'loading\u2026');
    setText('s-group', CONFIG.groups[state.groupIdx]);
    setText('s-count', String(state.objects.length));
    setText('s-time', timeScale() + '\u00d7');
    setText('s-exag', altExag() === 1 ? 'true scale' : 'altitude \u00d7' + altExag());
    setText('s-snd', state.soundOn ? 'on' : 'off');
  }
}

const app = new OrbitaThree(document.body);
app.frame();
export { OrbitaThree };
