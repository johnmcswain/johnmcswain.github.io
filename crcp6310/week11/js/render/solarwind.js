/*
  render/solarwind.js — the measured stream, and the magnetopause it
  compresses, for the p5 build. Batched: one POINTS shape for the flow, one
  ring for the magnetopause nose. Colour comes from Bz sign, so the visual
  reports the coupling condition rather than just "wind exists".
*/

'use strict';

import { WindStream, bzColour } from '../sim/solarwind.js';
import { basisFromNormal, ringPoint } from '../core/geom.js';

const R_EARTH_KM = 6371;

export class WindLayer {
  #stream; #pos; #n = 0; #col = new Float64Array(3);
  #basis = new Float64Array(6); #rp = new Float64Array(3);

  constructor(count = 260) {
    this.#stream = new WindStream(count);
    this.#pos = new Float64Array(count * 3);
    this.visible = true;
  }

  get standoffRe() { return this.#stream.standoffRe; }
  get activeCount() { return this.#n; }

  update(dtSec, weather, sunDir) {
    if (!this.visible) { this.#n = 0; return; }
    this.#n = this.#stream.step(dtSec, weather, sunDir, this.#pos);
    bzColour(weather.bzNt ?? 0, this.#col);
  }

  draw(p, kmToPx, sunDir) {
    if (!this.visible || !this.#n) return;
    const [r, g, b] = [this.#col[0] * 255, this.#col[1] * 255, this.#col[2] * 255];
    p.stroke(r, g, b, 150);
    p.strokeWeight(2.2);
    p.beginShape(p.POINTS);
    for (let i = 0; i < this.#n; i++)
      p.vertex(this.#pos[i*3] * kmToPx, this.#pos[i*3+1] * kmToPx,
               this.#pos[i*3+2] * kmToPx);
    p.endShape();

    /* the magnetopause nose: a ring perpendicular to the sun line whose
       radius is the live standoff distance. It visibly closes in during a
       storm because the standoff formula is driven by pressure. */
    const rMp = this.standoffRe * R_EARTH_KM * kmToPx;
    basisFromNormal(sunDir[0], sunDir[1], sunDir[2], this.#basis);
    p.noFill(); p.stroke(120, 180, 245, 90); p.strokeWeight(1.2);
    p.beginShape();
    for (let k = 0; k < 72; k++) {
      ringPoint(this.#basis, k / 72 * Math.PI * 2, rMp * 0.42, this.#rp);
      p.vertex(this.#rp[0] + sunDir[0] * rMp,
               this.#rp[1] + sunDir[1] * rMp,
               this.#rp[2] + sunDir[2] * rMp);
    }
    p.endShape(p.CLOSE);
  }
}
