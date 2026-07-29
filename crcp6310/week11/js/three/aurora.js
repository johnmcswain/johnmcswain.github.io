/*
  three/aurora.js — auroral ovals for the high-fidelity build.
  One Points object with per-vertex colour, so intensity needs no bucket
  quantisation and UnrealBloom turns the bright cells into real glow rather
  than the speckle the p5 layer settles for. The model itself is shared
  (sim/aurora.js): identical physics, different rendering.
  Lives in the earth-fixed group, at the true 110 km emission altitude.
*/

'use strict';

import * as THREE from 'three';
import { auroraGrid, ovalIntensity, EMISSION_ALT_KM } from '../sim/aurora.js';

const RECOMPUTE_FRAMES = 12;

/* intensity -> colour, following real aurora: faint green through bright
   green to red at the top of the scale */
function auroraColour(v, out, o) {
  if (v < 0.55) { const t = v / 0.55;
    out[o] = 0.10 + 0.25 * t; out[o+1] = 0.55 + 0.45 * t; out[o+2] = 0.35 + 0.20 * t; }
  else { const t = (v - 0.55) / 0.45;
    out[o] = 0.35 + 0.60 * t; out[o+1] = 1.0 - 0.45 * t; out[o+2] = 0.55 - 0.25 * t; }
  const gain = 0.35 + 0.65 * v;
  out[o] *= gain; out[o+1] *= gain; out[o+2] *= gain;
}

export class AuroraPoints {
  #grid;
  #pos; #col; #size;
  #frame = 0;
  #count = 0;

  constructor(earthRadiusUnits, kmToUnits) {
    this.#grid = auroraGrid();
    const n = this.#grid.count;
    this.#pos = new Float32Array(n * 3);
    this.#col = new Float32Array(n * 3);
    this.#size = new Float32Array(n);
    this.radius = earthRadiusUnits + EMISSION_ALT_KM * kmToUnits;

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
        gl_FragColor = vec4(vCol * smoothstep(0.5, 0.05, d), 1.0); }`,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.visible = true;
  }

  get activeCount() { return this.#count; }

  update(kp, subsolarLonDeg) {
    this.points.visible = this.visible;
    if (!this.visible || this.#frame++ % RECOMPUTE_FRAMES !== 0) return;
    const { vectors, latlon, count } = this.#grid;
    let n = 0;
    for (let i = 0; i < count; i++) {
      const v = ovalIntensity(kp, latlon[i*2], latlon[i*2+1], subsolarLonDeg);
      if (v <= 0.05) continue;
      this.#pos[n*3]   = vectors[i*3]   * this.radius;
      this.#pos[n*3+1] = vectors[i*3+1] * this.radius;
      this.#pos[n*3+2] = vectors[i*3+2] * this.radius;
      auroraColour(v, this.#col, n * 3);
      this.#size[n] = 2.0 + 3.4 * v;
      n++;
    }
    this.#count = n;
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
