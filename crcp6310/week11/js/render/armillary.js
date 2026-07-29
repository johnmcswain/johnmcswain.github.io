/*
  render/armillary.js — the armillary instrument: a set of 2D structures
  (great-circle rings, graduated scales) arranged in 3D around the globe,
  assembled with 3D structures (polar axis, pole caps, pointer arms) into
  one larger composition. An armillary sphere is historically exactly this
  — a machine made of rings — which is why it is the right answer here
  rather than a decoration bolted onto the piece.

  THE OOP MAP (assignment vocabulary -> this file)
    encapsulation  GeomStyle owns appearance; Armillary hides #parts/#mode
    composition    Gimbal HAS-A parts + GeomDynamics; Armillary HAS-A Dim3
                   (the course's global collision box, injected instead)
    inheritance    Ring extends Structure; GraduatedRing extends Ring
                   (two levels); Axis and Pointer extend Structure
    polymorphism   Gimbal iterates part.draw(p) knowing no subclass
    overloading    static factories stand in for Processing's overloaded
                   constructors (Ring.equatorial, .ecliptic, .colure, ...)
    array of objects  Gimbal#parts, Armillary#gimbals

  EVERY RING MEANS SOMETHING. Fixed in the celestial frame: equatorial
  (graduated in 24h of right ascension), ecliptic (12 signs, tilted by the
  true obliquity), and the two colures. Driven by live data: the terminator
  great circle (normal = the sun direction, so it IS the day/night
  boundary), the Greenwich hour ring (set from GMST), and pointer arms to
  the subsolar point and the Moon. Nothing here is ornamental geometry.

  Frame: core frame is y-down with north = -Y, matching core/math.js.
*/

'use strict';

import { Structure, GeomStyle, basisFromNormal } from './structures.js';
import { eclipticToP5 } from '../sim/planets.js';
import { GeomDynamics } from '../core/dynamics.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
export const OBLIQUITY_DEG = 23.43928;
/* Earth's rotation: one sidereal day = 86164.0905 s */
export const SIDEREAL_RAD_PER_SEC = TAU / 86164.0905;

/* brass palette — an instrument, not a hologram */
export const BRASS = {
  major:  new GeomStyle([206, 168, 104], 190, 1.5),
  minor:  new GeomStyle([176, 140,  86], 120, 1.0),
  ecl:    new GeomStyle([214, 186, 120], 170, 1.4),
  colure: new GeomStyle([150, 132,  96],  90, 1.0),
  axis:   new GeomStyle([222, 196, 140], 205, 1.8),
  term:   new GeomStyle([120, 170, 245], 200, 1.6),
  hour:   new GeomStyle([236, 214, 160], 150, 1.2),
  sunArm: new GeomStyle([255, 226, 150], 230, 2.0),
  moonArm:new GeomStyle([198, 202, 214], 180, 1.4),
  horizon:new GeomStyle([176, 214, 176], 165, 1.6),
  localMer:new GeomStyle([146, 186, 150], 105, 1.1),
  zenith: new GeomStyle([206, 236, 206], 175, 1.3),
  sight:  new GeomStyle([255, 244, 205], 225, 1.7),
};

/* --- pure geometry, exported for the headless suite ---------------------- */

/* tick angles around a circle: major divisions with minor subdivisions */
export function tickAngles(major, minorPerMajor) {
  const out = [];
  for (let i = 0; i < major; i++) {
    out.push({ theta: i / major * TAU, major: true });
    for (let j = 1; j < minorPerMajor; j++)
      out.push({ theta: (i + j / minorPerMajor) / major * TAU, major: false });
  }
  return out;
}

/* the Greenwich meridian plane's normal, in the celestial frame, at GMST */
export function meridianNormal(gmstDeg, out) {
  const g = gmstDeg * D2R;
  out[0] = -Math.sin(g); out[1] = 0; out[2] = Math.cos(g);
  return out;
}

