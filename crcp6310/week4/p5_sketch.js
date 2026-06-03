// ════════════════════════════════════════════════════════════════════════════
//  ENTROPY / CPU PRESSURE VISUALIZER
//  Author: John McSwain
//  Live site: https://johnmcswain.github.io/crcp6310/week4/entropy_pressure_visualizer.html
//  GitHub: https://github.com/johnmcswain/crcp6310/blob/main/week4/p5_sketch.js
// ────────────────────────────────────────────────────────────────────────────
//  INSPIRATION
//  This sketch is the inverse of a strange-attractor study. Its ancestor wove
//  particles along deterministic chaotic systems — Aizawa and Thomas (3D flows),
//  Clifford and de Jong (2D maps) — where intricate, organic motion fell out of
//  *known* equations iterated forward. Beautiful, but fully predictable: same
//  seed, same picture, forever.
//
//  Here the randomness is taken from the machine itself. Rather than a chaotic
//  map, the field is driven by live, genuinely unpredictable signals harvested
//  from the running computer: how hard the CPU is working, how fast the mouse is
//  moving, how unevenly frames are landing, and the low bits of the high-res
//  clock. The piece "listens" to the computer under load and renders that
//  pressure as a flowing field — stress the machine and it runs hot and
//  agitated; leave it idle and it cools to a slow drift. Deterministic chaos was
//  the muse; observed entropy is the medium.
//
//  ENTROPY  (the source of randomness, 0..1)
//      entropy = cpuPressure * 0.35    PressureObserver, or fps-fallback
//              + mouseEnergy  * 0.20    cursor velocity
//              + frameJitter  * 0.20    variance of frame delta-times
//              + timeEntropy  * 0.25    high-res clock hash ("system time")
//  Smoothed entropy drives the visuals (motion, line length, heat, trail decay).
//  The raw per-frame signals are folded into a 32-bit pool that seeds a
//  mulberry32 generator, erand(), which supplies every discrete random choice —
//  so even *which* style a click lands on is decided by the machine's recent
//  state. noiseSeed() is deliberately never reseeded mid-run; doing so would
//  strobe the flow field. The entropy steers the field, it doesn't scramble it.
//
//  STYLES  (click to change — shared vocabulary with the attractor-weave)
//  Five palettes carried over from the weave — EMBER, ICE, ORCHID, FOREST, GOLD
//  (HSB, dark-tinted backgrounds, glowing thread colors). Each sets a render
//  idiom borrowed from the weave: "thread" draws each particle's recent path as
//  a smooth curveVertex ribbon (the weave's flows), "cloud" scatters POINTS (its
//  maps). On top of either, a grid-bucketed proximity weave joins nearby heads
//  with a breathing radius — the weave's signature, now reactive to entropy. A
//  click reseeds the whole system (new palette, mode, re-dressed threads), the
//  way a click reseeded the weave; the shockwave ring marks the switch.
//
//  CONTROLS
//      click ........ change style (+ shockwave)      space ... pulse only
//      ↑ / ↓ ........ add / remove particles          ← / → ... flow swirl
//      wheel ........ zoom the noise field            R ....... reset swirl/zoom
//      hover to pull toward the cursor · hold to stir (force ∝ mouse velocity)
//
//  P5.JS SKETCHBOOK NOTES
//  Pure p5 global mode — no dependencies beyond p5, no localStorage, no build
//  step — so it drops straight into editor.p5js.org: paste everything below this
//  comment into sketch.js (the editor's own index.html already loads the p5
//  library and links the file). Live CPU data needs Chromium/Edge 125+ in a
//  secure context (https or localhost); anywhere else — including the editor's
//  preview iframe — it silently falls back to fps-derived pressure.
// ════════════════════════════════════════════════════════════════════════════

let cpuState = "unknown";
let cpuScore = 0.15;
let cpuSource = "not connected";
let lastPressureUpdate = 0;

let fpsSmoothed = 60;
let particles = [];
const MAXP = 600, MINP = 40;

const stateScores = { nominal: 0.15, fair: 0.4, serious: 0.7, critical: 1.0, unknown: 0.25 };

