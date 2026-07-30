/*
  three/instrument.js — the armillary instrument for the high-fidelity
  build. Same rings, same meanings, same shared math (core/geom.js); the
  difference is that everything is baked into two BufferGeometries with
  per-vertex colour so bloom can make the brass actually glow.

    static  celestial cage: equatorial + ecliptic graduated rings, both
            colures, polar axis. Built once per scale.
    live    terminator (normal = sun), Greenwich hour ring (from GMST),
            sun and moon arms, observer horizon + local meridian, sight
            line. Rewritten each frame into a preallocated buffer.
*/

'use strict';

import * as THREE from 'three';
import { basisFromNormal, tickAngles, meridianNormal, localMeridianNormal,
         eclipticPole, ringPoint } from '../core/geom.js';

const TAU = Math.PI * 2;
const BRASS      = [0.82, 0.66, 0.40];
const BRASS_DIM  = [0.46, 0.37, 0.24];
const ECLIPTIC   = [0.86, 0.74, 0.46];
const TERMINATOR = [0.36, 0.62, 0.98];
const HOUR       = [0.90, 0.82, 0.60];
const SUN_ARM    = [1.00, 0.86, 0.52];
const MOON_ARM   = [0.74, 0.76, 0.82];
const HORIZON    = [0.55, 0.86, 0.58];
const LOCAL_MER  = [0.38, 0.62, 0.42];
const SIGHT      = [1.00, 0.96, 0.72];