/* the ecliptic pole in the core frame (tilted from the celestial pole) */
export function eclipticPole(out) {
  return eclipticToP5(0, 0, 1, out);
}

/* --- 2D structure: a great-circle ring on an oriented plane ------------- */

export class Ring extends Structure {
  constructor(nx, ny, nz, radius, segments, style) {
    super(0, 0, 0, Infinity, style);       // life Infinity => persistent
    this.radius = radius;
    this.segments = segments;
    this.basis = basisFromNormal(nx, ny, nz, new Float32Array(6));
  }
  /* factories in place of Processing's overloaded constructors */
  static equatorial(radius) {              // normal = celestial north (-Y)
    return new GraduatedRing(0, -1, 0, radius, 192, BRASS.major, 24, 4, 0.045);
  }
  static ecliptic(radius) {
    const n = eclipticPole(new Float32Array(3));
    return new GraduatedRing(n[0], n[1], n[2], radius, 192, BRASS.ecl, 12, 3, 0.055);
  }
  static colure(kind, radius) {            // great circles through the poles
    return kind === 'equinoctial'
      ? new Ring(0, 0, 1, radius, 160, BRASS.colure)
      : new Ring(1, 0, 0, radius, 160, BRASS.colure);
  }
  static terminator(radius) { return new Ring(1, 0, 0, radius, 160, BRASS.term); }
  static hour(radius)       { return new Ring(0, 0, 1, radius, 160, BRASS.hour); }

  setNormal(nx, ny, nz) { basisFromNormal(nx, ny, nz, this.basis); }

  vertexAt(theta, out, o = 0) {
    const [ux, uy, uz, vx, vy, vz] = this.basis;
    const c = Math.cos(theta) * this.radius, s = Math.sin(theta) * this.radius;
    out[o] = ux * c + vx * s; out[o + 1] = uy * c + vy * s; out[o + 2] = uz * c + vz * s;
    return out;
  }

  draw(p) {
    this.style.apply(p);
    p.beginShape();
    const t = new Float32Array(3);
    for (let i = 0; i < this.segments; i++) {
      this.vertexAt(i / this.segments * TAU, t);
      p.vertex(t[0], t[1], t[2]);
    }
    p.endShape(p.CLOSE);
  }
}

/* --- 2D structure, second inheritance level: ring + graduated scale ----- */

export class GraduatedRing extends Ring {
  constructor(nx, ny, nz, radius, segments, style, major, minorPer, tickFrac) {
    super(nx, ny, nz, radius, segments, style);
    this.ticks = tickAngles(major, minorPer);
    this.tickFrac = tickFrac;
    this.minorStyle = BRASS.minor;
  }
  draw(p) {
    super.draw(p);                          // the ring itself
    const a = new Float32Array(3), b = new Float32Array(3);
    const inner = 1 - this.tickFrac;
    for (const { theta, major } of this.ticks) {
      (major ? this.style : this.minorStyle).apply(p, major ? 1 : 0.75);
      this.vertexAt(theta, a);
      const k = major ? inner : 1 - this.tickFrac * 0.5;
      b[0] = a[0] * k; b[1] = a[1] * k; b[2] = a[2] * k;
      p.beginShape(p.LINES);
      p.vertex(a[0], a[1], a[2]); p.vertex(b[0], b[1], b[2]);
      p.endShape();
    }
  }
}

/* --- 3D structures: the axis with low-poly pole caps, and pointer arms -- */

