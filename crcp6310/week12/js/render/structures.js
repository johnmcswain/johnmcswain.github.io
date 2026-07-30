/*
  render/structures.js — the event layer as a family of geometric structures,
  in the course module's OOP idiom (GeomStyle / composed collaborators /
  overloaded construction / an array of objects driven polymorphically),
  translated from Processing+P3D to JS+p5 WEBGL.

  THE OOP MAP (assignment vocabulary -> this file):
    encapsulation   GeomStyle owns appearance; Structure owns lifetime (#age)
    composition     every Structure HAS-A GeomStyle (course: Poly has gs, gd)
    inheritance     PlaneRing (2D) and CageBurst (3D) extend Structure
    polymorphism    StructureField iterates s.update(dt); s.draw(p) without
                    knowing subclasses (course: ps[i].draw(); ps[i].move())
    overloading     JS lacks signature overloads; static factories play the
                    role of the course's overloaded constructors
    array of objects  StructureField, fixed-cap with swap-remove

  2D structures: PlaneRing — an n-gon living on a plane in 3D space
  (the course Poly, given an orientation). 3D structures: CageBurst —
  expanding wireframe polyhedra. Together with the ensemble, globe, and
  ground tracks they form the larger composition.
*/

'use strict';

/* ---- appearance, encapsulated (course: GeomStyle.pde) -------------------- */
export class GeomStyle {
  constructor(strokeCol = [255, 255, 255], alpha = 255, strokeWt = 1.5) {
    this.strokeCol = strokeCol; this.alpha = alpha; this.strokeWt = strokeWt;
  }
  apply(p, fade = 1) {
    const [r, g, b] = this.strokeCol;
    p.stroke(r, g, b, this.alpha * fade);
    p.strokeWeight(this.strokeWt);
    p.noFill();
  }
}

/* ---- pure basis math (exported for the suite) ---------------------------- */
export function basisFromNormal(nx, ny, nz, out) {   // out: Float32Array(6)
  const d = Math.hypot(nx, ny, nz) || 1;
  nx /= d; ny /= d; nz /= d;
  /* pick the axis least aligned with n, cross twice */
  let ax = 0, ay = 0, az = 1;
  if (Math.abs(nz) > 0.9) { ax = 1; az = 0; }
  let ux = ny * az - nz * ay, uy = nz * ax - nx * az, uz = nx * ay - ny * ax;
  const du = Math.hypot(ux, uy, uz);
  ux /= du; uy /= du; uz /= du;
  out[0] = ux; out[1] = uy; out[2] = uz;
  out[3] = ny * uz - nz * uy; out[4] = nz * ux - nx * uz; out[5] = nx * uy - ny * ux;
  return out;
}

const PHI = (1 + Math.sqrt(5)) / 2;
export function polyhedronEdges(kind) {   // unit-radius verts + edge index pairs
  let verts;
  if (kind === 'octahedron') {
    verts = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  } else {                                // icosahedron
    verts = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1])
      verts.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]);
  }
  const n = verts.map(v => { const d = Math.hypot(...v); return v.map(c => c / d); });
  /* edges = pairs at the minimal inter-vertex distance */
  let dMin = Infinity;
  for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++)
    dMin = Math.min(dMin, Math.hypot(n[i][0]-n[j][0], n[i][1]-n[j][1], n[i][2]-n[j][2]));
  const edges = [];
  for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++)
    if (Math.hypot(n[i][0]-n[j][0], n[i][1]-n[j][1], n[i][2]-n[j][2]) < dMin * 1.05)
      edges.push([i, j]);
  return { verts: n, edges };
}
const CAGES = { octahedron: polyhedronEdges('octahedron'),
                icosahedron: polyhedronEdges('icosahedron') };

