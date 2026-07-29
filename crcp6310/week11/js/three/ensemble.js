/*
  three/ensemble.js — GPU-side ensemble for the Three renderer.
  ROLE SEPARATION: these classes own WebGL buffers and shaders ONLY.
  They know nothing about orbital mechanics; the composition root
  (three/main.js) computes positions/colors via core/ + sim/ and writes
  them into the typed attributes each frame. Per-vertex "alpha" is done
  by darkening colors under additive blending (black adds nothing), so
  no bucket quantization is needed — the quantization in the p5 renderer
  was a workaround for immediate mode, and this is its retirement.
*/

'use strict';

import * as THREE from 'three';

const POINT_VERT = `
  attribute float size;
  varying vec3 vCol;
  void main() {
    vCol = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (240.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const POINT_FRAG = `
  varying vec3 vCol;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d);
    gl_FragColor = vec4(vCol * a, 1.0);
  }`;

/* round, soft, size-attenuated sprites with per-vertex color */
export class EnsemblePoints {
  constructor(capacity) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size',     new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(this.geo, new THREE.ShaderMaterial({
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
  }
  /* n vertices are valid this frame */
  commit(n) {
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

/* trail arcs as one LineSegments batch, fade via color darkening */
export class TrailLines {
  constructor(capacitySegments) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacitySegments * 6);
    this.col = new Float32Array(capacitySegments * 6);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.col, 3));
    this.lines = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.lines.frustumCulled = false;
  }
  commit(nVerts) {
    this.geo.setDrawRange(0, nVerts);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
