/*
  three/scenery.js — Earth, sky, and sun for the Three renderer.
  Same role rule as ensemble.js: geometry + materials only; positions and
  angles arrive from the composition root. Coastlines and stars come from
  the same generated datasets the p5 renderer uses — one provenance, two
  fidelities. Frame: three is y-up; core math is y-down (north = -Y), so
  the root negates y when writing positions ("toThree").
*/

'use strict';

import * as THREE from 'three';
import coastlines from '../render/coastlines.js';
import stars from '../render/stars_data.js';

const D2R = Math.PI / 180;

const ATMO_VERT = `
  varying vec3 vN;
  void main() {
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const ATMO_FRAG = `
  varying vec3 vN;
  void main() {
    float rim = pow(clamp(vN.z + 1.04, 0.0, 1.0), 5.0);
    gl_FragColor = vec4(vec3(0.35, 0.55, 0.95) * rim, 1.0);
  }`;

export class Earth {
  constructor(radius) {
    this.group = new THREE.Group();
    this.group.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.992, 48, 32),
      new THREE.MeshPhongMaterial({ color: 0x1c2738, specular: 0x0c1420, shininess: 8 })));
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.035, 48, 32),
      new THREE.ShaderMaterial({ vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
        side: THREE.BackSide, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending }));
    this.group.add(atmo);

    /* coastlines: earth-fixed unit vectors -> LineSegments (y negated: y-up) */
    const segs = [];
    for (const line of coastlines) {
      for (let i = 0; i + 1 < line.length; i++) {
        for (const [lon, lat] of [line[i], line[i + 1]]) {
          const la = lat * D2R, lo = lon * D2R;
          segs.push(Math.cos(la) * Math.cos(lo) * radius,
                    Math.sin(la) * radius,
                    Math.cos(la) * Math.sin(lo) * radius);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(segs), 3));
    this.coastSegments = segs.length / 6;
    this.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial(
      { color: 0x9db8dd, transparent: true, opacity: 0.55 })));
  }
  setGMST(gmstRad) { this.group.rotation.y = gmstRad; }   // sign: visual check
}

export class Sky {
  constructor(radius) {
    const pos = [], col = [], size = [];
    for (const [ra, dec, mag] of stars) {
      const d = dec * D2R, r = ra * D2R;
      pos.push(Math.cos(d) * Math.cos(r) * radius,
               Math.sin(d) * radius,
               Math.cos(d) * Math.sin(r) * radius);
      const b = Math.min(1, Math.max(0.12, 1.1 - mag * 0.24));
      col.push(0.80 * b, 0.85 * b, 0.95 * b);
      size.push(2.6 - mag * 0.35);
    }
    this.starCount = size.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(Float32Array.from(col), 3));
    g.setAttribute('size',     new THREE.BufferAttribute(Float32Array.from(size), 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: `attribute float size; varying vec3 vCol;
        void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * 1.6; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vCol;
        void main(){ float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vCol * smoothstep(0.5, 0.1, d), 1.0); }`,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
  }
}

/* the sun: emissive disc at true angular size + the light itself;
   the corona is no longer drawn — UnrealBloomPass makes it from luminance */
export class Sun {
  constructor(discRadius) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(discRadius, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff8e8 }));
    this.light = new THREE.DirectionalLight(0xfff2d8, 2.6);
    this.ambient = new THREE.AmbientLight(0x223048, 0.9);
  }
  setDirection(x, y, z, dist) {
    this.mesh.position.set(x * dist, y * dist, z * dist);
    this.light.position.set(x, y, z);
  }
}