// ── entropy state ───────────────────────────────────────────────────────────
let entropy = 0.2, entropyRaw = 0.2;
let mouseEnergy = 0, frameJitter = 0, timeEntropy = 0;
let dtMean = 16.7, lastMx = 0, lastMy = 0;
let injection = 0;                 // click energy spike, decays
let pool = 0x9e3779b9 >>> 0;       // entropy pool (uint32)
// smoothed copies for a non-flickery HUD
let hudMouse = 0, hudFrame = 0, hudTime = 0;

// ── interaction state ─────────────────────────────────────────────────────
let userNoiseScale = 1.0;          // wheel zoom
let flowSwirl = 0;                 // ← / →
let ripples = [];

// ── visual styles: the attractor-weave palettes, HSB [hue, sat, bri] ─────────
// hues = per-particle thread colors (picked from the pool); glow = ring/ripple
// hue; mode "thread" = smooth curveVertex trails (weave flows), "cloud" =
// POINTS scatter (weave maps); both get the proximity weave. bg = trail tint.
const STYLES = [
  { name: "EMBER",  bg: [14, 45, 7],  hues: [16, 32, 8, 345],     glow: 30,  mode: "thread", rings: false, angMul: 4, trailLen: 16 },
  { name: "ICE",    bg: [205, 50, 7], hues: [190, 205, 168, 225], glow: 195, mode: "thread", rings: true,  angMul: 4, trailLen: 18 },
  { name: "ORCHID", bg: [288, 40, 9], hues: [300, 322, 262, 205], glow: 305, mode: "cloud",  rings: false, angMul: 5, trailLen: 4  },
  { name: "FOREST", bg: [150, 42, 6], hues: [120, 95, 160, 52],   glow: 120, mode: "thread", rings: false, angMul: 5, trailLen: 16 },
  { name: "GOLD",   bg: [35, 48, 6],  hues: [42, 30, 18, 8],      glow: 40,  mode: "cloud",  rings: true,  angMul: 6, trailLen: 4  }
];
let styleIdx = 0, style = STYLES[0];

function pickHue() { return style.hues[Math.floor(erand() * style.hues.length)]; }

function nextStyle() {            // a new "system": new palette + mode, like the weave's reseed
  let ni = styleIdx;
  while (ni === styleIdx && STYLES.length > 1) ni = floor(erand() * STYLES.length);
  styleIdx = ni; style = STYLES[styleIdx];
  for (const p of particles) { p.hue = pickHue(); p.trail.length = 0; }  // re-dress every thread
}
function pulseAt(x, y) {          // shockwave ring + discrete entropy spike
  ripples.push({ x, y, born: millis(), strength: 4 + entropy * 7, seed: erand() * 10 });
  injection += 0.45;
}

// ── entropy pool: fold a [0,1] value in, then a mulberry32 step out ─────────
function mixPool(v) {
  v = constrain(v, 0, 1);
  let x = (v * 4294967296) >>> 0;
  pool = (pool ^ (x + 0x6D2B79F5 + ((pool << 6) >>> 0) + (pool >>> 2))) >>> 0;
}
function erand() {                 // mulberry32, advances the live pool
  pool = (pool + 0x6D2B79F5) >>> 0;
  let t = Math.imul(pool ^ (pool >>> 15), 1 | pool);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);   // weave's color space; HUD switches to RGB locally
  textFont("monospace");
  lastMx = width / 2; lastMy = height / 2;
  styleIdx = floor(random(STYLES.length)); style = STYLES[styleIdx];
  spawn(180);
  startCpuPressure();
}

function spawn(n) {
  for (let i = 0; i < n && particles.length < MAXP; i++) {
    particles.push({
      x: erand() * width, y: erand() * height,
      a: erand() * TWO_PI, r: 20 + erand() * 160,
      speed: 0.002 + erand() * 0.013,
      hue: pickHue(), trail: []
    });
  }
}
function despawn(n) { particles.splice(0, min(n, max(0, particles.length - MINP))); }

