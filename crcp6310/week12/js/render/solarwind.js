/*
  render/solarwind.js — the measured stream, and the magnetopause it
  compresses, for the p5 build. Batched: one POINTS shape for the flow, one
  ring for the magnetopause nose. Colour comes from Bz sign, so the visual
  reports the coupling condition rather than just "wind exists".
*/

'use strict';

import { WindStream, bzColour, flaringAlpha, magnetopauseWireframe,
         MAGNETOPAUSE_SEGMENTS, tailWireframe, TAIL_SEGMENTS }
  from '../sim/solarwind.js';
import { basisFromNormal } from '../core/geom.js';


export class WindLayer {
  #stream; #pos; #n = 0; #col = new Float64Array(3);
  #basis = new Float64Array(6); #mp; #mpN = 0;

  constructor(count = 260) {
    this.#stream = new WindStream(count);
    this.#pos = new Float64Array(count * 3);
    this.#mp = new Float64Array(MAGNETOPAUSE_SEGMENTS * 6);
    this.tail = new Float64Array(TAIL_SEGMENTS * 6);
    this.tailN = 0; this.stretch = 0;
    this.alpha = 0.58;
    this.visible = true;
  }

  get standoffRe() { return this.#stream.standoffRe; }
  get activeCount() { return this.#n; }

  update(dtSec, weather, sunDir, stretch = 0) {
    if (!this.visible) { this.#n = 0; return; }
    this.#n = this.#stream.step(dtSec, weather, sunDir, this.#pos);
    bzColour(weather.bzNt ?? 0, this.#col);
    this.alpha = flaringAlpha(weather.bzNt ?? 0, weather.windDensity ?? 5,
                              weather.windSpeedKmS ?? 400);
    basisFromNormal(sunDir[0], sunDir[1], sunDir[2], this.#basis);
    this.#mpN = magnetopauseWireframe(this.standoffRe, this.alpha, sunDir,
                                      this.#basis, this.#mp);
    this.stretch = stretch;
    this.tailN = tailWireframe(this.standoffRe, this.alpha, stretch, sunDir,
                               this.#basis, this.tail);
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

    /* the magnetopause as a surface: nose distance from live pressure,
       flaring from Bz, both via the Shue model */
    p.noFill(); p.stroke(110, 175, 245, 78); p.strokeWeight(1.1);
    p.beginShape(p.LINES);
    for (let i = 0; i < this.#mpN * 6; i += 3)
      p.vertex(this.#mp[i] * kmToPx, this.#mp[i+1] * kmToPx, this.#mp[i+2] * kmToPx);
    p.endShape();

    /* the magnetotail, brightening as it loads before a substorm */
    p.stroke(96, 150, 225, 58 + 60 * this.stretch);
    p.strokeWeight(1 + 0.6 * this.stretch);
    p.beginShape(p.LINES);
    for (let i = 0; i < this.tailN * 6; i += 3)
      p.vertex(this.tail[i] * kmToPx, this.tail[i+1] * kmToPx, this.tail[i+2] * kmToPx);
    p.endShape();
  }
}
