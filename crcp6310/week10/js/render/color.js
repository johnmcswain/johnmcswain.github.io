/*
  render/color.js — shared color math. Extracted from orbits.js the moment
  a second renderer needed it (the condition we set when deferring this).
*/

'use strict';

/* hsv (h in deg, s/v in 0..1) -> [r,g,b] 0..255 */
export function hsv(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
                  : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