export class Axis extends Structure {
  constructor(nx, ny, nz, length, capRadius, style) {
    super(0, 0, 0, Infinity, style);
    const d = Math.hypot(nx, ny, nz) || 1;
    this.dir = [nx / d, ny / d, nz / d];
    this.length = length; this.capRadius = capRadius;
  }
  static polar(length, capRadius) {         // celestial north = -Y
    return new Axis(0, -1, 0, length, capRadius, BRASS.axis);
  }
  draw(p) {
    const [dx, dy, dz] = this.dir, L = this.length;
    this.style.apply(p);
    p.beginShape(p.LINES);
    p.vertex(-dx * L, -dy * L, -dz * L); p.vertex(dx * L, dy * L, dz * L);
    p.endShape();
    /* low-poly pole caps — the CRCPSphere sphereDetail(4) reading */
    for (const s of [1, -1]) {
      p.push();
      p.translate(dx * L * s, dy * L * s, dz * L * s);
      p.sphere(this.capRadius, 5, 4);
      p.pop();
    }
  }
}

export class Pointer extends Structure {
  constructor(length, tipRadius, style) {
    super(0, 0, 0, Infinity, style);
    this.length = length; this.tipRadius = tipRadius;
    this.dir = [1, 0, 0];
  }
  static subsolar(length, tip) { return new Pointer(length, tip, BRASS.sunArm); }
  static lunar(length, tip)    { return new Pointer(length, tip, BRASS.moonArm); }
  setDirection(x, y, z) {
    const d = Math.hypot(x, y, z) || 1;
    this.dir = [x / d, y / d, z / d];
  }
  draw(p) {
    const [dx, dy, dz] = this.dir, L = this.length;
    this.style.apply(p);
    p.beginShape(p.LINES);
    p.vertex(0, 0, 0); p.vertex(dx * L, dy * L, dz * L);
    p.endShape();
    p.push();
    p.translate(dx * L, dy * L, dz * L);
    p.sphere(this.tipRadius, 6, 5);
    p.pop();
  }
}

/* the local meridian plane's normal: perpendicular to both the zenith and
   the celestial pole. With north = -Y this reduces to (zz, 0, -zx). */
export function localMeridianNormal(zx, zy, zz, out) {
  const d = Math.hypot(zz, zx);
  if (d < 1e-9) { out[0] = 1; out[1] = 0; out[2] = 0; return out; }  // at a pole
  out[0] = zz / d; out[1] = 0; out[2] = -zx / d;
  return out;
}

/* --- 3D structure: a sight line from the observer to a tracked object --- */
export class SightLine extends Structure {
  constructor(style) {
    super(0, 0, 0, Infinity, style);
    this.a = new Float32Array(3); this.b = new Float32Array(3);
    this.on = false;
  }
  set(ax, ay, az, bx, by, bz) {
    this.a[0] = ax; this.a[1] = ay; this.a[2] = az;
    this.b[0] = bx; this.b[1] = by; this.b[2] = bz;
    this.on = true;
  }
  clear() { this.on = false; }
  draw(p) {
    if (!this.on) return;
    this.style.apply(p);
    p.beginShape(p.LINES);
    p.vertex(this.a[0], this.a[1], this.a[2]);
    p.vertex(this.b[0], this.b[1], this.b[2]);
    p.endShape();
  }
}

/* --- composition: the observer's own rings ------------------------------
   Historically these are exactly what an armillary sphere adds for a place:
   a horizon ring and a local meridian, set to the observer's latitude. They
   are what turn the abstract celestial cage into somebody's actual sky. */
