/*
  render/system.js — the heliocentric view: the sun's family at their
  actual current positions. Angular positions and orbital shapes are true
  (JPL mean elements); radial distances are log-compressed (compressAU)
  and planet sizes follow log of true radius — both disclosed on the page.
  Earth carries a soft halo standing in for the LEO ensemble, which is
  sub-pixel at any honest system scale: the halo IS the disclosure.
*/

'use strict';

import { planetStates, eclipticToP5, compressAU } from '../sim/planets.js';

const v = new Float32Array(3);
const RING_SEGS = 128;

function planetPx(radiusKm) {                // log size, clamped legible
  return 2.2 + 3.4 * Math.max(0, Math.log10(radiusKm) - 3.3);
}

export function drawSystem(p, ctx) {
  const { simT, rMaxPx, earthPulse } = ctx;
  const states = planetStates(simT);

  /* orbit rings: circles at each semi-major axis, in the ecliptic */
  p.noFill();
  for (const s of states) {
    const r = compressAU(s.a, rMaxPx);
    p.stroke(s.rgb[0], s.rgb[1], s.rgb[2], 34);
    p.strokeWeight(1);
    p.beginShape();
    for (let k = 0; k <= RING_SEGS; k++) {
      const th = k / RING_SEGS * Math.PI * 2;
      eclipticToP5(Math.cos(th) * r, Math.sin(th) * r, 0, v);
      p.vertex(v[0], v[1], v[2]);
    }
    p.endShape();
  }

  /* the planets, at their true longitudes on compressed radii */
  p.noStroke();
  for (const s of states) {
    const r = compressAU(s.distAU, rMaxPx);
    const u = 1 / (s.distAU || 1);
    eclipticToP5(s.xyzAU[0] * u * r, s.xyzAU[1] * u * r, s.xyzAU[2] * u * r, v);
    p.push(); p.translate(v[0], v[1], v[2]);
    const pr = planetPx(s.radiusKm);
    p.fill(s.rgb[0], s.rgb[1], s.rgb[2], 235); p.sphere(pr, 12, 9);
    p.fill(s.rgb[0], s.rgb[1], s.rgb[2], 26);  p.sphere(pr * 2.4, 10, 8);  // glow
    if (s.name === 'Earth') {                  // the ensemble, as a halo
      p.fill(140, 190, 255, 30 + 40 * earthPulse); p.sphere(pr * 3.6, 10, 8);
    }
    if (s.name === 'Saturn') {                 // the ring, in the ecliptic plane
      p.noFill(); p.stroke(226, 208, 168, 130); p.strokeWeight(2.6);
      p.beginShape();
      for (let k = 0; k <= 48; k++) {
        const th = k / 48 * Math.PI * 2;
        eclipticToP5(Math.cos(th) * pr * 2.1, Math.sin(th) * pr * 2.1, 0, v);
        p.vertex(v[0], v[1], v[2]);
      }
      p.endShape();
      p.noStroke();
    }
    p.pop();
  }
}

export { planetPx };
