/*
  render/solids.js — three complex custom 3D objects for the p5 build, in
  the course OOP idiom: each extends Structure, composes a GeomStyle, and
  builds its own parametric mesh. None is a p5 primitive.

    RadiationBelt  toroid, swept about the tilted geomagnetic axis
    TrappedParticle 3D helix wrapped around a curved dipole field line
    FieldShell     surface of revolution from r = L cos^2(lambda)

  Geometry comes from sim/magnetosphere.js so the Three build renders the
  identical shapes. These live in the EARTH-FIXED frame, drawn inside the
  rotating group with the coastlines, because the magnetic field turns with
  the planet.
*/

'use strict';

import { Structure, GeomStyle } from './structures.js';
import {
  magneticAxis, magneticBasis, BELTS,
  torusWireframe, torusSegmentCount,
  fieldShellWireframe, shellSegmentCount,
  helixWireframe, R_EARTH_KM,
} from '../sim/magnetosphere.js';

const AXIS = magneticAxis(new Float64Array(3));
const BASIS = magneticBasis(AXIS, new Float64Array(6));

/* module-private: draw a segment buffer as one batched LINES shape */
function drawSegments(p, buf, count, kmToPx) {
  p.beginShape(p.LINES);
  for (let i = 0; i < count * 6; i += 3)
    p.vertex(buf[i] * kmToPx, buf[i + 1] * kmToPx, buf[i + 2] * kmToPx);
  p.endShape();
}

/* ---- 1. toroid ---------------------------------------------------------- */
export class RadiationBelt extends Structure {
  #buf; #n;
  constructor(spec, rings = 44, sides = 14) {
    super(0, 0, 0, Infinity, new GeomStyle(spec.rgb, 62, 1.0));
    this.spec = spec;
    this.#buf = new Float64Array(torusSegmentCount(rings, sides) * 6);
    this.#n = torusWireframe(AXIS, BASIS,
      spec.L * R_EARTH_KM, spec.halfWidth * R_EARTH_KM, rings, sides, this.#buf);
  }
  static inner() { return new RadiationBelt(BELTS[0]); }
  static outer() { return new RadiationBelt(BELTS[1]); }
  get segmentCount() { return this.#n; }
  draw(p, kmToPx) {
    this.style.apply(p);
    drawSegments(p, this.#buf, this.#n, kmToPx);
  }
}

/* ---- 2. helix ----------------------------------------------------------- */
export class TrappedParticle extends Structure {
  #buf; #scratch; #n = 0;
  constructor(L, theta, rgb = [190, 240, 255], samples = 200) {
    super(0, 0, 0, Infinity, new GeomStyle(rgb, 185, 1.3));
    this.L = L; this.theta = theta; this.samples = samples;
    this.phase = 0;
    this.#scratch = new Float64Array(samples * 3);
    this.#buf = new Float64Array(samples * 6);
  }
  /* the gyration advances; drift carries the particle around the Earth,
     which is the real motion of a trapped particle */
  update(dt) {
    this.phase += dt * 2.2;
    this.theta += dt * 0.06;
    this.#n = helixWireframe(AXIS, BASIS, this.L, this.theta,
      { samples: this.samples, turns: 24, gyroRe: 0.11, phase: this.phase },
      this.#scratch, this.#buf);
  }
  get segmentCount() { return this.#n; }
  draw(p, kmToPx) {
    if (!this.#n) return;
    this.style.apply(p);
    drawSegments(p, this.#buf, this.#n, kmToPx);
  }
}

/* ---- 3. surface of revolution ------------------------------------------- */
export class FieldShell extends Structure {
  #buf; #n;
  constructor(L, meridians = 12, steps = 26, rgb = [122, 154, 208]) {
    super(0, 0, 0, Infinity, new GeomStyle(rgb, 40, 0.9));
    this.L = L;
    this.#buf = new Float64Array(shellSegmentCount(meridians, steps) * 6);
    this.#n = fieldShellWireframe(AXIS, BASIS, L, meridians, steps, this.#buf);
  }
  get segmentCount() { return this.#n; }
  draw(p, kmToPx) {
    this.style.apply(p);
    drawSegments(p, this.#buf, this.#n, kmToPx);
  }
}

/* ---- the assembly: an array of objects driven polymorphically ---------- */
export class Magnetosphere {
  #parts;
  constructor() {
    this.belts = [RadiationBelt.inner(), RadiationBelt.outer()];
    this.shells = [new FieldShell(2.5), new FieldShell(6)];
    this.particles = [
      new TrappedParticle(4.5, 0.0),
      new TrappedParticle(2.4, 2.1, [255, 205, 150]),
      new TrappedParticle(6.0, 4.0, [170, 220, 255]),
    ];
    this.#parts = [...this.shells, ...this.belts, ...this.particles];
    this.visible = false;
  }
  get parts() { return this.#parts.length; }
  get segmentCount() {
    return this.#parts.reduce((n, q) => n + q.segmentCount, 0);
  }
  update(dt) { for (const q of this.#parts) q.update(dt); }
  draw(p, kmToPx) {
    if (!this.visible) return;
    for (const q of this.#parts) q.draw(p, kmToPx);   // polymorphic
  }
}
