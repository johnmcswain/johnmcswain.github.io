/*
  render/earth.js — the planet at the center: a dark sphere wearing 110m
  coastlines (world-atlas TopoJSON, pre-flattened to polylines at build time).
  Vector outlines, so it stays crisp at any size — no texture asset.

  Convention: p5 WEBGL is y-down; north pole maps to -Y so the globe reads
  upright. latLonToXYZ is pure + exported for the headless suite.
*/

'use strict';

import coastlines from './coastlines.js';

const D2R = Math.PI / 180;

/* lat/lon (deg) -> unit sphere in p5 space (north = -Y) */
export function latLonToXYZ(latDeg, lonDeg) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  return [Math.cos(la) * Math.cos(lo), -Math.sin(la), Math.cos(la) * Math.sin(lo)];
}

/* precompute unit vectors once; scaled inline at draw — no per-frame alloc */
const LINES = coastlines.map(line => {
  const a = new Float32Array(line.length * 3);
  line.forEach(([lon, lat], i) => a.set(latLonToXYZ(lat, lon), i * 3));
  return a;
});

export const COASTLINE_COUNT = LINES.length;

/* segment pools reused every frame: lit + night coastline runs */
const lit = [], night = [];

/* sunEF: unit sun direction in the earth-fixed frame (latLonToXYZ of the
   subsolar point). Omit it and the globe draws unshaded, as before. */
export function drawEarth(p, rPx, sunEF) {
  p.push();
  p.noStroke();
  if (sunEF) {                                     // day-side sphere shading
    p.ambientLight(26, 30, 42);
    p.directionalLight(120, 108, 88, -sunEF[0], -sunEF[1], -sunEF[2]);
    p.ambientMaterial(60, 72, 96);
  } else {
    p.fill(14, 18, 27);
  }
  p.sphere(rPx * 0.992, 24, 18);                   // just under the lines: no z-fight
  if (sunEF) p.noLights();
  p.noFill(); p.strokeWeight(1);
  if (!sunEF) {
    p.stroke(120, 150, 190, 150);
    for (const a of LINES) {
      p.beginShape();
      for (let i = 0; i < a.length; i += 3)
        p.vertex(a[i] * rPx, a[i + 1] * rPx, a[i + 2] * rPx);
      p.endShape();
    }
    p.pop(); return;
  }
  lit.length = 0; night.length = 0;
  for (const a of LINES) {
    for (let i = 0; i + 5 < a.length; i += 3) {
      const day = a[i] * sunEF[0] + a[i+1] * sunEF[1] + a[i+2] * sunEF[2] > 0;
      (day ? lit : night).push(a[i]*rPx, a[i+1]*rPx, a[i+2]*rPx,
                               a[i+3]*rPx, a[i+4]*rPx, a[i+5]*rPx);
    }
  }
  for (const [seg, col] of [[lit, [150, 180, 215, 190]], [night, [70, 90, 120, 80]]]) {
    p.stroke(...col);
    p.beginShape(p.LINES);
    for (let i = 0; i < seg.length; i += 3) p.vertex(seg[i], seg[i+1], seg[i+2]);
    p.endShape();
  }
  p.pop();
}
