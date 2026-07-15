'use strict';
/* shapes.js — ShapeAtlas: the shared shape vocabulary. Owns the polyline cache
   (torus knots, superformula florets, {n/k} stars), the LOD policy, and the
   halo->body->strand glow treatment. Draw methods call p5 global-mode
   functions (stroke, circle, vertex, ...) which exist once p5 has booted —
   nothing here runs at module load time. */

import { lerpN } from './palette.js';

export const TAU  = Math.PI * 2;
export const GLOW = 0.1;                                 // bloom strength (90% reduced)

export class ShapeAtlas {
  #cache = {};

  static lodSteps(scl){ return scl < 16 ? 56 : scl < 32 ? 84 : 120; }

  /* ---- cached polylines (Float32Array, unit-radius) ---- */

  /* (p,q) torus knot silhouette */
  knot(p, q, ratio, steps){
    const key = 'k_' + p + '_' + q + '_' + ratio + '_' + steps;
    let pts = this.#cache[key];
    if(!pts){
      pts = new Float32Array((steps + 1) * 2);
      for(let i = 0; i <= steps; i++){
        const th = i / steps * TAU, rad = 1 + ratio * Math.cos(q * th);
        pts[i * 2] = Math.cos(p * th) * rad; pts[i * 2 + 1] = Math.sin(p * th) * rad;
      }
      this.#cache[key] = pts;
    }
    return pts;
  }

  /* superformula (Gielis) unit curve — m petals, exponents n1..n3 */
  superformula(m, n1, n2, n3, steps){
    const key = 's_' + m + '_' + n1 + '_' + n2 + '_' + n3 + '_' + steps;
    let pts = this.#cache[key];
    if(!pts){
      pts = new Float32Array((steps + 1) * 2);
      let maxr = 1e-6;
      for(let i = 0; i <= steps; i++){
        const th = i / steps * TAU;
        const a = Math.pow(Math.abs(Math.cos(m * th / 4)), n2);
        const b = Math.pow(Math.abs(Math.sin(m * th / 4)), n3);
        const r = Math.pow(a + b, -1 / n1);
        pts[i * 2] = Math.cos(th) * r; pts[i * 2 + 1] = Math.sin(th) * r;
        if(r > maxr) maxr = r;
      }
      for(let i = 0; i < pts.length; i++) pts[i] /= maxr; // normalize to unit radius
      this.#cache[key] = pts;
    }
    return pts;
  }

  /* {n/k} star-polygon path (skip-k vertex order). gcd(n,k)=1 gives a single
     unicursal closed star = one cached polyline. The classic Islamic orders. */
  star(n, k){
    const key = 'st_' + n + '_' + k;
    let pts = this.#cache[key];
    if(!pts){
      const order = []; let j = 0;
      do { order.push(j); j = (j + k) % n; } while(j !== 0);
      order.push(0);                                     // close the path
      pts = new Float32Array(order.length * 2);
      for(let i = 0; i < order.length; i++){
        const a = order[i] / n * TAU - Math.PI / 2;
        pts[i * 2] = Math.cos(a); pts[i * 2 + 1] = Math.sin(a);
      }
      this.#cache[key] = pts;
    }
    return pts;
  }

  /* ---- emitters ---- */

  emit(pts, scl, close){
    beginShape();
    for(let i = 0; i < pts.length; i += 2) vertex(pts[i] * scl, pts[i + 1] * scl);
    endShape(close ? CLOSE : undefined);
  }

  /* a whole point cloud in ONE shape call (POINTS) — a whole automaton at one
     draw call instead of one per cell, the key to not flooding the renderer */
  emitPoints(pts, scl){
    beginShape(POINTS);
    for(let i = 0; i < pts.length; i += 2) vertex(pts[i] * scl, pts[i + 1] * scl);
    endShape();
  }

  /* ---- primitive vocabulary ---- */

  torusRing(rO, rI, ticks){
    noFill(); circle(0, 0, rO * 2); circle(0, 0, rI * 2);
    for(let i = 0; i < ticks; i++){
      const a = i * TAU / ticks;
      line(Math.cos(a) * rI, Math.sin(a) * rI, Math.cos(a) * rO, Math.sin(a) * rO);
    }
  }

  ripple(r, rings){
    noFill();
    for(let i = 1; i <= rings; i++){
      strokeWeight(map(i, 1, rings, 1.6, 0.4));
      circle(0, 0, r * 2 * i / rings);
    }
  }

  /* ---- glow helpers: faint halo -> body -> bright inner strand ---- */

  ringGlow(rO, rI, ticks, a, r, g, b, w, lite){
    noFill();
    if(!lite){ stroke(r, g, b, a * 0.22 * GLOW); strokeWeight(w * 3.2); this.torusRing(rO, rI, ticks); }
    stroke(r, g, b, a); strokeWeight(w); this.torusRing(rO, rI, ticks);
  }

  knotGlow(p, q, ratio, scl, a, r, g, b, w, lite){
    const pts = this.knot(p, q, ratio, ShapeAtlas.lodSteps(scl));
    noFill();
    if(!lite){ stroke(r, g, b, a * 0.22 * GLOW); strokeWeight(w * 3.2); this.emit(pts, scl); }
    stroke(r, g, b, a); strokeWeight(w); this.emit(pts, scl);
    if(!lite){
      stroke(lerpN(r, 255, 0.6), lerpN(g, 255, 0.6), lerpN(b, 255, 0.6), a * 0.6);
      strokeWeight(Math.max(0.6, w * 0.4)); this.emit(pts, scl);
    }
  }
}
