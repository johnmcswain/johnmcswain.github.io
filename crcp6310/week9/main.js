'use strict';
/* ============================================================================
   main.js — composition root for SEISMA (loaded by mandala.html as a module)
   ----------------------------------------------------------------------------
   All logic now lives in ES-module classes:
     palette.js  ColorHarmony            base hue + six depth->color harmonies
     shapes.js   ShapeAtlas              cached polylines, LOD, glow vocabulary
     motifs.js   Motif (+5 subclasses)   the five variations behind one contract
                 GameOfLife              per-seed polar CA (class expression)
     audio.js    Sonifier                opt-in Web Audio voice sequencer
     data.js     QuakeFeed               USGS feed, offline fallback, specimen
     hud.js      Hud                     all DOM overlay updates
     engine.js   ViewState, MandalaEngine  layout, transitions, input, draw loop

   This file only composes them and hands the p5 lifecycle hooks to the
   engine. p5 runs in GLOBAL mode: p5.min.js is loaded as a classic script
   before this module, and p5 looks for window.setup/window.draw at the
   window 'load' event — module scripts execute before 'load', so assigning
   the hooks here is race-free. The motif/shape draw methods call p5 globals
   (stroke, circle, noise, ...) only from inside setup/draw, i.e. after p5
   has bound them.

   The iterative order — woven → grown → molten → constructed → emergent —
   is the motifs array below; adding a sixth motif is one subclass in
   motifs.js plus one entry here. Nothing else changes.
   ============================================================================ */

import { ColorHarmony } from './palette.js';
import { ShapeAtlas } from './shapes.js';
import { Motif, CelticMotif, BotanicalMotif, FluidMotif, GirihMotif, AutomataMotif } from './motifs.js';
import { Sonifier } from './audio.js';
import { QuakeFeed } from './data.js';
import { Hud } from './hud.js';
import { ViewState, MandalaEngine } from './engine.js';

const view    = new ViewState();
const palette = new ColorHarmony(38);
const shapes  = new ShapeAtlas();
const motifs  = [
  new CelticMotif(view, shapes),
  new BotanicalMotif(view, shapes),
  new FluidMotif(view, shapes),
  new GirihMotif(view, shapes),
  new AutomataMotif(view, shapes),
];
const engine = new MandalaEngine({
  view, palette, shapes, motifs,
  feed: new QuakeFeed(),
  sonifier: new Sonifier({ bpm: 184, penta: [0, 3, 5, 7, 10] }),
  hud: new Hud(),
});

/* p5 global-mode lifecycle hooks */
window.setup         = () => engine.setup();
window.draw          = () => engine.draw();
window.windowResized = () => engine.windowResized();
window.keyPressed    = () => engine.keyPressed();
window.mousePressed  = () => engine.mousePressed();

/* exposed for console poking / headless smoke tests */
window.SEISMA = { engine, Motif };
