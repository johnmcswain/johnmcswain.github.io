/*
  three/solids.js — the same three custom 3D objects for the high-fidelity
  build. Geometry comes from sim/magnetosphere.js, so the toroid, the helix
  and the shell are identical shapes in both builds; only the material
  differs. Additive lines so UnrealBloom lights the trapped particles.

  Parented to the earth-fixed group by the composition root, because the
  magnetic field turns with the planet.
*/

'use strict';

import * as THREE from 'three';
import {
  magneticAxis, magneticBasis, BELTS,
  torusWireframe, torusSegmentCount,
  fieldShellWireframe, shellSegmentCount,
  helixWireframe, R_EARTH_KM,
} from '../sim/magnetosphere.js';

const AXIS = magneticAxis(new Float64Array(3));
const BASIS = magneticBasis(AXIS, new Float64Array(6));

/* core (left-handed, y-down) -> three (right-handed, y-up) */
function toThree(src, count, dst, kmToUnits) {
  for (let i = 0; i < count * 6; i += 3) {
    dst[i]     = src[i] * kmToUnits;
    dst[i + 1] = -src[i + 1] * kmToUnits;
    dst[i + 2] = src[i + 2] * kmToUnits;
  }
}

function lineObject(floats, hex, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(floats, 3));
  const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: hex, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  obj.frustumCulled = false;
  return obj;
}

const rgbHex = ([r, g, b]) => (r << 16) | (g << 8) | b;

export class MagnetosphereThree {
  #objects = [];
  #helices = [];

  constructor(kmToUnits) {
    this.k = kmToUnits;
    this.group = new THREE.Group();

    /* 1. toroids — the radiation belts */
    for (const spec of BELTS) {
      const rings = 44, sides = 14;
      const src = new Float64Array(torusSegmentCount(rings, sides) * 6);
      const n = torusWireframe(AXIS, BASIS, spec.L * R_EARTH_KM,
        spec.halfWidth * R_EARTH_KM, rings, sides, src);
      const dst = new Float32Array(n * 6);
      toThree(src, n, dst, kmToUnits);
      const obj = lineObject(dst, rgbHex(spec.rgb), 0.30);
      this.#objects.push(obj); this.group.add(obj);
    }

    /* 3. surfaces of revolution — L-shells */
    for (const L of [2.5, 6]) {
      const meridians = 12, steps = 26;
      const src = new Float64Array(shellSegmentCount(meridians, steps) * 6);
      const n = fieldShellWireframe(AXIS, BASIS, L, meridians, steps, src);
      const dst = new Float32Array(n * 6);
      toThree(src, n, dst, kmToUnits);
      const obj = lineObject(dst, 0x7a9ad0, 0.22);
      this.#objects.push(obj); this.group.add(obj);
    }

    /* 2. helices — trapped particles, rebuilt each frame as they gyrate */
    for (const [L, theta, hex] of [[4.5, 0, 0xbef0ff], [2.4, 2.1, 0xffcd96],
                                   [6.0, 4.0, 0xaadcff]]) {
      const samples = 200;
      const src = new Float64Array(samples * 6);
      const scratch = new Float64Array(samples * 3);
      const dst = new Float32Array(samples * 6);
      const obj = lineObject(dst, hex, 0.85);
      this.#helices.push({ L, theta, phase: 0, samples, src, scratch, dst, obj });
      this.group.add(obj);
    }
    this.visible = false;
  }

  get parts() { return this.#objects.length + this.#helices.length; }

  update(dt) {
    this.group.visible = this.visible;
    if (!this.visible) return;
    for (const h of this.#helices) {
      h.phase += dt * 2.2;
      h.theta += dt * 0.06;
      const n = helixWireframe(AXIS, BASIS, h.L, h.theta,
        { samples: h.samples, turns: 24, gyroRe: 0.11, phase: h.phase },
        h.scratch, h.src);
      toThree(h.src, n, h.dst, this.k);
      h.obj.geometry.setDrawRange(0, n * 2);
      h.obj.geometry.attributes.position.needsUpdate = true;
    }
  }
}
