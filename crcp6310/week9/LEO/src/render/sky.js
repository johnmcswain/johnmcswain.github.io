/*
  render/sky.js — the real sky: all 523 naked-eye stars to magnitude 4.0
  from the HYG database (Hipparcos-derived; CC BY-SA), as a distant shell
  in the same equatorial/ECI frame the orbits use. The stars hold still;
  the Earth rotates under them — which is the true arrangement.

  Brightness is bucketed into three batches (mandala batching discipline).
*/

'use strict';

import stars from './stars_data.js';

const D2R = Math.PI / 180;
const BUCKETS = [                       // [maxMag, alpha, weight]
  [1.5, 235, 3.2],
  [3.0, 150, 2.2],
  [4.1,  80, 1.5],
];

/* precompute unit vectors per bucket (RA/dec -> p5 ECI frame, north = -Y) */
const SHELLS = BUCKETS.map(() => []);
for (const [ra, dec, mag] of stars) {
  const b = BUCKETS.findIndex(([m]) => mag <= m);
  if (b < 0) continue;
  const d = dec * D2R, r = ra * D2R;
  SHELLS[b].push(Math.cos(d) * Math.cos(r), -Math.sin(d), Math.cos(d) * Math.sin(r));
}
const SHELL_ARRAYS = SHELLS.map(s => Float32Array.from(s));

export const STAR_COUNT = stars.length;

export function drawSky(p, rPx) {
  for (let b = 0; b < SHELL_ARRAYS.length; b++) {
    const a = SHELL_ARRAYS[b], [, alpha, weight] = BUCKETS[b];
    p.stroke(205, 215, 235, alpha);
    p.strokeWeight(weight);
    p.beginShape(p.POINTS);
    for (let i = 0; i < a.length; i += 3)
      p.vertex(a[i] * rPx, a[i + 1] * rPx, a[i + 2] * rPx);
    p.endShape();
  }
}