async function startCpuPressure() {
  if (!("PressureObserver" in window)) {
    cpuSource = "fallback: no PressureObserver"; return;
  }
  try {
    const sources = PressureObserver.knownSources || [];
    if (sources.length && !sources.includes("cpu")) {
      cpuSource = "fallback: CPU source unavailable"; return;
    }
    const observer = new PressureObserver((records) => {
      const latest = records[records.length - 1];
      cpuState = latest.state;
      cpuScore = stateScores[cpuState] ?? 0.25;
      cpuSource = "live: Compute Pressure API";
      lastPressureUpdate = millis();
    });
    await observer.observe("cpu", { sampleInterval: 1000 });
  } catch (err) {
    cpuSource = "fallback: " + err.name;
  }
}

function draw() {
  // trailing wash (low alpha = woven buildup, like the weave); tint from style
  background(style.bg[0], style.bg[1], style.bg[2], map(entropy, 0, 1, 0.14, 0.06));

  updateFallbackPressure();
  updateEntropy();
  drawPressureField(entropy);
  drawRipples();
  drawHUD();
}

// ── CPU pressure (live PressureObserver, else fps-derived) ──────────────────
function updateFallbackPressure() {
  fpsSmoothed = lerp(fpsSmoothed, frameRate(), 0.05);
  if (cpuSource.startsWith("live")) return;
  const fpsStress = constrain(map(fpsSmoothed, 60, 20, 0.15, 1.0), 0.15, 1.0);
  cpuScore = lerp(cpuScore, fpsStress, 0.04);
  if (cpuScore < 0.3) cpuState = "nominal";
  else if (cpuScore < 0.55) cpuState = "fair";
  else if (cpuScore < 0.82) cpuState = "serious";
  else cpuState = "critical";
}

// ── harvest the four entropy signals, blend, and stir the pool ──────────────
function updateEntropy() {
  // mouse velocity -> mouseEnergy
  const mvx = mouseX - lastMx, mvy = mouseY - lastMy;
  const speed = Math.hypot(mvx, mvy);
  mouseEnergy = constrain(lerp(mouseEnergy, map(speed, 0, 35, 0, 1, true), 0.25), 0, 1);
  lastMx = mouseX; lastMy = mouseY;

  // frame-delta variance -> frameJitter
  const dt = deltaTime;
  dtMean = lerp(dtMean, dt, 0.05);
  const j = Math.abs(dt - dtMean) / Math.max(dtMean, 1);
  frameJitter = constrain(lerp(frameJitter, j * 4, 0.2), 0, 1);

  // high-res clock hash -> timeEntropy ("system time")
  const now = performance.now();
  let h = Math.sin(now * 0.911 + frameCount * 0.137) * 43758.5453;
  timeEntropy = h - Math.floor(h);

  // weighted blend (sums to 1.0; delete the time line for your 0.75 version)
  entropyRaw = cpuScore * 0.35
             + mouseEnergy * 0.20
             + frameJitter * 0.20
             + timeEntropy * 0.25
             + injection;
  entropy = lerp(entropy, constrain(entropyRaw, 0, 1), 0.08);
  injection *= 0.92;

  // fold live signals into the PRNG pool so erand() is genuinely seeded by them
  mixPool(cpuScore); mixPool(mouseEnergy); mixPool(frameJitter); mixPool(timeEntropy);
  mixPool((mouseX % 257) / 257); mixPool((now % 1000) / 1000);

  // smoothed copies for the HUD
  hudMouse = lerp(hudMouse, mouseEnergy, 0.1);
  hudFrame = lerp(hudFrame, frameJitter, 0.1);
  hudTime  = lerp(hudTime, timeEntropy, 0.05);
}

