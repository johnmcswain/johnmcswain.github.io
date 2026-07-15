/*
  state.js — shared config + mutable session state.
  This is the module that replaces Seisma's bare globals. Renderers never
  read window-scope; they receive `state` (plus the p5 instance) explicitly.
*/

'use strict';

export const CONFIG = {
  groups:     ['stations', 'last-30-days', 'cosmos-2251-debris', 'starlink'],
  maxRender:  1500,          // client-side cap (starlink group is ~7k)
  altMinKm:   250,           // radius mapping domain
  altMaxKm:   2000,
  shellRefs:  [400, 550, 800, 1200],  // faint reference rings, km
  timeScales: [60, 240, 600],         // one LEO orbit ≈ 95 s / 24 s / 9.5 s
  altExags:   [4, 1],                  // 4x spreads shells; 1x = true scale
  maxFolds:   8,                       // kaleidoscope ceiling
  conjKm:     30,                      // close-pair threshold, true-scale km
};

export const state = {
  groupIdx:   0,
  objects:    [],            // normalized feed output, capped
  dataMode:   'loading',     // 'live' | 'fixture' | 'loading'
  paused:     false,
  timeIdx:    0,             // default 60x
  simT:       Date.now(),    // simulated clock, ms — advanced in draw()
  soundOn:    false,
  reduceMotion: false,
  exagIdx:    0,
  folds:      1,                       // 1 = the honest sky; >1 = kaleidoscope
  conjCount:  0,                       // session total, HUD
  focusStep:  0,                       // 0 = off; 1..n indexes notables
};

/* reduced-motion pins the clock to real orbital rates (1x) regardless of cycle */
export function timeScale() { return state.reduceMotion ? 1 : CONFIG.timeScales[state.timeIdx]; }
export function altExag()   { return CONFIG.altExags[state.exagIdx]; }
