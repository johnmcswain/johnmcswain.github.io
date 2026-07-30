/*
  three/solarwind.js — the same measured stream for the high-fidelity build.
  Per-vertex colour on additive Points, so UnrealBloom makes the flow glow
  and the magnetopause ring reads as a boundary rather than a wireframe.
  Model is shared (sim/solarwind.js): identical physics, different geometry.
*/

'use strict';

import * as THREE from 'three';
import { WindStream, bzColour, flaringAlpha, magnetopauseWireframe,
         MAGNETOPAUSE_SEGMENTS, tailWireframe, TAIL_SEGMENTS }
  from '../sim/solarwind.js';
import { basisFromNormal } from '../core/geom.js';


export class WindPoints {
  #stream; #pos; #posKm; #col; #size; #n = 0;
  #c = new Float64Array(3); #basis = new Float64Array(6);
  #mp = new Float64Array(MAGNETOPAUSE_SEGMENTS * 6); #mpN = 0;
  #tail = new Float64Array(TAIL_SEGMENTS * 6); #tailN = 0;

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
    this.ringPos = new Float32Array(MAGNETOPAUSE_SEGMENTS * 6);
    rg.setAttribute('position', new THREE.BufferAttribute(this.ringPos, 3));
    this.ring = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({
      color: 0x6cb4f5, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.frustumCulled = false;
    this.alpha = 0.58;

    const tg = new THREE.BufferGeometry();
    this.tailPos = new Float32Array(TAIL_SEGMENTS * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tailPos, 3));
    this.tail = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({
      color: 0x5f96e0, transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tail.frustumCulled = false;
    this.visible = true;
  }

  get standoffRe() { return this.#stream.standoffRe; }
  get activeCount() { return this.#n; }

  /* sunDir is in the CORE frame; y is negated on the way into three */
  update(dtSec, weather, sunDir, stretch = 0) {
    this.points.visible = this.visible;
    this.ring.visible = this.visible;
    this.tail.visible = this.visible;
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

    /* the magnetopause surface: nose from pressure, flaring from Bz */
    this.alpha = flaringAlpha(weather.bzNt ?? 0, weather.windDensity ?? 5,
                              weather.windSpeedKmS ?? 400);
    basisFromNormal(sunDir[0], sunDir[1], sunDir[2], this.#basis);
    this.#mpN = magnetopauseWireframe(this.standoffRe, this.alpha, sunDir,
                                      this.#basis, this.#mp);
    for (let i = 0; i < this.#mpN * 6; i += 3) {
      this.ringPos[i]     = this.#mp[i] * k;
      this.ringPos[i + 1] = -this.#mp[i + 1] * k;
      this.ringPos[i + 2] = this.#mp[i + 2] * k;
    }
    this.ring.geometry.setDrawRange(0, this.#mpN * 2);
    this.ring.geometry.attributes.position.needsUpdate = true;

    /* the magnetotail, stretching and brightening as the substorm loads */
    this.#tailN = tailWireframe(this.standoffRe, this.alpha, stretch, sunDir,
                                this.#basis, this.#tail);
    for (let i = 0; i < this.#tailN * 6; i += 3) {
      this.tailPos[i]     = this.#tail[i] * k;
      this.tailPos[i + 1] = -this.#tail[i + 1] * k;
      this.tailPos[i + 2] = this.#tail[i + 2] * k;
    }
    this.tail.material.opacity = 0.24 + 0.30 * stretch;
    this.tail.geometry.setDrawRange(0, this.#tailN * 2);
    this.tail.geometry.attributes.position.needsUpdate = true;
  }
}