// ── the field, driven by entropy `e` — woven threads + clouds on dark ───────
function drawPressureField(e) {
  const cx = width / 2, cy = height / 2;
  const noiseScale = map(e, 0, 1, 0.002, 0.012) * userNoiseScale;
  const lineWeight = map(e, 0, 1, 0.5, 2.0);
  const move = map(e, 0, 1, 0.4, 3.6);
  const bri = map(e, 0, 1, 68, 100);          // entropy reads as heat -> brightness
  const maxD = max(width, height);

  const inside = mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;
  const pull = inside ? (mouseIsPressed ? 6.0 : 1.3) : 0;
  const stir = (inside && mouseIsPressed) ? mouseEnergy * 5.0 : 0;

  const heads = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const n = noise(p.x * noiseScale, p.y * noiseScale, frameCount * 0.006);
    const angle = n * TWO_PI * style.angMul + frameCount * p.speed + flowSwirl;

    p.x += cos(angle) * move;
    p.y += sin(angle) * move;

    if (pull > 0) {                            // cursor well: pull + tangential stir
      const dx = mouseX - p.x, dy = mouseY - p.y;
      const md = Math.hypot(dx, dy) + 1e-3;
      if (md < 260) {
        const f = (1 - md / 260);
        p.x += (dx / md) * f * pull;  p.y += (dy / md) * f * pull;
        p.x += (-dy / md) * f * stir; p.y += (dx / md) * f * stir;
      }
    }

    for (const rp of ripples) {                // shockwaves shove threads outward
      const rad = (millis() - rp.born) * 0.6;
      const dd = dist(p.x, p.y, rp.x, rp.y) + 1e-3;
      const band = Math.abs(dd - rad);
      if (band < 40) {
        const f = rp.strength * (1 - band / 40);
        p.x += ((p.x - rp.x) / dd) * f;  p.y += ((p.y - rp.y) / dd) * f;
      }
    }

    // wrap; clear the trail so a thread never streaks across the canvas
    let wrapped = false;
    if (p.x < -50) { p.x = width + 50; p.y = erand() * height; wrapped = true; }
    else if (p.x > width + 50) { p.x = -50; p.y = erand() * height; wrapped = true; }
    if (p.y < -50) { p.y = height + 50; p.x = erand() * width; wrapped = true; }
    else if (p.y > height + 50) { p.y = -50; p.x = erand() * width; wrapped = true; }
    if (wrapped) p.trail.length = 0;

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > style.trailLen) p.trail.shift();

    const d = dist(p.x, p.y, cx, cy);
    const a = map(d, 0, maxD, 0.6, 0.07);

    if (style.mode === "cloud") {              // weave's "map" idiom: scattered points
      stroke(p.hue, 62, bri, a * 1.3);
      strokeWeight(map(e, 0, 1, 1.6, 3.4));
      beginShape(POINTS);
      vertex(p.x, p.y);
      endShape();
    } else {                                   // weave's "flow" idiom: smooth thread
      noFill();
      stroke(p.hue, 68, bri, a);
      strokeWeight(lineWeight);
      beginShape();
      curveVertex(p.trail[0].x, p.trail[0].y);
      for (const t of p.trail) curveVertex(t.x, t.y);
      const tl = p.trail[p.trail.length - 1];
      curveVertex(tl.x, tl.y);
      endShape();
    }
    heads.push({ x: p.x, y: p.y, hue: p.hue, idx: i });
  }

  weave(heads, e);                             // proximity thread-weaving

  if (style.rings) {                           // faint concentric vertex contours
    noFill();
    stroke(style.glow, 45, 90, map(e, 0, 1, 0.10, 0.35));
    strokeWeight(1);
    for (let r = 80; r < width * 0.8; r += 45) {
      beginShape();
      for (let a = 0; a < TWO_PI; a += 0.04) {
        const wob = noise(cos(a) + 3, sin(a) + 3, frameCount * 0.01);
        const rr = r + wob * 80 * e;
        vertex(cx + cos(a) * rr, cy + sin(a) * rr);
      }
      endShape(CLOSE);
    }
  }
}

// ── proximity thread-weaving (the weave's signature), grid-bucketed so it ───
// stays cheap at high particle counts; radius breathes; density tracks entropy.
function weave(heads, e) {
  const minD = min(width, height);
  const breath = 0.5 + 0.5 * sin(frameCount * 0.02);
  const r = minD * (0.03 + 0.022 * breath);
  const r2 = r * r, cell = max(r, 1);
  const grid = new Map();
  for (const hh of heads) {
    const key = Math.floor(hh.x / cell) + "," + Math.floor(hh.y / cell);
    let arr = grid.get(key); if (!arr) { arr = []; grid.set(key, arr); } arr.push(hh);
  }
  strokeWeight(0.6); noFill();
  for (const hh of heads) {
    const gx = Math.floor(hh.x / cell), gy = Math.floor(hh.y / cell);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const arr = grid.get((gx + ox) + "," + (gy + oy)); if (!arr) continue;
      for (const o of arr) {
        if (o.idx <= hh.idx) continue;         // dedup pairs + skip self
        const dx = hh.x - o.x, dy = hh.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const close = 1 - Math.sqrt(d2) / r;
        stroke((hh.hue + o.hue) / 2 % 360, 50, 100, 0.26 * close * (0.45 + 0.55 * e));
        beginShape(); vertex(hh.x, hh.y); vertex(o.x, o.y); endShape();
      }
    }
  }
}

