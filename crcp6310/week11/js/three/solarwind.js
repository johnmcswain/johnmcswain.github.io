/*
  three/solarwind.js — the same measured stream for the high-fidelity build.
  Per-vertex colour on additive Points, so UnrealBloom makes the flow glow
  and the magnetopause ring reads as a boundary rather than a wireframe.
  Model is shared (sim/solarwind.js): identical physics, different geometry.
*/

'use strict';

import * as THREE from 'three';
import { WindStream, bzColour } from '../sim/solarwind.js';
import { basisFromNormal, ringPoint } from '../core/geom.js';

const R_EARTH_KM = 6371;
const RING_SEGS = 84;

export class WindPoints {
  #stream; #pos; #posKm; #col; #size; #n = 0;
  #c = new Float64Array(3); #basis = new Float64Array(6); #rp = new Float64Array(3);

  constructor(count, kmToUnits) {
    this.kmToUnits = kmToUnits;
    this.#stream = new WindStream(count);
    this.#posKm = new Float64Array(count * 3);
    this.#pos = new Float32Array(count * 3);
    this.#col = new Float32Array(count * 3);
    this.#size = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.#pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.#col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.#size, 1));
    this.geo = geo;
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: `attribute float size; varying vec3 vCol;
        void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vCol;
        void main(){ float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vCol * smoothstep(0.5, 0.02, d), 1.0); }`,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;

    const rg = new THREE.BufferGeometry();
    this.ringPos = new Float32Array(RING_SEGS * 3);
    rg.setAttribute('position', new THREE.BufferAttribute(this.ringPos, 3));
    this.ring = new THREE.LineLoop(rg, new THREE.LineBasicMaterial({
      color: 0x6cb4f5, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.frustumCulled = false;
    this.visible = true;
  }

  get standoffRe() { return this.#stream.standoffRe; }
  get activeCount() { return this.#n; }

  /* sunDir is in the CORE frame; y is negated on the way into three */
  update(dtSec, weather, sunDir) {
    this.points.visible = this.visible;
    this.ring.visible = this.visible;
    if (!this.visible) return;
    this.#n = this.#stream.step(dtSec, weather, sunDir, this.#posKm);
    bzColour(weather.bzNt ?? 0, this.#c);
    const k = this.kmToUnits;
    for (let i = 0; i < this.#n; i++) {
      this.#pos[i*3]     = this.#posKm[i*3] * k;
      this.#pos[i*3 + 1] = -this.#posKm[i*3 + 1] * k;
      this.#pos[i*3 + 2] = this.#posKm[i*3 + 2] * k;
      this.#col[i*3] = this.#c[0]; this.#col[i*3+1] = this.#c[1];
      this.#col[i*3+2] = this.#c[2];
      this.#size[i] = 2.4;
    }
    this.geo.setDrawRange(0, this.#n);
    for (const a of ['position', 'color', 'size']) this.geo.attributes[a].needsUpdate = true;

    const rMp = this.standoffRe * R_EARTH_KM * k;
    basisFromNormal(sunDir[0], -sunDir[1], sunDir[2], this.#basis);
    for (let s = 0; s < RING_SEGS; s++) {
      ringPoint(this.#basis, s / RING_SEGS * Math.PI * 2, rMp * 0.42, this.#rp);
      this.ringPos[s*3]     = this.#rp[0] + sunDir[0] * rMp;
      this.ringPos[s*3 + 1] = this.#rp[1] + -sunDir[1] * rMp;
      this.ringPos[s*3 + 2] = this.#rp[2] + sunDir[2] * rMp;
    }
    this.ring.geometry.attributes.position.needsUpdate = true;
  }
}