export class ObserverRig {
  #parts;
  constructor(radius, rEarthPx) {
    this.horizon = new Ring(0, -1, 0, radius * 0.99, 176, BRASS.horizon);
    this.meridian = new Ring(0, 0, 1, radius * 0.965, 160, BRASS.localMer);
    this.zenithArm = new Pointer(rEarthPx * 1.22, rEarthPx * 0.022, BRASS.zenith);
    this.sight = new SightLine(BRASS.sight);
    this.#parts = [this.horizon, this.meridian, this.zenithArm, this.sight];
    this.active = false;
  }
  get parts() { return this.#parts.length; }
  /* zenithCore: the observer's up direction in the core frame */
  sync(zenithCore) {
    this.horizon.setNormal(zenithCore[0], zenithCore[1], zenithCore[2]);
    const n = localMeridianNormal(zenithCore[0], zenithCore[1], zenithCore[2],
                                  new Float32Array(3));
    this.meridian.setNormal(n[0], n[1], n[2]);
    this.zenithArm.setDirection(zenithCore[0], zenithCore[1], zenithCore[2]);
    this.active = true;
  }
  draw(p) { if (this.active) for (const part of this.#parts) part.draw(p); }
}

/* --- composition: parts that move as one ------------------------------- */

export class Gimbal {
  constructor(name, axis = [0, -1, 0], dyn = null) {
    this.name = name; this.axis = axis; this.dyn = dyn;
    this.parts = []; this.angle = 0;
  }
  add(...parts) { this.parts.push(...parts); return this; }
  setAngle(rad) { this.angle = rad; }       // exact, from data (preferred)
  advance(dt) { if (this.dyn) this.angle += this.dyn.spd * dt; }  // integrated
  draw(p) {
    p.push();
    if (this.angle) p.rotateY(this.angle);  // axis is polar for our gimbals
    for (const part of this.parts) part.draw(p);   // polymorphic
    p.pop();
  }
}

/* --- the assembled instrument ------------------------------------------ */

export class Armillary {
  #gimbals = [];
  #mode = 0;                                // 0 off, 1 cage, 2 full
  #live;

  /* dim: the instrument's bounding volume, injected (course Dim3) */
  constructor(dim, rEarthPx) {
    this.dim = dim;
    const R = dim.maxExtent / 2;
    this.cage = new Gimbal('celestial cage').add(
      Ring.equatorial(R),
      Ring.ecliptic(R * 0.985),
      Ring.colure('equinoctial', R * 0.97),
      Ring.colure('solstitial', R * 0.97),
      Axis.polar(R * 1.06, R * 0.014));
    this.terminator = Ring.terminator(rEarthPx * 1.004);
    this.hourRing = Ring.hour(R * 0.94);
    this.sunArm = Pointer.subsolar(rEarthPx * 1.16, rEarthPx * 0.028);
    this.moonArm = Pointer.lunar(R * 0.9, R * 0.012);
    /* the hour ring carries Earth's rotation; the rate is real and
       inspectable, though sync() sets the angle exactly from GMST rather
       than integrating, so it can never drift */
    this.#live = new Gimbal('live readings', [0, -1, 0],
      GeomDynamics.spin(SIDEREAL_RAD_PER_SEC))
      .add(this.terminator, this.hourRing, this.sunArm, this.moonArm);
    this.observer = new ObserverRig(R, rEarthPx);
    this.#gimbals = [this.cage, this.#live];
  }

  get mode() { return this.#mode; }
  get parts() { return this.#gimbals.reduce((n, g) => n + g.parts.length, 0); }
  cycleMode() { this.#mode = (this.#mode + 1) % 3; return this.#mode; }
  get label() { return ['off', 'cage', 'full'][this.#mode]; }

  /* point the live parts at the sky: sunEci and moonDir are core-frame
     unit vectors, gmstDeg from the same ephemeris that lights the globe */
  sync({ sunEci, moonDir, gmstDeg }) {
    this.terminator.setNormal(sunEci[0], sunEci[1], sunEci[2]);
    const n = meridianNormal(gmstDeg, new Float32Array(3));
    this.hourRing.setNormal(n[0], n[1], n[2]);
    this.sunArm.setDirection(sunEci[0], sunEci[1], sunEci[2]);
    if (moonDir) this.moonArm.setDirection(moonDir[0], moonDir[1], moonDir[2]);
  }

  draw(p, folds = 1) {
    if (!this.#mode) return;
    for (let f = 0; f < folds; f++) {
      if (folds > 1) { p.push(); p.rotateY(f * TAU / folds); }
      this.cage.draw(p);
      if (this.#mode === 2) { this.#live.draw(p); this.observer.draw(p); }
      if (folds > 1) p.pop();
    }
  }
}