function lineMaterial() {
  return new THREE.LineBasicMaterial({ vertexColors: true, transparent: true,
    opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
}

/* a growable segment accumulator: push(a, b, colour) */
class Segments {
  constructor(capacity) {
    this.pos = new Float32Array(capacity * 6);
    this.col = new Float32Array(capacity * 6);
    this.n = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.lines = new THREE.LineSegments(this.geo, lineMaterial());
    this.lines.frustumCulled = false;
  }
  reset() { this.n = 0; }
  push(ax, ay, az, bx, by, bz, c, gain = 1) {
    if (this.n + 6 > this.pos.length) return;
    const p = this.pos, q = this.col, i = this.n;
    p[i]=ax; p[i+1]=ay; p[i+2]=az; p[i+3]=bx; p[i+4]=by; p[i+5]=bz;
    for (const o of [i, i + 3]) {
      q[o] = c[0]*gain; q[o+1] = c[1]*gain; q[o+2] = c[2]*gain;
    }
    this.n += 6;
  }
  /* a closed ring on the plane with the given normal */
  ring(nx, ny, nz, radius, segs, c, gain = 1) {
    const b = basisFromNormal(nx, ny, nz, new Float64Array(6));
    const a = new Float64Array(3), d = new Float64Array(3);
    for (let i = 0; i < segs; i++) {
      ringPoint(b, i / segs * TAU, radius, a);
      ringPoint(b, (i + 1) / segs * TAU, radius, d);
      this.push(a[0], a[1], a[2], d[0], d[1], d[2], c, gain);
    }
    return b;
  }
  /* graduation ticks pointing inward from a ring */
  ticks(basis, radius, major, minorPer, frac, c) {
    const a = new Float64Array(3);
    for (const { theta, major: isMajor } of tickAngles(major, minorPer)) {
      ringPoint(basis, theta, radius, a);
      const k = 1 - (isMajor ? frac : frac * 0.5);
      this.push(a[0], a[1], a[2], a[0]*k, a[1]*k, a[2]*k,
                isMajor ? c : BRASS_DIM, isMajor ? 1 : 0.8);
    }
  }
  commit() {
    this.geo.setDrawRange(0, this.n / 3);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/* a low-poly marker: the sphereDetail(4) reading from the course examples */
function marker(radius, hex, detail = 1) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, detail),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
}

export class ArmillaryThree {
  #mode = 1;                                  // 0 off, 1 cage, 2 full
  constructor(radius, earthRadius) {
    this.radius = radius; this.earthRadius = earthRadius;
    this.group = new THREE.Group();
    this.static = new Segments(1200);
    this.live = new Segments(1400);
    this.group.add(this.static.lines, this.live.lines);

    /* pole caps mark the celestial poles; arm tips mark what each arm points at */
    const capR = radius * 0.014;
    this.caps = [marker(capR, 0xdec48c), marker(capR, 0xdec48c)];
    const L = radius * 1.06;
    this.caps[0].position.set(0, L, 0); this.caps[1].position.set(0, -L, 0);
    this.sunTip = marker(earthRadius * 0.028, 0xffdc85);
    this.moonTip = marker(radius * 0.012, 0xbdc2ce);
    this.zenithTip = marker(radius * 0.012, 0x9fdca6);
    this.tips = [this.sunTip, this.moonTip, this.zenithTip];
    this.group.add(...this.caps, ...this.tips);

    this.#buildCage();
    this.observerActive = false;
    this.sight = null;                        // [ax,ay,az,bx,by,bz] or null
  }

  get mode() { return this.#mode; }
  get label() { return ['off', 'cage', 'full'][this.#mode]; }
  cycleMode() { this.#mode = (this.#mode + 1) % 3; return this.#mode; }

  #buildCage() {
    const R = this.radius, s = this.static;
    s.reset();
    const eq = s.ring(0, -1, 0, R, 144, BRASS);
    s.ticks(eq, R, 24, 4, 0.045, BRASS);                 // 24 h of right ascension
    const ep = eclipticPole(new Float64Array(3));
    const ec = s.ring(ep[0], ep[1], ep[2], R * 0.985, 144, ECLIPTIC);
    s.ticks(ec, R * 0.985, 12, 3, 0.055, ECLIPTIC);      // 12 signs
    s.ring(0, 0, 1, R * 0.97, 120, BRASS_DIM);           // equinoctial colure
    s.ring(1, 0, 0, R * 0.97, 120, BRASS_DIM);           // solstitial colure
    const L = R * 1.06;                                   // polar axis
    s.push(0, -L, 0, 0, L, 0, BRASS);
    s.commit();
  }

  /* live readings, rebuilt each frame */
  sync({ sunEci, gmstDeg, moonDir, zenithCore }) {
    const R = this.radius, rE = this.earthRadius, l = this.live;
    l.reset();
    if (this.#mode === 2) {
      l.ring(sunEci[0], sunEci[1], sunEci[2], rE * 1.004, 128, TERMINATOR);
      const mn = meridianNormal(gmstDeg, new Float64Array(3));
      l.ring(mn[0], mn[1], mn[2], R * 0.94, 120, HOUR, 0.8);
      const sa = rE * 1.16;
      l.push(0, 0, 0, sunEci[0]*sa, sunEci[1]*sa, sunEci[2]*sa, SUN_ARM);
      this.sunTip.position.set(sunEci[0]*sa, sunEci[1]*sa, sunEci[2]*sa);
      this.sunTip.visible = true;
      if (moonDir) {
        const ma = R * 0.9;
        l.push(0, 0, 0, moonDir[0]*ma, moonDir[1]*ma, moonDir[2]*ma, MOON_ARM);
        this.moonTip.position.set(moonDir[0]*ma, moonDir[1]*ma, moonDir[2]*ma);
        this.moonTip.visible = true;
      } else this.moonTip.visible = false;
      if (this.observerActive && zenithCore) {
        l.ring(zenithCore[0], zenithCore[1], zenithCore[2], R * 0.99, 140, HORIZON);
        const lm = localMeridianNormal(zenithCore[0], zenithCore[1], zenithCore[2],
                                       new Float64Array(3));
        l.ring(lm[0], lm[1], lm[2], R * 0.965, 120, LOCAL_MER, 0.85);
        const za = rE * 1.22;
        l.push(0, 0, 0, zenithCore[0]*za, zenithCore[1]*za, zenithCore[2]*za, LOCAL_MER);
        this.zenithTip.position.set(zenithCore[0]*za, zenithCore[1]*za, zenithCore[2]*za);
        this.zenithTip.visible = true;
        if (this.sight)
          l.push(this.sight[0], this.sight[1], this.sight[2],
                 this.sight[3], this.sight[4], this.sight[5], SIGHT);
      }
    }
    if (this.#mode !== 2) for (const t of this.tips) t.visible = false;
    else if (!this.observerActive) this.zenithTip.visible = false;
    l.commit();
    this.static.lines.visible = this.#mode > 0;
    this.live.lines.visible = this.#mode === 2;
    for (const c of this.caps) c.visible = this.#mode > 0;
  }
}