/* ---- the base structure -------------------------------------------------- */
export class Structure {
  #age = 0;
  constructor(x, y, z, life, style) {
    this.x = x; this.y = y; this.z = z;
    this.life = life; this.style = style;
  }
  get age() { return this.#age; }          // 0..1, encapsulated growth
  get dead() { return this.#age >= 1; }
  update(dt) { this.#age = Math.min(1, this.#age + dt / this.life); }
  draw(p) {}                                // polymorphic contract
}

/* ---- 2D: an n-gon on an oriented plane (the course Poly, given a normal) - */
export class PlaneRing extends Structure {
  constructor(x, y, z, nx, ny, nz, ptCount, rad, life, style) {
    super(x, y, z, life, style);
    this.ptCount = ptCount; this.rad = rad; this.spin = 0.9;
    this.basis = basisFromNormal(nx, ny, nz, new Float32Array(6));
  }
  /* factory-overloads, standing in for Processing's overloaded cstrs */
  static sunrise(x, y, z, nx, ny, nz, rad) {
    return new PlaneRing(x, y, z, nx, ny, nz, 3, rad, 1.1,
      new GeomStyle([255, 226, 150], 220, 1.8));
  }
  static sunset(x, y, z, nx, ny, nz, rad) {
    return new PlaneRing(x, y, z, nx, ny, nz, 6, rad, 1.8,
      new GeomStyle([120, 150, 235], 190, 1.4));
  }
  draw(p) {
    const e = this.age, fade = 1 - e;
    const r = this.rad * (0.25 + 1.5 * e);
    const rot = e * this.spin, [ux, uy, uz, vx, vy, vz] = this.basis;
    this.style.apply(p, fade * fade);
    p.beginShape();
    for (let i = 0; i < this.ptCount; i++) {
      const th = rot + i / this.ptCount * Math.PI * 2;
      const c = Math.cos(th) * r, s = Math.sin(th) * r;
      p.vertex(this.x + ux * c + vx * s, this.y + uy * c + vy * s,
               this.z + uz * c + vz * s);
    }
    p.endShape(p.CLOSE);
  }
}

/* ---- 3D: expanding wireframe polyhedron ---------------------------------- */
export class CageBurst extends Structure {
  constructor(x, y, z, kind, rad, life, style) {
    super(x, y, z, life, style);
    this.cage = CAGES[kind]; this.rad = rad;
    this.spinAxis = basisFromNormal(x || 1, y, z, new Float32Array(6));
  }
  static conjunction(x, y, z, rad) {       // the close-pair event
    return new CageBurst(x, y, z, 'icosahedron', rad, 1.5,
      new GeomStyle([255, 235, 190], 235, 1.6));
  }
  draw(p) {
    const e = this.age, fade = (1 - e) * (1 - e);
    const r = this.rad * (0.3 + 2.2 * e), rot = e * 1.4;
    this.style.apply(p, fade);
    p.push();
    p.translate(this.x, this.y, this.z);
    p.rotateY(rot); p.rotateX(rot * 0.63);
    const { verts, edges } = this.cage;
    p.beginShape(p.LINES);
    for (const [i, j] of edges) {
      p.vertex(verts[i][0] * r, verts[i][1] * r, verts[i][2] * r);
      p.vertex(verts[j][0] * r, verts[j][1] * r, verts[j][2] * r);
    }
    p.endShape();
    p.pop();
  }
}

/* ---- the array of objects (course: Poly[] ps) ---------------------------- */
export class StructureField {
  constructor(cap = 32) { this.cap = cap; this.items = []; }
  spawn(s) {
    if (this.items.length >= this.cap) this.items.shift();   // oldest yields
    this.items.push(s);
    return s;
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].update(dt);
      if (this.items[i].dead) {            // swap-remove
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();
      }
    }
  }
  draw(p, folds = 1) {                     // polymorphic dispatch, fold lens
    const TAU = Math.PI * 2;
    for (let f = 0; f < folds; f++) {
      if (folds > 1) { p.push(); p.rotateY(f * TAU / folds); }
      for (const s of this.items) s.draw(p);
      if (folds > 1) p.pop();
    }
  }
}