// ── click shockwaves: expanding wobble rings, then retire ───────────────────
function drawRipples() {
  noFill();
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i];
    const rad = (millis() - rp.born) * 0.6;
    const maxR = max(width, height) * 1.1;
    if (rad > maxR) { ripples.splice(i, 1); continue; }
    const fade = 1 - rad / maxR;
    stroke(style.glow, 55, 100, 0.8 * fade);
    strokeWeight(1.5 * fade + 0.4);
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.06) {
      const wob = noise(cos(a) + rp.seed, sin(a) + rp.seed, rad * 0.01);
      const rr = rad + wob * 26;
      vertex(rp.x + cos(a) * rr, rp.y + sin(a) * rr);
    }
    endShape(CLOSE);
  }
}

// ── HUD: original CPU panel + entropy breakdown + controls ──────────────────
function drawHUD() {
  const x = 24, y = 30, barW = 280, barH = 12, pad = 12;
  push();
  colorMode(RGB, 255, 255, 255, 255);   // HUD stays RGB while the canvas is HSB

  noStroke();
  fill(0, 185);
  rect(x - pad, y - 20, barW + 200, 214, 8);

  fill(240); textSize(13);
  text("CPU PRESSURE · ENTROPY MONITOR", x, y);

  // CPU bar
  fill(80); rect(x, y + 12, barW, barH);
  fill(235); rect(x, y + 12, barW * cpuScore, barH);
  fill(210); textSize(12);
  text(`state ${cpuState}   score ${nf(cpuScore, 1, 2)}`, x, y + 44);
  text(`source ${cpuSource}`, x, y + 62);

  // entropy bar (heat-colored like the field)
  fill(200); text("ENTROPY", x, y + 92);
  fill(40, 50, 70); rect(x, y + 100, barW, barH);
  fill(80 + entropy * 175, 140, 255 - entropy * 120);
  rect(x, y + 100, barW * entropy, barH);
  fill(225);
  text(`entropy ${nf(entropy, 1, 2)}    fps ${nf(fpsSmoothed, 2, 0)}`, x, y + 130);

  // contribution breakdown
  fill(150); textSize(11);
  text(`cpu ${nf(cpuScore * 0.35, 1, 2)}   `
     + `mouse ${nf(hudMouse * 0.20, 1, 2)}   `
     + `frame ${nf(hudFrame * 0.20, 1, 2)}   `
     + `time ${nf(hudTime * 0.25, 1, 2)}`, x, y + 150);

  // active style + controls
  fill(185, 205, 255); textSize(11);
  text(`style ${style.name} · ${style.mode}${style.rings ? " · rings" : ""}`, x, y + 168);
  fill(120);
  text("click restyle · space pulse · ↑↓ count · ←→ swirl · wheel zoom · R reset", x, y + 188);
  pop();
}

// ── input ───────────────────────────────────────────────────────────────────
function keyPressed() {
  if (keyCode === UP_ARROW)    { spawn(20); return false; }
  if (keyCode === DOWN_ARROW)  { despawn(20); return false; }
  if (keyCode === LEFT_ARROW)  { flowSwirl = constrain(flowSwirl - 0.12, -PI, PI); return false; }
  if (keyCode === RIGHT_ARROW) { flowSwirl = constrain(flowSwirl + 0.12, -PI, PI); return false; }
  if (key === ' ')             { pulseAt(mouseX, mouseY); return false; }
  if (key === 'r' || key === 'R') { flowSwirl = 0; userNoiseScale = 1.0; ripples = []; }
}
function mousePressed() {
  nextStyle();                   // ← click changes the graphics style
  pulseAt(mouseX, mouseY);       //   with a shockwave to mark the switch
}
function mouseWheel(e) {
  userNoiseScale = constrain(userNoiseScale * (1 - e.delta * 0.001), 0.4, 2.5);
  return false;                  // don't scroll the page
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }
