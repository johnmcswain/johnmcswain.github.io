#!/usr/bin/env node
// check_globals.js — build-pipeline guard for p5.js 2.x global collisions.
//
// p5 2.x in global mode defines its API onto window via Object.defineProperty.
// Top-level `function`/`var` declarations in a sketch create NON-CONFIGURABLE
// window properties, so any name shared with p5's registry crashes p5 at boot:
//   "Uncaught TypeError: Cannot redefine property: <name>"
// (Discovered the hard way when our worldToScreen collided with the one p5 2.x
// added.) Run this against the unminified p5.js of the pinned version before
// shipping. Exits nonzero on any collision.
//
// Usage: node check_globals.js <sketch.js> <p5.js>
'use strict';
const fs = require('fs');

const [sketchPath, p5Path] = process.argv.slice(2);
if (!sketchPath || !p5Path) {
  console.error('usage: node check_globals.js <sketch.js> <p5.js (unminified)>');
  process.exit(2);
}
const sketch = fs.readFileSync(sketchPath, 'utf8');
const p5src = fs.readFileSync(p5Path, 'utf8');

// p5's global-mode surface: p5.prototype members plus fn.* registrations
const p5names = new Set();
for (const m of p5src.matchAll(/p5\.prototype\.([A-Za-z_$][\w$]*)\s*=/g)) p5names.add(m[1]);
for (const m of p5src.matchAll(/fn\.([A-Za-z_$][\w$]*)\s*=/g)) p5names.add(m[1]);

// our top-level declarations
const ours = new Set();
for (const m of sketch.matchAll(/^(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) ours.add(m[1]);
for (const m of sketch.matchAll(/^(?:let|const|var)\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)/gm))
  m[1].split(',').forEach(n => ours.add(n.trim()));

// lifecycle hooks are meant to be user-defined
const hooks = new Set(['setup', 'draw', 'preload', 'windowResized', 'mousePressed',
  'mouseDragged', 'mouseReleased', 'mouseMoved', 'mouseClicked', 'doubleClicked',
  'mouseWheel', 'keyPressed', 'keyReleased', 'keyTyped',
  'touchStarted', 'touchMoved', 'touchEnded', 'deviceMoved', 'deviceTurned', 'deviceShaken']);

const collisions = [...ours].filter(n => !hooks.has(n) && p5names.has(n));
if (collisions.length) {
  console.error('GLOBAL COLLISIONS with p5 registry (' + p5names.size + ' names): ' +
                collisions.join(', '));
  process.exit(1);
}
console.log('globals clean — ' + ours.size + ' sketch names checked against ' +
            p5names.size + ' p5 registry names');
