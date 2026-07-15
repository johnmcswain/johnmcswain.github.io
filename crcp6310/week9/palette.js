'use strict';
/* palette.js — ColorHarmony: base-hue state + the six depth->color harmonies.
   Pure math (no p5, no DOM), so it is trivially smoke-testable headless. */

export function lerpN(a, b, t){ return a + (b - a) * t; }

export class ColorHarmony {
  static KEYS = ['triad', 'tetrad', 'analogous', 'compound', 'shades', 'monochrome'];

  constructor(baseHue = 38){
    this.baseHue = baseHue;
    this.idx = 0;
  }

  get name(){ return ColorHarmony.KEYS[this.idx]; }

  cycle(){ this.idx = (this.idx + 1) % ColorHarmony.KEYS.length; }

  shiftHue(delta){ this.baseHue = ((this.baseHue + delta) % 360 + 360) % 360; }

  static hsv(h, s, v){
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r, g, b;
    if(h < 60){ r = c; g = x; b = 0; } else if(h < 120){ r = x; g = c; b = 0; }
    else if(h < 180){ r = 0; g = c; b = x; } else if(h < 240){ r = 0; g = x; b = c; }
    else if(h < 300){ r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  static rampHue(anchors, t){
    const seg = Math.min(Math.max(t, 0), 1) * (anchors.length - 1);
    const i = Math.floor(seg), f = seg - i;
    const a = anchors[Math.min(i, anchors.length - 1)];
    const b = anchors[Math.min(i + 1, anchors.length - 1)];
    return a + (b - a) * f;
  }

  /* normalized t in 0..1 -> [r,g,b] under the ACTIVE harmony */
  ramp(t){
    const H = this.baseHue, hsv = ColorHarmony.hsv, rampHue = ColorHarmony.rampHue;
    switch(this.name){
      case 'triad':      return hsv(rampHue([H, H + 120, H + 240], t), 0.85, lerpN(1.0, 0.70, t));
      case 'tetrad':     return hsv(rampHue([H, H + 90, H + 180, H + 270], t), 0.82, lerpN(1.0, 0.70, t));
      case 'analogous':  return hsv(rampHue([H - 30, H, H + 30, H + 60], t), 0.80, lerpN(1.0, 0.72, t));
      case 'compound':   return hsv(t < 0.5 ? lerpN(H - 10, H + 10, t / 0.5)
                                            : lerpN(H + 170, H + 190, (t - 0.5) / 0.5),
                                    0.82, lerpN(1.0, 0.72, t));
      case 'shades':     return hsv(H, 0.90, lerpN(1.0, 0.22, t));
      case 'monochrome': return hsv(H, lerpN(0.32, 0.95, t), lerpN(1.0, 0.50, t));
      default:           return hsv(H, 0.85, 1.0);
    }
  }

  /* depth in km (0..700) -> [r,g,b] */
  depthColor(depth){ return this.ramp(Math.min(Math.max(depth, 0), 700) / 700); }
}
