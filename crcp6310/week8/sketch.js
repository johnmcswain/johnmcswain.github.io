// CRCP 6310 — Week 9: Dynamic Weather System (v0.10 — p5.js 2.x)
// STORM OBSERVATORY — live Blitzortung.org lightning (or a synthetic storm,
// [S] to toggle) driving a 3-layer wind volume, rendered as an orbitable
// WEBGL volume with all three altitude planes interactable; organic cloud
// masses and wind-sheared rain complete the weather scene. Plane labels and
// strike telemetry are DOM elements pinned to 3D positions via
// projectToScreen() — the picking raycast run backwards.
//
// Rendering note: p5 WEBGL immediate mode pays per-primitive overhead, so
// glyphs, rain, debris edges, and charge quads are batched into single
// beginShape(LINES)/(QUADS) calls — ~10 draw calls/frame instead of ~2,700.
// John McSwain
//
// Dimensionality ladder (MLO 9.2):
//   3D  windU/windV[layer][row][col]  — volumetric wind field (x / z components)
//   2D  charge[row][col]              — ground charge scalar field
//   1D  particles[i]                  — flat pool of debris particles
//
// 3D interaction model:
//   drag        orbit camera          scroll      dolly zoom
//   [1][2][3]   select active plane   click       strike ON the active plane
//   Elevated strikes are intra-cloud: they hammer their own layer and
//   attenuate up/down through the volume. Only ground strikes (SFC)
//   deposit charge. Mouse position is raycast onto the active plane
//   (hand-rolled unprojection — p5 WEBGL has no built-in picking).
//
// World frame: field lies on the XZ plane, altitude runs along -Y
// (p5 WEBGL's screen-down +Y convention). Layer l sits at y = -l * layerGap.

'use strict';

// ---------------------------------------------------------------- CONFIG
const CONFIG = {
  field: { cols: 26, rows: 26, layers: 3 },
  world: { fieldW: 900, layerGap: 150 },
  // palette after Utopia Must Fall's phosphor sections: neon green /
  // hot magenta / electric blue, with the system-orange as charge accent
  layerMeta: [
    { name: 'SFC   ', col: [64, 255, 128],  baseSpeed: 0.35, dirOffset: 0.00, ringSpeed: 2.2 },
    { name: '850hPa', col: [255, 72, 216],  baseSpeed: 0.70, dirOffset: 0.55, ringSpeed: 3.2 },
    { name: '500hPa', col: [88, 148, 255],  baseSpeed: 1.15, dirOffset: 1.10, ringSpeed: 4.6 },
  ],
  // impulse attenuation by layer distance from the strike layer
  layerAtten: [1.0, 0.55, 0.28],
  impulseDecay: 0.93,
  noiseScale: 0.09,
  meanderSpeed: 0.00012,

  chargeGrid: { cols: 34, rows: 34 },
  chargeDecay: 0.988,
  chargeCol: [255, 148, 44],

  particles: {
    count: 240,
    gravity: 0.0045,
    zDamping: 0.55,           // Greenberg floor bounce, altitude edition
    xyFriction: 0.86,
    windCoupling: 0.055,
    strikeKickZ: 0.11,
    strikeKickXY: 1.6,
    strikeRadius: 120,        // world units
  },

  storm: {
    cellCount: 3,
    baseRate: [0.6, 2.2],
    sigma: [45, 90],
    cellSpeed: 0.30,
    cellLife: [1800, 3600],
    groundFraction: 0.5,      // CG vs intra-cloud split (real skies skew IC)
  },

  // Blitzortung.org live feed. Community-run network; their guidelines ask
  // that websocket access stay low-traffic, so: no auto-connect by default,
  // one socket, closed when leaving live mode. Flip autoConnect for demos.
  live: {
    servers: ['wss://ws1.blitzortung.org/', 'wss://ws7.blitzortung.org/',
              'wss://ws8.blitzortung.org/', 'wss://ws3.blitzortung.org/'],
    region: { name: 'TX / GULF SOUTH', latMin: 24, latMax: 40, lonMin: -107, lonMax: -85 },
    maxPerSec: 8,             // inject cap; extras counted as dropped
    autoConnect: false,
  },

  ring: { life: 90, band: 20, impulse: 0.9 },

  // lightning channel: generated once per strike, animated in three phases —
  // stepped leader (dim, descending) -> return stroke (bright, ground-to-cloud,
  // with flicker re-strikes) -> phosphor afterglow (skiatron persistence)
  bolt: {
    leaderFrames: 14, returnFrames: 24, glowFrames: 48,
    depth: 5,                  // midpoint-displacement recursion
    displace: 0.42,            // lateral jitter as fraction of segment length
    branchChance: 0.3,         // per split, scaled by strike amplitude
    maxOrder: 2,               // branch -> sub-branch, no deeper
    maxSegs: 220, maxActive: 10,
    pulses: [[0, 1.0], [8, 0.6], [15, 0.38]],   // return-stroke flickers [frame, amp]
    leaderCol: [190, 205, 255],
    glowCol: [152, 244, 200],
  },

  // organic elements: noise-perturbed cloud masses + wind-sheared rain
  clouds: {
    lobes: 3, verts: 30,
    baseAlt: 1.45, lobeAltStep: 0.22,   // in layer units (850→500hPa band)
    radiusScale: 2.0, noiseAmp: 0.55,
    breathe: 0.5,                       // size swells with cell intensity
    col: [158, 172, 206],
  },
  rain: {
    pool: 420,                          // recycled — zero steady-state allocation
    terminal: 0.020,                    // fall speed, layer units / frame
    coupling: 0.12, windGain: 1.15,     // horizontal shear from the 3D field
    minIntensity: 0.45,                 // cells rain only when worked up
    spawnPerFrame: 5,
    streak: 3.2,
    col: [140, 232, 255],
  },

  cam: { radius: 1500, azimuth: -0.7, elevation: 0.62,
         minR: 550, maxR: 3200, minEl: 0.12, maxEl: 1.35 },
  idle: { delayMs: 10000, rampMs: 3000, speed: 0.0012 },   // auto-orbit when untouched

  // Thunder: delay/filter/gain are PROPORTIONAL to distance but on a
  // compressed timebase (~6 s at the far corner) — physically real delays at
  // Gulf scale would run to minutes. Relative truth kept, absolute dramatized.
  // Drone: real Schumann-mode ratios (7.83/14.3/20.8/27.3/33.8 Hz), octave-
  // shifted x8 into audibility; strike rate opens it, each strike pumps it.
  audio: {
    masterGain: 0.9,
    delayPerUnit: 0.0048,       // s per field unit (compressed timebase)
    maxVoices: 14,
    droneBase: 62.64,           // 7.83 Hz x 8
    droneRatios: [1, 1.826, 2.656, 3.486, 4.317],
    droneGains: [0.16, 0.09, 0.055, 0.038, 0.024],
    droneLevel: 0.09,
  },

  geoCol: [124, 214, 255],   // reference outline, phosphor cyan

  bg: [10, 14, 20],
};

// lat/lon -> field coordinates (north = -z). Shared by live strikes and the
// reference outline, so strikes land on the map correctly BY CONSTRUCTION.
function geoToField(lat, lon) {
  const R = CONFIG.live.region;
  return {
    x: ((lon - R.lonMin) / (R.lonMax - R.lonMin)) * CONFIG.world.fieldW - halfW,
    z: halfW - ((lat - R.latMin) / (R.latMax - R.latMin)) * CONFIG.world.fieldW,
  };
}

// Geographic reference: US state boundaries (us-atlas, Census 10m) +
// Mexico coast (world-atlas 50m), clipped to the live region window and
// simplified. Format: polylines of [lat, lon]. Generated by build_outline.js.
const GEO_OUTLINE = [[[30.24,-88.33],[30.25,-88.08],[30.24,-88.33]],[[35,-88.2],[34.98,-85.61],[32.87,-85.19],[32.52,-85.01]],[[32.18,-85.01],[31.84,-85.14],[31.52,-85.05],[31.19,-85.11],[31,-85],[31,-87.6],[30.85,-87.63],[30.67,-87.4],[30.53,-87.45],[30.44,-87.37],[30.3,-87.47],[30.23,-88],[30.29,-87.76],[30.41,-87.91],[30.62,-87.91],[30.68,-88.01],[30.32,-88.14],[30.37,-88.4],[31.89,-88.47],[34.89,-88.1],[35,-88.2]],[[39.68,-102.05],[36.99,-102.04],[37,-106.88]],[[29.72,-85.12],[29.62,-85.01]],[[29.6,-85],[29.66,-85.35],[29.84,-85.42],[29.88,-85.39],[29.69,-85.34],[29.81,-85.3],[29.95,-85.43],[30.24,-85.92],[30.36,-86.3],[30.39,-86.75],[30.28,-87.52],[30.44,-87.37],[30.53,-87.45],[30.67,-87.4],[30.87,-87.63],[31,-87.6],[31,-85]],[[34.98,-85.61],[34.98,-85.47]],[[31,-85],[31.19,-85.11],[31.52,-85.05],[31.84,-85.14],[32.18,-85.01]],[[32.52,-85.01],[32.87,-85.19],[34.98,-85.61]],[[38.73,-85.1],[38.71,-85.45],[38.54,-85.42],[38.44,-85.61],[38.3,-85.67],[38.28,-85.83],[38.03,-85.92],[37.96,-86.05],[38.06,-86.27],[38.14,-86.27],[38.19,-86.37],[38.13,-86.33],[38.1,-86.46],[37.93,-86.51],[37.84,-86.64],[37.99,-86.79],[37.92,-87.01],[37.78,-87.13],[37.94,-87.38],[37.91,-87.5],[37.97,-87.6],[37.83,-87.63],[37.9,-87.68],[37.92,-87.9],[37.77,-87.95],[37.8,-88.07],[38.05,-88.04],[38.15,-87.93],[38.25,-87.99],[38.28,-87.85],[38.74,-87.49],[38.86,-87.55],[38.95,-87.51],[39.17,-87.64],[39.35,-87.53],[40,-87.53]],[[39.95,-95.25],[39.88,-95.14],[39.89,-94.93],[39.73,-94.87],[39.75,-94.96],[39.53,-95.1],[39.38,-94.88],[39.22,-94.83],[39.16,-94.59],[37,-94.62],[36.99,-102.04],[39.68,-102.05]],[[37,-103],[37,-94.62],[36.5,-94.62],[35.39,-94.43],[33.64,-94.49],[33.75,-94.87],[33.86,-94.97],[33.96,-95.23],[33.88,-95.29],[33.93,-95.6],[33.83,-95.83],[33.89,-95.94],[33.84,-96.15],[33.76,-96.18],[33.69,-96.36],[33.85,-96.63],[33.89,-96.59],[33.83,-96.77],[33.96,-96.92],[33.85,-97.09],[33.82,-97.05],[33.72,-97.12],[33.92,-97.21],[33.82,-97.44],[33.9,-97.46],[33.9,-97.56],[33.99,-97.66],[33.86,-97.84],[33.88,-97.97],[33.99,-97.95],[34,-98.09],[34.15,-98.11],[34.16,-98.36],[34.06,-98.49],[34.16,-98.65],[34.22,-99.19],[34.4,-99.26],[34.46,-99.38],[34.38,-99.4],[34.39,-99.71],[34.58,-99.93],[34.56,-100],[36.5,-100],[36.5,-103],[37,-103]],[[36.5,-103],[36.5,-100],[34.56,-100],[34.58,-99.93],[34.39,-99.71],[34.38,-99.4],[34.46,-99.38],[34.4,-99.26],[34.22,-99.19],[34.16,-98.65],[34.06,-98.49],[34.16,-98.36],[34.15,-98.11],[34,-98.09],[33.99,-97.95],[33.88,-97.97],[33.86,-97.84],[33.99,-97.66],[33.9,-97.56],[33.9,-97.46],[33.82,-97.44],[33.92,-97.21],[33.72,-97.12],[33.82,-97.05],[33.85,-97.09],[33.96,-96.92],[33.83,-96.77],[33.89,-96.59],[33.85,-96.63],[33.69,-96.36],[33.76,-96.18],[33.84,-96.15],[33.89,-95.94],[33.83,-95.83],[33.93,-95.6],[33.88,-95.29],[33.96,-95.23],[33.86,-94.97],[33.75,-94.87],[33.64,-94.46],[33.55,-94.39],[33.55,-94.05],[31.99,-94.04],[31.77,-93.82],[31.6,-93.84],[31.52,-93.74],[31.17,-93.6],[31.18,-93.53],[31.02,-93.52],[30.82,-93.55],[30.54,-93.74],[30.07,-93.7],[29.8,-93.93],[29.68,-93.84],[29.65,-94.13],[29.37,-94.73],[29.38,-94.78],[29.48,-94.67],[29.52,-94.49],[29.55,-94.77],[29.69,-94.69],[29.78,-94.76],[29.68,-94.87],[29.7,-94.94],[29.56,-95.02],[29.5,-94.91],[29.31,-94.89],[29.19,-95.16],[29.11,-95.17],[29.34,-94.82],[29.33,-94.73],[28.87,-95.38],[28.42,-96.34],[27.91,-97],[27.43,-97.3],[27.15,-97.37],[26.8,-97.35],[26.08,-97.16],[26.54,-97.28],[26.56,-97.37],[26.58,-97.3],[26.89,-97.4],[27.35,-97.36],[27.91,-97.08],[28.09,-96.92],[28.4,-96.42],[28.31,-96.68],[28.41,-96.77],[28.22,-96.8],[28.12,-96.93],[28.19,-97.04],[28.13,-97.15],[28.08,-97.21],[28.11,-97.05],[28.04,-97.02],[27.83,-97.19],[27.88,-97.49],[27.7,-97.25],[27.32,-97.41],[27.28,-97.51],[27.36,-97.52],[27.27,-97.64],[27.26,-97.42],[26.61,-97.44],[26.27,-97.28],[26.15,-97.3],[26.06,-97.15],[25.95,-97.15],[25.85,-97.44],[26.02,-97.65],[26.06,-98.2],[26.22,-98.46],[26.24,-98.65],[26.36,-98.8],[26.4,-99.08],[26.84,-99.27],[27.02,-99.45],[27.25,-99.44],[27.31,-99.54],[27.56,-99.51],[27.8,-99.88],[27.98,-99.93],[28.28,-100.29],[28.5,-100.34],[28.66,-100.5],[29.25,-100.8],[29.46,-101.06],[29.52,-101.26],[29.63,-101.25],[29.57,-101.29],[29.76,-101.41],[29.79,-102.05],[29.88,-102.3],[29.77,-102.39],[29.74,-102.67],[29.52,-102.81],[29.21,-102.89],[29.18,-102.99],[28.99,-103.12],[28.98,-103.28],[29.32,-104.04],[29.64,-104.51],[29.92,-104.68],[30.24,-104.71],[30.39,-104.86],[30.6,-104.92],[30.86,-105.4],[31.37,-105.95],[31.47,-106.21],[31.73,-106.38],[31.87,-106.64],[32,-106.62],[32,-103.07],[36.5,-103]],[[39.95,-91.44],[39.73,-91.37],[39.23,-90.72],[38.93,-90.66],[38.87,-90.59],[38.96,-90.41],[38.85,-90.11],[38.72,-90.21],[38.61,-90.18],[38.34,-90.37],[38.21,-90.36],[37.97,-89.94],[37.88,-89.95],[37.91,-89.85],[37.69,-89.52],[37.54,-89.52],[37.4,-89.42],[37.29,-89.52],[37.04,-89.38],[36.99,-89.29],[37.06,-89.26],[36.96,-89.1],[36.58,-89.21],[36.62,-89.37],[36.46,-89.45],[36.57,-89.48],[36.57,-89.56],[36.37,-89.51],[36.31,-89.61],[36.25,-89.53],[36.25,-89.69],[36.12,-89.6],[36,-89.73],[36,-90.38],[36.27,-90.08],[36.39,-90.06],[36.5,-90.15],[36.5,-94.62],[39.16,-94.59],[39.22,-94.83],[39.38,-94.88],[39.53,-95.1],[39.75,-94.96],[39.73,-94.87],[39.89,-94.93],[39.88,-95.14],[39.95,-95.25]],[[40,-87.53],[39.35,-87.53],[39.17,-87.64],[38.95,-87.51],[38.86,-87.55],[38.74,-87.49],[38.28,-87.85],[38.25,-87.99],[38.15,-87.93],[38.05,-88.04],[37.92,-88.07],[37.89,-88.01],[37.9,-88.1],[37.8,-88.03],[37.66,-88.16],[37.47,-88.08],[37.39,-88.48],[37.28,-88.52],[37.15,-88.42],[37.07,-88.46],[37.23,-88.98],[37.07,-89.17],[36.97,-89.17],[37.06,-89.26],[36.99,-89.29],[37.04,-89.38],[37.29,-89.52],[37.4,-89.42],[37.54,-89.52],[37.69,-89.52],[37.91,-89.85],[37.88,-89.95],[37.97,-89.94],[38.21,-90.36],[38.34,-90.37],[38.61,-90.18],[38.72,-90.21],[38.85,-90.11],[38.96,-90.41],[38.87,-90.59],[38.93,-90.66],[39.23,-90.72],[39.73,-91.37],[39.95,-91.44]],[[37,-106.88],[37,-103],[32,-103.07],[32,-106.62],[31.87,-106.64],[31.78,-106.53]],[[36.5,-94.62],[36.5,-90.15],[36.39,-90.06],[36.27,-90.08],[36,-90.38],[36,-89.73],[35.89,-89.66],[35.91,-89.74],[35.86,-89.77],[35.83,-89.7],[35.72,-89.96],[35.64,-89.85],[35.6,-89.95],[35.51,-89.92],[35.55,-90.03],[35.4,-90.06],[35.48,-90.09],[35.38,-90.18],[35.38,-90.08],[35.3,-90.17],[35.14,-90.06],[35.11,-90.18],[35.03,-90.21],[35.04,-90.3],[34.91,-90.25],[34.83,-90.42],[34.89,-90.48],[34.74,-90.45],[34.72,-90.5],[34.8,-90.51],[34.74,-90.57],[34.67,-90.47],[34.67,-90.59],[34.43,-90.57],[34.32,-90.66],[34.37,-90.75],[34.21,-90.85],[34.22,-90.94],[34.16,-90.81],[34.14,-90.95],[34.08,-90.87],[33.98,-90.96],[33.98,-91.08],[33.93,-91.01],[33.86,-91.07],[33.79,-90.99],[33.78,-91.14],[33.73,-91.15],[33.67,-91.03],[33.67,-91.23],[33.6,-91.13],[33.56,-91.23],[33.51,-91.18],[33.44,-91.23],[33.47,-91.12],[33.4,-91.21],[33.43,-91.06],[33.35,-91.14],[33.24,-91.1],[33.27,-91.04],[33.14,-91.09],[33.11,-91.2],[33.05,-91.12],[33,-91.17],[33.02,-94.04],[33.55,-94.05],[33.54,-94.36],[33.64,-94.49],[35.39,-94.43],[36.5,-94.62]],[[36.98,-89.13],[37.07,-89.17],[37.23,-88.98],[37.07,-88.46],[37.15,-88.42],[37.28,-88.52],[37.39,-88.48],[37.47,-88.08],[37.66,-88.16],[37.8,-88.03],[37.81,-87.9],[37.92,-87.9],[37.9,-87.68],[37.83,-87.63],[37.97,-87.6],[37.91,-87.5],[37.94,-87.38],[37.78,-87.13],[37.92,-87.01],[37.99,-86.79],[37.84,-86.64],[37.93,-86.51],[38.1,-86.46],[38.13,-86.33],[38.2,-86.35],[38.06,-86.27],[37.96,-86.05],[38.03,-85.92],[38.28,-85.83],[38.3,-85.67],[38.44,-85.61],[38.54,-85.42],[38.71,-85.45],[38.73,-85.1]],[[36.62,-85.03],[36.68,-88.07],[36.5,-88.05],[36.5,-89.42],[36.62,-89.37],[36.56,-89.26],[36.67,-89.16],[36.98,-89.13]],[[36.5,-89.49],[36.57,-89.56],[36.57,-89.48],[36.5,-89.49]],[[30.22,-88.51],[30.21,-88.4],[30.22,-88.51]],[[30.25,-88.77],[30.22,-88.59],[30.25,-88.77]],[[30.22,-88.99],[30.25,-88.88],[30.22,-88.99]],[[30.24,-89.16],[30.25,-89.06],[30.24,-89.16]],[[33,-91.17],[33.05,-91.12],[33.11,-91.2],[33.14,-91.09],[33.27,-91.04],[33.3,-91.14],[33.46,-91.08],[33.38,-91.17],[33.47,-91.12],[33.44,-91.23],[33.51,-91.18],[33.56,-91.23],[33.6,-91.13],[33.69,-91.22],[33.67,-91.03],[33.73,-91.15],[33.78,-91.14],[33.79,-90.99],[33.86,-91.07],[33.93,-91.01],[33.98,-91.08],[33.98,-90.96],[34.08,-90.87],[34.14,-90.95],[34.16,-90.81],[34.22,-90.94],[34.21,-90.85],[34.37,-90.75],[34.32,-90.66],[34.43,-90.57],[34.67,-90.59],[34.67,-90.47],[34.74,-90.57],[34.8,-90.51],[34.72,-90.5],[34.74,-90.45],[34.89,-90.48],[34.83,-90.42],[34.91,-90.25],[35,-90.31],[35,-88.2],[34.89,-88.1],[31.89,-88.47],[30.34,-88.41],[30.39,-88.97],[30.3,-89.29],[30.38,-89.31],[30.19,-89.45],[30.18,-89.57],[30.66,-89.85],[31,-89.75],[31,-91.64],[31.07,-91.56],[31.27,-91.64],[31.28,-91.51],[31.4,-91.58],[31.37,-91.47],[31.52,-91.52],[31.57,-91.41],[31.64,-91.5],[31.62,-91.4],[31.71,-91.4],[31.76,-91.26],[31.77,-91.36],[31.85,-91.34],[31.81,-91.26],[31.96,-91.19],[31.99,-91.09],[32.06,-91.16],[32.16,-91.01],[32.13,-91.17],[32.2,-91.16],[32.22,-90.99],[32.36,-90.88],[32.35,-90.99],[32.45,-90.99],[32.48,-91.11],[32.53,-91.1],[32.49,-90.99],[32.56,-91.08],[32.65,-91.03],[32.6,-91.14],[32.73,-91.06],[32.75,-91.17],[32.81,-91.16],[32.92,-91.06],[32.98,-91.09],[32.92,-91.21],[33,-91.17]],[[36,-89.73],[36.12,-89.6],[36.25,-89.69],[36.25,-89.53],[36.31,-89.61],[36.37,-89.51],[36.5,-89.54],[36.5,-88.05],[36.68,-88.07],[36.62,-85.03]],[[34.98,-85.47],[35,-90.31],[35.14,-90.06],[35.3,-90.17],[35.38,-90.08],[35.42,-90.17],[35.48,-90.09],[35.4,-90.06],[35.55,-90.03],[35.51,-89.92],[35.6,-89.95],[35.64,-89.85],[35.72,-89.96],[35.83,-89.7],[35.86,-89.77],[35.91,-89.74],[35.89,-89.66],[36,-89.73]],[[30.05,-88.88],[29.93,-88.82],[29.76,-88.86],[30.05,-88.88]],[[30.06,-89.34],[30.16,-89.19],[30,-89.23],[30.06,-89.34]],[[29.54,-89.63],[29.54,-89.57],[29.54,-89.63]],[[29.11,-90.38],[29.08,-90.31],[29.11,-90.38]],[[29.09,-90.56],[29.07,-90.42],[29.09,-90.56]],[[29.06,-90.75],[29.06,-90.65],[29.06,-90.75]],[[29.59,-92.02],[29.63,-91.85],[29.56,-91.71],[29.47,-91.82],[29.59,-92.02]],[[33.02,-94.04],[33,-91.17],[32.9,-91.18],[32.98,-91.09],[32.89,-91.07],[32.75,-91.17],[32.73,-91.06],[32.64,-91.15],[32.58,-91.12],[32.65,-91.03],[32.56,-91.08],[32.49,-90.99],[32.53,-91.1],[32.48,-91.11],[32.45,-90.99],[32.35,-90.99],[32.36,-90.88],[32.22,-90.99],[32.2,-91.16],[32.13,-91.17],[32.16,-91.01],[32.06,-91.16],[31.99,-91.09],[31.96,-91.19],[31.81,-91.26],[31.85,-91.34],[31.77,-91.36],[31.76,-91.26],[31.71,-91.4],[31.62,-91.4],[31.64,-91.5],[31.57,-91.41],[31.52,-91.52],[31.37,-91.47],[31.4,-91.58],[31.28,-91.51],[31.27,-91.64],[31.07,-91.56],[31,-91.64],[31,-89.75],[30.66,-89.85],[30.45,-89.68],[30.22,-89.62],[30.18,-89.53],[30,-89.86],[29.86,-89.66],[30.08,-89.48],[30.05,-89.37],[29.98,-89.43],[29.91,-89.37],[29.97,-89.22],[29.89,-89.32],[29.86,-89.25],[29.85,-89.36],[29.81,-89.28],[29.76,-89.3],[29.79,-89.39],[29.66,-89.43],[29.73,-89.53],[29.62,-89.49],[29.64,-89.67],[29.58,-89.6],[29.62,-89.68],[29.56,-89.68],[29.39,-89.51],[29.39,-89.31],[29.31,-89.24],[29.35,-89.2],[29.2,-89.11],[29.21,-89.03],[28.99,-89.14],[29.08,-89.25],[28.93,-89.42],[29.18,-89.28],[29.12,-89.39],[29.29,-89.64],[29.32,-89.84],[29.09,-90.22],[29.27,-90.31],[29.23,-90.4],[29.35,-90.43],[29.31,-90.58],[29.23,-90.56],[29.06,-90.87],[29.18,-90.96],[29.3,-91.34],[29.36,-91.27],[29.25,-91.12],[29.43,-91.22],[29.39,-91.34],[29.51,-91.36],[29.47,-91.46],[29.63,-91.55],[29.63,-91.65],[29.74,-91.62],[29.71,-91.86],[29.83,-91.83],[29.75,-92.2],[29.69,-92.1],[29.61,-92.11],[29.62,-92.02],[29.53,-92.32],[29.77,-93.18],[29.69,-93.84],[29.8,-93.93],[30.07,-93.7],[30.54,-93.74],[30.82,-93.55],[31.02,-93.52],[31.18,-93.53],[31.17,-93.6],[31.52,-93.74],[31.6,-93.84],[31.77,-93.82],[31.99,-94.04],[33.02,-94.04]],[[31.77,-106.89],[31.76,-106.44],[31.45,-106.15],[30.58,-104.92],[30.13,-104.68],[29.85,-104.62],[29.57,-104.4],[29,-103.26],[29.04,-103.09],[29.22,-102.89],[29.64,-102.73],[29.87,-102.34],[29.74,-101.38],[29.18,-100.76],[28.5,-100.33],[28.33,-100.3],[27.73,-99.76],[27.55,-99.51],[27.06,-99.46],[26.76,-99.23],[26.45,-99.11],[26.11,-98.28],[26.04,-97.8],[25.87,-97.38],[25.96,-97.15],[25.75,-97.16],[25.01,-97.51],[24.39,-97.67]]];

// ---------------------------------------------------------------- STATE
let windU = [], windV = [], impU = [], impV = [];  // 3D [layer][row][col]
let charge = [];                                   // 2D [row][col]
let particles = [];                                // 1D

let stormCells = [];
let shockwaves = [];   // { x, z, layer, age, amp }
let bolts = [];        // animated lightning channels, geometry fixed at strike
let strikeTimes = [];
let strikeCount = 0;

let activeLayer = 0;         // the plane the user is interacting with
let isolate = false;         // hide non-active layers
let showCharge = true;
let showParticles = true;
let showWeather = true;      // cloud masses + rain
let paused = false;

let rain = [];               // 1D pool of recycled raindrops
let rainActive = 0;

let cam = {};                // live camera state
let dragging = false, dragMoved = 0;
let hoverPt = null;          // raycast hit on active plane, or null

let cellSize, chSize, halfW;
let geoLines = [];           // GEO_OUTLINE projected to field coords, cached
let lastInputMs = 0;         // idle auto-orbit timer

// ---------------------------------------------------------------- SND
// Listener sits at field center. Thunder is scheduled at each RETURN STROKE
// (the flash), arriving late in proportion to distance: near strikes crack,
// far ones swell in as low-passed rumble. Stereo pan follows the camera.
const SND = { ctx: null, master: null, noiseBuf: null, drone: null,
                enabled: false, unavailable: false, voices: 0 };

// pure mapping distance/amplitude -> thunder character (headlessly testable)
function thunderParams(d, amp) {
  const t = constrain(d / 1250, 0, 1);
  return {
    delay: d * CONFIG.audio.delayPerUnit,
    cutoff: lerp(5200, 130, Math.pow(t, 0.6)),   // distance = low-pass
    gain: (0.45 + 0.55 * amp) * (1 - 0.82 * t),
    attack: lerp(0.006, 0.55, t),                // crack -> swell
    decay: lerp(0.9, 4.2, t),
    sub: 0.25 + 0.5 * t,                         // far thunder is mostly body
  };
}

function audioToggle() {
  const AC = (typeof AudioContext !== 'undefined') ? AudioContext
    : (typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null;
  if (!AC) { SND.unavailable = true; SND.enabled = false; return; }
  if (!SND.ctx) {
    // first toggle is a user gesture, satisfying autoplay policy
    SND.ctx = new AC();
    const comp = SND.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.connect(SND.ctx.destination);
    SND.master = SND.ctx.createGain();
    SND.master.gain.value = CONFIG.audio.masterGain;
    SND.master.connect(comp);
    const len = SND.ctx.sampleRate * 3;
    SND.noiseBuf = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate);
    const ch = SND.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    SND.drone = new SchumannDrone(SND.ctx, SND.master);
  }
  SND.enabled = !SND.enabled;
  if (SND.enabled) {
    if (SND.ctx.state === 'suspended') SND.ctx.resume();
    SND.drone.setLevel(1);
  } else {
    SND.drone.setLevel(0);
  }
}

function scheduleThunder(x, z, amp) {
  if (!SND.enabled || !SND.ctx) return;
  if (SND.voices >= CONFIG.audio.maxVoices) return;
  const d = dist(x, z, 0, 0);                    // listener at field center
  const P = thunderParams(d, amp);
  const ctx = SND.ctx;
  const t0 = ctx.currentTime + P.delay;

  // pan follows the camera: strike azimuth relative to the current view
  const B = camBasis();
  const pan = constrain(((x * B.rx + z * B.rz) / max(d, 1)) * 0.8, -0.9, 0.9);
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const sink = panner || SND.master;
  if (panner) { panner.pan.value = pan; panner.connect(SND.master); }

  const stopAt = t0 + P.attack + P.decay * 3;

  // main body: looped noise through a distance-mapped low-pass
  const src = ctx.createBufferSource();
  src.buffer = SND.noiseBuf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = P.cutoff;
  lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(P.gain, t0 + P.attack);
  g.gain.setTargetAtTime(0, t0 + P.attack, P.decay / 3);
  src.connect(lp); lp.connect(g); g.connect(sink);

  // sub layer: narrow band around 68 Hz, the chest-feel of far thunder
  const sub = ctx.createBufferSource();
  sub.buffer = SND.noiseBuf;
  sub.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 68;
  bp.Q.value = 2.2;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0, t0);
  sg.gain.linearRampToValueAtTime(P.gain * P.sub, t0 + P.attack * 1.6);
  sg.gain.setTargetAtTime(0, t0 + P.attack * 1.6, P.decay / 2.2);
  sub.connect(bp); bp.connect(sg); sg.connect(sink);

  SND.voices++;
  src.onended = () => { SND.voices--; };
  src.start(t0); src.stop(stopAt);
  sub.start(t0); sub.stop(stopAt);
}

// The Earth-ionosphere cavity as an instrument: five sine modes at true
// Schumann ratios, each breathing on its own slow LFO. Strike rate opens
// the upper modes; each return stroke pumps the whole cavity briefly.
class SchumannDrone {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.level = ctx.createGain();     // [A] on/off fade
    this.level.gain.value = 0;
    this.pumpG = ctx.createGain();     // per-strike transient swell
    this.pumpG.gain.value = 1;
    this.activityG = ctx.createGain(); // strike-rate coupling
    this.activityG.gain.value = 0.3;
    this.pumpG.connect(this.activityG);
    this.activityG.connect(this.level);
    this.level.connect(out);

    this.modes = [];
    const A = CONFIG.audio;
    for (let i = 0; i < A.droneRatios.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = A.droneBase * A.droneRatios[i] * (1 + (Math.random() - 0.5) * 0.004);
      const g = ctx.createGain();
      g.gain.value = A.droneGains[i] * A.droneLevel;
      // independent slow breathing per mode
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lfoG = ctx.createGain();
      lfoG.gain.value = A.droneGains[i] * A.droneLevel * 0.35;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      osc.connect(g); g.connect(this.pumpG);
      osc.start(); lfo.start();
      this.modes.push({ osc, g, base: A.droneGains[i] * A.droneLevel });
    }
  }
  setLevel(v) {
    this.level.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8);
  }
  setActivity(rate01) {
    // quiet cavity when the sky is calm; upper modes brighten with rate
    this.activityG.gain.setTargetAtTime(0.3 + 0.7 * rate01, this.ctx.currentTime, 1.5);
    for (let i = 1; i < this.modes.length; i++) {
      const m = this.modes[i];
      m.g.gain.setTargetAtTime(m.base * (1 + rate01 * i * 0.4), this.ctx.currentTime, 1.5);
    }
  }
  pump(amp) {
    const t = this.ctx.currentTime;
    this.pumpG.gain.cancelScheduledValues(t);
    this.pumpG.gain.setValueAtTime(this.pumpG.gain.value, t);
    this.pumpG.gain.linearRampToValueAtTime(1 + 0.22 * amp, t + 0.08);
    this.pumpG.gain.setTargetAtTime(1, t + 0.08, 1.2);
  }
}

let hudEl = null, helpEl = null;
let layerLabelEls = [];      // one DOM label pinned to each plane's near corner
let tagEls = [];             // floating strike tags, recycled
const TAG_POOL = 6, TAG_LIFE_MS = 2500;
let strikeLog = [];          // { wall, ms, x, z, layer, amp } newest last, cap 24

// -------------------------------------------------------------- SOURCES
class SyntheticStorm {
  constructor() {
    this.cells = [];
    for (let i = 0; i < CONFIG.storm.cellCount; i++) this.cells.push(this.spawn());
  }
  spawn() {
    return {
      x: random(-halfW * 0.7, halfW * 0.7),
      z: random(-halfW * 0.7, halfW * 0.7),
      heading: random(TWO_PI),
      sigma: random(CONFIG.storm.sigma[0], CONFIG.storm.sigma[1]),
      seed: random(1000),
      age: 0,
      life: random(CONFIG.storm.cellLife[0], CONFIG.storm.cellLife[1]),
    };
  }
  update(dt) {
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      c.age++;
      c.heading += (noise(c.seed, frameCount * 0.002) - 0.5) * 0.08;
      c.x += cos(c.heading) * CONFIG.storm.cellSpeed;
      c.z += sin(c.heading) * CONFIG.storm.cellSpeed;

      const m = halfW * 1.1;
      if (c.age > c.life || abs(c.x) > m || abs(c.z) > m) {
        this.cells[i] = this.spawn();
        continue;
      }
      const intensity = noise(c.seed + 50, frameCount * 0.004);
      c.intensity = intensity;
      const rate = lerp(CONFIG.storm.baseRate[0], CONFIG.storm.baseRate[1], intensity);
      if (random() < rate * dt) {
        const layer = random() < CONFIG.storm.groundFraction
          ? 0 : int(random(1, CONFIG.field.layers));
        triggerStrike(c.x + randomGaussian() * c.sigma,
                      c.z + randomGaussian() * c.sigma,
                      layer, random(0.6, 1.4));
      }
    }
  }
}
let source, synthSource, liveSource;
let useLive = false;

// Blitzortung messages arrive LZW-compressed; this is the standard decoder
// used across community clients
function lzwDecode(input) {
  const data = (input + '').split('');
  const dict = {};
  let currChar = data[0];
  let oldPhrase = currChar;
  const out = [currChar];
  let code = 256;
  let phrase;
  for (let i = 1; i < data.length; i++) {
    const currCode = data[i].charCodeAt(0);
    if (currCode < 256) phrase = data[i];
    else phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict[code] = oldPhrase + currChar;
    code++;
    oldPhrase = phrase;
  }
  return out.join('');
}

// StormSource: live strikes from the Blitzortung network, filtered to the
// configured lat/lon region and mapped into field coordinates. Storm cells
// are INFERRED by clustering incoming strikes, so clouds and rain remain
// data-driven. On any connection problem the internal SyntheticStorm takes
// over emission until the socket recovers.
class LiveBlitzortung {
  constructor() {
    this.clusters = [];
    this.fallback = new SyntheticStorm();
    this.ws = null;
    this.state = 'idle';   // idle | connecting | live | fallback | unavailable
    this.serverIdx = 0;
    this.retryMs = 2000;
    this.retryAt = 0;
    this.connectStarted = 0;
    this.lastMsgMs = 0;
    this.injectTimes = [];
    this.dropped = 0;
  }

  // clouds/rain read .cells regardless of mode
  get cells() { return this.state === 'live' ? this.clusters : this.fallback.cells; }

  connect() {
    if (typeof WebSocket === 'undefined') { this.state = 'unavailable'; return; }
    if (this.ws) return;
    this.state = 'connecting';
    this.connectStarted = millis();
    const url = CONFIG.live.servers[this.serverIdx % CONFIG.live.servers.length];
    try { this.ws = new WebSocket(url); }
    catch (e) { this.ws = null; this.scheduleRetry(); return; }
    this.ws.onopen = () => {
      this.ws.send('{"a":111}');       // subscription handshake
      this.state = 'live';
      this.lastMsgMs = millis();
      this.retryMs = 2000;
    };
    this.ws.onmessage = (ev) => this.handleMessage(ev.data);
    this.ws.onclose = () => {
      this.ws = null;
      if (source === this) this.scheduleRetry();
      else this.state = 'idle';
    };
    this.ws.onerror = () => { try { this.ws && this.ws.close(); } catch (e) {} };
  }

  scheduleRetry() {
    this.state = 'fallback';
    this.serverIdx++;                  // rotate servers on each retry
    this.retryAt = millis() + this.retryMs;
    this.retryMs = min(this.retryMs * 1.7, 30000);
  }

  disconnect() {
    if (this.ws) {
      const w = this.ws;
      this.ws = null;
      try { w.onclose = null; w.close(); } catch (e) {}
    }
    this.state = 'idle';
  }

  handleMessage(raw) {
    this.lastMsgMs = millis();
    let s;
    try { s = JSON.parse(lzwDecode(raw)); } catch (e) { return; }
    if (!s || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
    const R = CONFIG.live.region;
    if (s.lat < R.latMin || s.lat > R.latMax ||
        s.lon < R.lonMin || s.lon > R.lonMax) return;

    // inject cap protects the visuals during violent regional storms
    const now = millis();
    while (this.injectTimes.length && now - this.injectTimes[0] > 1000)
      this.injectTimes.shift();
    if (this.injectTimes.length >= CONFIG.live.maxPerSec) { this.dropped++; return; }
    this.injectTimes.push(now);

    const f = geoToField(s.lat, s.lon);

    // amplitude from the data itself: more detecting stations = stronger
    // signal. sig is the station array in the basic feed; absent -> 1.0
    const amp = Array.isArray(s.sig)
      ? constrain(0.6 + s.sig.length / 40, 0.6, 1.6) : 1.0;

    // the basic feed doesn't distinguish intra-cloud from cloud-to-ground,
    // so all live strikes render at SFC — no invented altitudes
    this.trackCluster(f.x, f.z);
    triggerStrike(f.x, f.z, 0, amp, { lat: s.lat, lon: s.lon });
  }

  trackCluster(x, z) {
    let best = null, bestD = 1e9;
    for (let i = 0; i < this.clusters.length; i++) {
      const d = dist(this.clusters[i].x, this.clusters[i].z, x, z);
      if (d < bestD) { bestD = d; best = this.clusters[i]; }
    }
    if (best && bestD < max(best.sigma * 2.2, 150)) {
      best.x = lerp(best.x, x, 0.25);
      best.z = lerp(best.z, z, 0.25);
      best.sigma = constrain(lerp(best.sigma, bestD * 0.9, 0.2), 45, 120);
      best.intensity = min(1, best.intensity + 0.18);
    } else if (this.clusters.length < 4) {
      this.clusters.push({ x, z, sigma: 70, intensity: 0.5, seed: random(1000) });
    } else {
      let weakest = this.clusters[0];
      for (let i = 1; i < this.clusters.length; i++)
        if (this.clusters[i].intensity < weakest.intensity) weakest = this.clusters[i];
      weakest.x = x; weakest.z = z;
      weakest.sigma = 70; weakest.intensity = 0.5;
    }
  }

  update(dt) {
    const now = millis();
    // retry timer
    if (source === this && !this.ws && this.state === 'fallback' && now >= this.retryAt)
      this.connect();
    // hung-connection watchdog
    if (this.state === 'connecting' && now - this.connectStarted > 15000) {
      try { this.ws && this.ws.close(); } catch (e) {}
    }
    // stale-socket watchdog: open but silent means dead upstream
    if (this.state === 'live' && now - this.lastMsgMs > 90000) {
      try { this.ws && this.ws.close(); } catch (e) {}
    }
    // inferred cells fade unless fed by strikes
    for (let i = this.clusters.length - 1; i >= 0; i--) {
      const c = this.clusters[i];
      c.intensity *= 0.9985;
      if (c.intensity < 0.06) this.clusters.splice(i, 1);
    }
    if (this.state !== 'live') this.fallback.update(dt);
  }
}

// --------------------------------------------------------------- SETUP
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  perspective(PI / 3, width / height, 10, 12000);
  pixelDensity(1);

  halfW = CONFIG.world.fieldW / 2;
  cellSize = CONFIG.world.fieldW / CONFIG.field.cols;
  chSize = CONFIG.world.fieldW / CONFIG.chargeGrid.cols;

  const F = CONFIG.field;
  for (let l = 0; l < F.layers; l++) {
    windU[l] = []; windV[l] = []; impU[l] = []; impV[l] = [];
    for (let r = 0; r < F.rows; r++) {
      windU[l][r] = new Array(F.cols).fill(0);
      windV[l][r] = new Array(F.cols).fill(0);
      impU[l][r] = new Array(F.cols).fill(0);
      impV[l][r] = new Array(F.cols).fill(0);
    }
  }
  const C = CONFIG.chargeGrid;
  for (let r = 0; r < C.rows; r++) charge[r] = new Array(C.cols).fill(0);

  for (let i = 0; i < CONFIG.particles.count; i++) {
    particles.push({
      x: random(-halfW, halfW), z: random(-halfW, halfW),
      alt: random(0.4), vx: 0, vz: 0, valt: 0,
      sides: int(random(3, 8)),
      rad: random(3, 7),
      ang: random(TWO_PI),
      spin: random(-0.03, 0.03),
    });
  }

  for (let i = 0; i < CONFIG.rain.pool; i++) {
    rain.push({ active: false, x: 0, z: 0, alt: 0, vx: 0, vz: 0, term: 0 });
  }

  cam = { radius: CONFIG.cam.radius, azimuth: CONFIG.cam.azimuth,
          elevation: CONFIG.cam.elevation };
  synthSource = new SyntheticStorm();
  liveSource = new LiveBlitzortung();
  source = synthSource;

  // project the reference outline once; geometry is static per region
  geoLines = GEO_OUTLINE.map(line => line.map(p => geoToField(p[0], p[1])));
  if (CONFIG.live.autoConnect) {
    useLive = true;
    source = liveSource;
    liveSource.connect();
  }
  buildHUD();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  perspective(PI / 3, width / height, 10, 12000);
}

// --------------------------------------------------------------- CAMERA
// target mid-volume so orbiting pivots around the stack, not the floor
function camTarget() {
  return { x: 0, y: -CONFIG.world.layerGap, z: 0 };
}
function camEye() {
  const t = camTarget();
  return {
    x: t.x + cam.radius * cos(cam.elevation) * cos(cam.azimuth),
    y: t.y - cam.radius * sin(cam.elevation),
    z: t.z + cam.radius * cos(cam.elevation) * sin(cam.azimuth),
  };
}
function applyCamera() {
  const e = camEye(), t = camTarget();
  camera(e.x, e.y, e.z, t.x, t.y, t.z, 0, 1, 0);
}

// shared orthonormal camera basis for both picking directions
function camBasis() {
  const e = camEye(), t = camTarget();
  let fx = t.x - e.x, fy = t.y - e.y, fz = t.z - e.z;
  const fm = Math.hypot(fx, fy, fz);
  fx /= fm; fy /= fm; fz /= fm;
  let rx = -fz, ry = 0, rz = fx;              // cross(forward, (0,1,0))
  const rm = Math.hypot(rx, ry, rz);
  rx /= rm; rz /= rm;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return { e, fx, fy, fz, rx, ry, rz, ux, uy, uz };
}

// hand-rolled unprojection: screen point -> world ray
function screenRay(mx, my) {
  const B = camBasis();
  const fovY = PI / 3;
  const tanY = Math.tan(fovY / 2);
  const tanX = tanY * (width / height);
  const xn = (mx - width / 2) / (width / 2);
  const yn = (my - height / 2) / (height / 2);   // +yn = screen down = +camera-up here

  let dx = B.fx + B.rx * xn * tanX + B.ux * yn * tanY;
  let dy = B.fy + B.ry * xn * tanX + B.uy * yn * tanY;
  let dz = B.fz + B.rz * xn * tanX + B.uz * yn * tanY;
  const dm = Math.hypot(dx, dy, dz);
  return { ox: B.e.x, oy: B.e.y, oz: B.e.z, dx: dx / dm, dy: dy / dm, dz: dz / dm };
}

// the same math run backwards: world point -> screen pixel (null if behind cam)
// NB: deliberately NOT named worldToScreen — p5.js 2.x ships a global of that
// name, and a top-level function declaration here would make the window
// property non-configurable, crashing p5's own defineProperty at boot.
function projectToScreen(x, y, z) {
  const B = camBasis();
  const px = x - B.e.x, py = y - B.e.y, pz = z - B.e.z;
  const cz = px * B.fx + py * B.fy + pz * B.fz;
  if (cz < 20) return null;
  const cx = px * B.rx + py * B.ry + pz * B.rz;
  const cy = px * B.ux + py * B.uy + pz * B.uz;
  const tanY = Math.tan(PI / 6);
  const tanX = tanY * (width / height);
  return { x: width / 2 + (cx / (cz * tanX)) * (width / 2),
           y: height / 2 + (cy / (cz * tanY)) * (height / 2) };
}

// intersect ray with horizontal plane y = planeY; null if behind or off-field
function planeHit(ray, planeY) {
  if (abs(ray.dy) < 1e-8) return null;
  const t = (planeY - ray.oy) / ray.dy;
  if (t <= 0) return null;
  const x = ray.ox + ray.dx * t;
  const z = ray.oz + ray.dz * t;
  if (abs(x) > halfW || abs(z) > halfW) return null;
  return { x, z };
}

function layerY(l) { return -l * CONFIG.world.layerGap; }

// --------------------------------------------------------------- STRIKE
function triggerStrike(x, z, layer, amp, geo) {
  if (abs(x) > halfW || abs(z) > halfW) return;
  strikeCount++;
  strikeTimes.push(millis());
  strikeLog.push({ wall: Date.now(), ms: millis(), x, z, layer, amp,
                   geo: geo || null });
  if (strikeLog.length > 24) strikeLog.shift();

  // channel geometry is generated once; physics fires at the return stroke
  if (bolts.length >= CONFIG.bolt.maxActive) bolts.shift();
  bolts.push({ x, z, layer, amp, age: 0, physicsFired: false,
               segs: genBolt(x, z, layer, amp) });
}

// the perceptual strike IS the return stroke, so the shockwave, ground
// charge, and debris loft all fire there — leader first, then FLASH+physics
function applyStrikePhysics(x, z, layer, amp) {
  shockwaves.push({ x, z, layer, age: 0, amp });
  scheduleThunder(x, z, amp);
  if (SND.enabled && SND.drone) SND.drone.pump(amp);

  // ground charge is only fed by cloud-to-ground strikes (2D field)
  if (layer === 0) {
    const C = CONFIG.chargeGrid;
    const cc = constrain(floor((x + halfW) / chSize), 0, C.cols - 1);
    const cr = constrain(floor((z + halfW) / chSize), 0, C.rows - 1);
    for (let r = max(0, cr - 2); r <= min(C.rows - 1, cr + 2); r++) {
      for (let c = max(0, cc - 2); c <= min(C.cols - 1, cc + 2); c++) {
        const d = dist(c, r, cc, cr);
        charge[r][c] = min(1.5, charge[r][c] + amp * exp(-d * d * 0.5));
      }
    }
  }

  // loft nearby debris; low strikes kick hardest (they meet the ground plane)
  const P = CONFIG.particles;
  const altFactor = CONFIG.layerAtten[layer];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const d = dist(p.x, p.z, x, z);
    if (d < P.strikeRadius) {
      const f = (1 - d / P.strikeRadius) * altFactor;
      p.valt += P.strikeKickZ * f * amp;
      const a = atan2(p.z - z, p.x - x);
      p.vx += cos(a) * P.strikeKickXY * f * amp;
      p.vz += sin(a) * P.strikeKickXY * f * amp;
    }
  }
}

// channel geometry: recursive midpoint displacement with amplitude-driven
// branching. CG strikes fork downward from cloud top; elevated (intra-cloud)
// strikes crawl in laterally, spider-lightning style. Each segment carries
// t in [0,1] — its propagation order along the tree — for the reveal anims.
function genBolt(x, z, layer, amp) {
  const segs = [];
  const gY = layerY(layer);
  let ox, oy, oz;
  if (layer === 0) {
    ox = x + random(-40, 40);
    oz = z + random(-40, 40);
    oy = layerY(CONFIG.field.layers - 1) - 40;
  } else {
    const a = random(TWO_PI), d = random(200, 340);
    ox = x + cos(a) * d;
    oz = z + sin(a) * d;
    oy = gY - random(50, 110);
  }
  subdivideBolt(segs, ox, oy, oz, x, gY, z, CONFIG.bolt.depth, 0, 0, 1, amp);
  return segs;
}

function subdivideBolt(segs, x1, y1, z1, x2, y2, z2, depth, order, t0, t1, amp) {
  const B = CONFIG.bolt;
  if (segs.length >= B.maxSegs) return;
  if (depth <= 0) {
    segs.push({ x1, y1, z1, x2, y2, z2, o: order, t: t0 });
    return;
  }
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz);
  let px = -dz, pz = dx;                       // horizontal perpendicular
  const pm = Math.hypot(px, pz) || 1;
  px /= pm; pz /= pm;
  const off = random(-1, 1) * len * B.displace * 0.5;
  const mx = (x1 + x2) / 2 + px * off;
  const my = (y1 + y2) / 2 + random(-1, 1) * len * 0.08;
  const mz = (z1 + z2) / 2 + pz * off;
  const tm = (t0 + t1) / 2;
  subdivideBolt(segs, x1, y1, z1, mx, my, mz, depth - 1, order, t0, tm, amp);
  subdivideBolt(segs, mx, my, mz, x2, y2, z2, depth - 1, order, tm, t1, amp);
  if (order < B.maxOrder && depth >= 2 && random() < B.branchChance * amp) {
    const btx = mx + random(-0.6, 0.6) * len;
    const bty = min(my + abs(dy) * 0.45 + random(10, 40), 0);  // never below ground
    const btz = mz + random(-0.6, 0.6) * len;
    subdivideBolt(segs, mx, my, mz, btx, bty, btz,
                  depth - 2, order + 1, tm, min(1, tm + 0.3), amp * 0.7);
  }
}

// advance bolt phases; physics fires exactly once, at the return stroke
function updateBolts() {
  const B = CONFIG.bolt;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.age++;
    if (!b.physicsFired && b.age >= B.leaderFrames) {
      b.physicsFired = true;
      applyStrikePhysics(b.x, b.z, b.layer, b.amp);
    }
    const life = B.leaderFrames + B.returnFrames + B.glowFrames * max(1, b.amp);
    if (b.age > life) bolts.splice(i, 1);
  }
}

// ---------------------------------------------------------------- FIELD
function updateWind() {
  const F = CONFIG.field;
  const t = frameCount * CONFIG.meanderSpeed;
  for (let l = 0; l < F.layers; l++) {
    const M = CONFIG.layerMeta[l];
    const baseDir = M.dirOffset + (noise(t + l * 13.7) - 0.5) * 1.4;
    for (let r = 0; r < F.rows; r++) {
      for (let c = 0; c < F.cols; c++) {
        const a = baseDir +
          (noise(c * CONFIG.noiseScale, r * CONFIG.noiseScale,
                 frameCount * 0.003 + l * 41.3) - 0.5) * 2.4;
        impU[l][r][c] *= CONFIG.impulseDecay;
        impV[l][r][c] *= CONFIG.impulseDecay;
        windU[l][r][c] = cos(a) * M.baseSpeed + impU[l][r][c];
        windV[l][r][c] = sin(a) * M.baseSpeed + impV[l][r][c];
      }
    }
  }

  // shockwaves: strongest on their own layer, attenuating through altitude
  const R = CONFIG.ring;
  for (let s = shockwaves.length - 1; s >= 0; s--) {
    const w = shockwaves[s];
    w.age++;
    if (w.age > R.life) { shockwaves.splice(s, 1); continue; }
    const fade = 1 - w.age / R.life;
    for (let l = 0; l < F.layers; l++) {
      const atten = CONFIG.layerAtten[abs(l - w.layer)];
      const ringR = w.age * CONFIG.layerMeta[l].ringSpeed;
      // only scan cells inside the ring's bounding box
      const reach = ringR + R.band;
      const c0 = max(0, floor((w.x - reach + halfW) / cellSize));
      const c1 = min(F.cols - 1, floor((w.x + reach + halfW) / cellSize));
      const r0 = max(0, floor((w.z - reach + halfW) / cellSize));
      const r1 = min(F.rows - 1, floor((w.z + reach + halfW) / cellSize));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const cx = -halfW + (c + 0.5) * cellSize;
          const cz = -halfW + (r + 0.5) * cellSize;
          const d = dist(cx, cz, w.x, w.z);
          if (abs(d - ringR) < R.band && d > 1) {
            const push = R.impulse * atten * fade * w.amp;
            impU[l][r][c] += ((cx - w.x) / d) * push;
            impV[l][r][c] += ((cz - w.z) / d) * push;
          }
        }
      }
    }
  }
}

function updateCharge() {
  const C = CONFIG.chargeGrid;
  for (let r = 0; r < C.rows; r++)
    for (let c = 0; c < C.cols; c++)
      charge[r][c] *= CONFIG.chargeDecay;
  if (frameCount % 3 === 0) {
    for (let r = 1; r < C.rows - 1; r++) {
      for (let c = 1; c < C.cols - 1; c++) {
        charge[r][c] = charge[r][c] * 0.92 +
          (charge[r - 1][c] + charge[r + 1][c] +
           charge[r][c - 1] + charge[r][c + 1]) * 0.02;
      }
    }
  }
}

// sample the 3D wind volume at (x, z, altitude) — lerp between layers
function sampleWind(x, z, alt) {
  const F = CONFIG.field;
  const c = constrain(floor((x + halfW) / cellSize), 0, F.cols - 1);
  const r = constrain(floor((z + halfW) / cellSize), 0, F.rows - 1);
  const ac = constrain(alt, 0, F.layers - 1);
  const l0 = floor(ac);
  const l1 = min(l0 + 1, F.layers - 1);
  const f = ac - l0;
  return {
    u: lerp(windU[l0][r][c], windU[l1][r][c], f),
    v: lerp(windV[l0][r][c], windV[l1][r][c], f),
  };
}

// ----------------------------------------------------------------- RAIN
// Drops spawn under intense cells and fall at terminal velocity while the
// 3D wind volume shears them horizontally — each drop visibly bends as it
// crosses layer boundaries. Fixed pool, recycled on ground/bounds exit.
function updateRain() {
  const RN = CONFIG.rain;
  rainActive = 0;

  // spawn under any cell that's worked up enough to precipitate
  if (source.cells) {
    let scan = 0;
    for (let i = 0; i < source.cells.length; i++) {
      const c = source.cells[i];
      if (!c.intensity || c.intensity < RN.minIntensity) continue;
      const n = ceil(RN.spawnPerFrame * (c.intensity - RN.minIntensity) * 2);
      for (let k = 0; k < n; k++) {
        while (scan < rain.length && rain[scan].active) scan++;
        if (scan >= rain.length) break;
        const d = rain[scan];
        d.active = true;
        d.x = c.x + randomGaussian() * c.sigma * 0.8;
        d.z = c.z + randomGaussian() * c.sigma * 0.8;
        d.alt = CONFIG.clouds.baseAlt + random(0, 0.4);
        d.vx = 0; d.vz = 0;
        d.term = RN.terminal * random(0.8, 1.2);
      }
    }
  }

  for (let i = 0; i < rain.length; i++) {
    const d = rain[i];
    if (!d.active) continue;
    const w = sampleWind(d.x, d.z, d.alt);
    d.vx += (w.u * RN.windGain - d.vx) * RN.coupling;
    d.vz += (w.v * RN.windGain - d.vz) * RN.coupling;
    d.x += d.vx;
    d.z += d.vz;
    d.alt -= d.term;
    if (d.alt <= 0 || abs(d.x) > halfW || abs(d.z) > halfW) {
      d.active = false;
      continue;
    }
    rainActive++;
  }
}

// ------------------------------------------------------------ PARTICLES
function updateParticles() {
  const P = CONFIG.particles;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const w = sampleWind(p.x, p.z, p.alt);
    p.vx += (w.u - p.vx) * P.windCoupling;
    p.vz += (w.v - p.vz) * P.windCoupling;

    p.valt -= P.gravity;
    p.alt += p.valt;
    if (p.alt <= 0) {
      p.alt = 0;                 // "fake perfection" — Greenberg
      p.valt *= -P.zDamping;
      p.vx *= P.xyFriction;
      p.vz *= P.xyFriction;
    }
    if (p.alt > 2.4) { p.alt = 2.4; p.valt = 0; }

    p.x += p.vx;
    p.z += p.vz;
    p.ang += p.spin * (0.5 + p.alt);

    if (p.x < -halfW) p.x += CONFIG.world.fieldW;
    else if (p.x > halfW) p.x -= CONFIG.world.fieldW;
    if (p.z < -halfW) p.z += CONFIG.world.fieldW;
    else if (p.z > halfW) p.z -= CONFIG.world.fieldW;
  }
}

// --------------------------------------------------------------- RENDER
function layerVisible(l) { return !isolate || l === activeLayer; }

// geographic reference on the ground plane; only meaningful in live mode,
// where strikes and outline share the same projection. Two passes fake
// phosphor bloom: a wide dim halo under a bright thin core.
function drawGeoOutline() {
  if (source !== liveSource) return;
  const c = CONFIG.geoCol;
  const passes = [[2.8, 38], [1, 175]];          // [weight, alpha]
  for (let p = 0; p < passes.length; p++) {
    stroke(c[0], c[1], c[2], passes[p][1]);
    strokeWeight(passes[p][0]);
    beginShape(LINES);
    for (let i = 0; i < geoLines.length; i++) {
      const line = geoLines[i];
      for (let k = 0; k < line.length - 1; k++) {
        vertex(line[k].x, -0.5, line[k].z);
        vertex(line[k + 1].x, -0.5, line[k + 1].z);
      }
    }
    endShape();
  }
}

function drawPlaneFrames() {
  for (let l = 0; l < CONFIG.field.layers; l++) {
    if (!layerVisible(l)) continue;
    const M = CONFIG.layerMeta[l];
    const y = layerY(l);
    const active = l === activeLayer;
    stroke(M.col[0], M.col[1], M.col[2], active ? 220 : 70);
    strokeWeight(active ? 2 : 1);
    noFill();
    beginShape();
    vertex(-halfW, y, -halfW);
    vertex(halfW, y, -halfW);
    vertex(halfW, y, halfW);
    vertex(-halfW, y, halfW);
    endShape(CLOSE);
  }
}

function drawCharge() {
  const C = CONFIG.chargeGrid, col = CONFIG.chargeCol;
  noStroke();
  // one QUADS batch, fill() set per quad — no per-cell matrix ops
  beginShape(QUADS);
  for (let r = 0; r < C.rows; r++) {
    for (let c = 0; c < C.cols; c++) {
      const q = charge[r][c];
      if (q > 0.03) {
        fill(col[0], col[1], col[2], min(110, q * 110));
        const x = -halfW + c * chSize, z = -halfW + r * chSize;
        vertex(x + 1, -1, z + 1);
        vertex(x + chSize - 1, -1, z + 1);
        vertex(x + chSize - 1, -1, z + chSize - 1);
        vertex(x + 1, -1, z + chSize - 1);
      }
    }
  }
  endShape();
}

function drawVectors() {
  const F = CONFIG.field;
  // one batched LINES shape per layer: 3 draw calls, not rows*cols*layers
  for (let l = 0; l < F.layers; l++) {
    if (!layerVisible(l)) continue;
    const M = CONFIG.layerMeta[l];
    const y = layerY(l);
    const dim = l === activeLayer ? 175 : 105;
    stroke(M.col[0], M.col[1], M.col[2], dim);
    strokeWeight(l === 0 ? 1 : l === 1 ? 1.3 : 1.6);
    const s = 8 + l * 3;
    beginShape(LINES);
    for (let r = 0; r < F.rows; r++) {
      for (let c = 0; c < F.cols; c++) {
        const cx = -halfW + (c + 0.5) * cellSize;
        const cz = -halfW + (r + 0.5) * cellSize;
        vertex(cx, y, cz);
        vertex(cx + windU[l][r][c] * s, y, cz + windV[l][r][c] * s);
      }
    }
    endShape();
  }
}

// debris polygons batched by altitude band: the smooth per-particle tint
// is quantized to ALT_BANDS colors so all edges share a handful of draw
// calls instead of one stroked shape per particle
const ALT_BANDS = 6;
let bandBuckets = [];

function drawParticles() {
  const meta = CONFIG.layerMeta;
  const gap = CONFIG.world.layerGap;

  if (bandBuckets.length === 0)
    for (let b = 0; b < ALT_BANDS; b++) bandBuckets.push([]);
  for (let b = 0; b < ALT_BANDS; b++) bandBuckets[b].length = 0;

  for (let i = 0; i < particles.length; i++) {
    const b = constrain(floor(particles[i].alt / 2.4 * ALT_BANDS), 0, ALT_BANDS - 1);
    bandBuckets[b].push(i);
  }

  noFill();
  strokeWeight(1);
  const lo = meta[0].col, hi = meta[2].col;
  for (let b = 0; b < ALT_BANDS; b++) {
    const bucket = bandBuckets[b];
    if (bucket.length === 0) continue;
    const zf = constrain(((b + 0.5) / ALT_BANDS) * 1.2, 0, 1);
    stroke(lerp(lo[0], hi[0], zf), lerp(lo[1], hi[1], zf),
           lerp(lo[2], hi[2], zf), 110 + 120 * zf);
    beginShape(LINES);
    for (let k = 0; k < bucket.length; k++) {
      const p = particles[bucket[k]];
      const rad = p.rad * (0.7 + 0.6 * zf);
      const y = -p.alt * gap;
      for (let s = 0; s < p.sides; s++) {
        const a1 = p.ang + (TWO_PI / p.sides) * s;
        const a2 = p.ang + (TWO_PI / p.sides) * ((s + 1) % p.sides);
        vertex(p.x + cos(a1) * rad, y, p.z + sin(a1) * rad);
        vertex(p.x + cos(a2) * rad, y, p.z + sin(a2) * rad);
      }
    }
    endShape();
  }
}

// organic cloud masses: stacked noise-perturbed lobes per storm cell,
// breathing with the cell's intensity — you see a storm build before it fires
function drawClouds() {
  if (!source.cells) return;
  const CL = CONFIG.clouds;
  const gap = CONFIG.world.layerGap;
  for (let i = 0; i < source.cells.length; i++) {
    const c = source.cells[i];
    const inten = c.intensity || 0.3;
    const swell = 0.8 + CL.breathe * inten;
    for (let lb = 0; lb < CL.lobes; lb++) {
      const y = -(CL.baseAlt + lb * CL.lobeAltStep) * gap;
      const R = c.sigma * CL.radiusScale * swell * (1 - lb * 0.18);
      fill(CL.col[0], CL.col[1], CL.col[2], 22 + 44 * inten);
      stroke(CL.col[0] + 30 * inten, CL.col[1], CL.col[2] + 40 * inten,
             55 + 90 * inten);
      strokeWeight(1);
      beginShape();
      for (let k = 0; k < CL.verts; k++) {
        const a = (TWO_PI / CL.verts) * k;
        const n = noise(cos(a) * 0.9 + c.seed, sin(a) * 0.9 + lb * 7.3,
                        frameCount * 0.004);
        const r = R * (0.72 + CL.noiseAmp * n);
        vertex(c.x + cos(a) * r, y, c.z + sin(a) * r);
      }
      endShape(CLOSE);
    }
  }
}

// rain streaks: tail points back along the drop's recent path, so shear
// from the wind volume reads directly as streak tilt
function drawRain() {
  const RN = CONFIG.rain;
  const gap = CONFIG.world.layerGap;
  stroke(RN.col[0], RN.col[1], RN.col[2], 95);
  strokeWeight(1);
  beginShape(LINES);   // all drops in one draw call
  for (let i = 0; i < rain.length; i++) {
    const d = rain[i];
    if (!d.active) continue;
    const y = -d.alt * gap;
    const yTail = -(d.alt + d.term * RN.streak) * gap;
    vertex(d.x, y, d.z);
    vertex(d.x - d.vx * RN.streak, yTail, d.z - d.vz * RN.streak);
  }
  endShape();
}

function drawStrikes() {
  const R = CONFIG.ring;
  noFill();

  // rings expand on every plane, alpha-weighted by attenuation
  for (let s = 0; s < shockwaves.length; s++) {
    const w = shockwaves[s];
    const fade = 1 - w.age / R.life;
    for (let l = 0; l < CONFIG.field.layers; l++) {
      if (!layerVisible(l)) continue;
      const atten = CONFIG.layerAtten[abs(l - w.layer)];
      if (atten < 0.1) continue;
      const M = CONFIG.layerMeta[l];
      stroke(M.col[0], M.col[1], M.col[2], 170 * fade * atten);
      strokeWeight(1.2);
      const y = layerY(l);
      push();
      translate(w.x, y, w.z);
      rotateX(HALF_PI);
      circle(0, 0, w.age * M.ringSpeed * 2);
      pop();
    }
  }

  // ---- lightning channels, three phases ----
  const B = CONFIG.bolt;
  for (let i = 0; i < bolts.length; i++) {
    const b = bolts[i];

    if (b.age < B.leaderFrames) {
      // stepped leader: channel reveals in propagation order, dim and cool
      const prog = b.age / B.leaderFrames;
      for (let o = 0; o < 2; o++) {              // main, then branches
        stroke(B.leaderCol[0], B.leaderCol[1], B.leaderCol[2],
               (o === 0 ? 55 + 30 * b.amp : 50));
        strokeWeight(o === 0 ? 0.8 + 0.35 * b.amp : 0.8);
        beginShape(LINES);
        for (let s = 0; s < b.segs.length; s++) {
          const g = b.segs[s];
          if ((o === 0 ? g.o === 0 : g.o > 0) && g.t <= prog) {
            vertex(g.x1, g.y1, g.z1);
            vertex(g.x2, g.y2, g.z2);
          }
        }
        endShape();
      }

    } else if (b.age < B.leaderFrames + B.returnFrames) {
      // return stroke: brightness surges ground-to-cloud, then flickers
      const ra = b.age - B.leaderFrames;
      let bright = 0;
      for (let p = 0; p < B.pulses.length; p++) {
        const d = (ra - B.pulses[p][0]) / 2.2;
        bright = max(bright, B.pulses[p][1] * exp(-d * d));
      }
      const litFrom = 1 - min(1, ra / 3 + 0.15);  // upward front, ~3 frames
      const alpha = 255 * max(bright, 0.08);
      stroke(255, 255, 255, alpha);
      strokeWeight(1.2 + 1.8 * bright * b.amp);
      beginShape(LINES);
      for (let s = 0; s < b.segs.length; s++) {
        const g = b.segs[s];
        if (g.o === 0 && g.t >= litFrom) { vertex(g.x1, g.y1, g.z1); vertex(g.x2, g.y2, g.z2); }
      }
      endShape();
      stroke(235, 240, 255, alpha * 0.5);
      strokeWeight(0.9);
      beginShape(LINES);
      for (let s = 0; s < b.segs.length; s++) {
        const g = b.segs[s];
        if (g.o > 0 && g.t >= litFrom) { vertex(g.x1, g.y1, g.z1); vertex(g.x2, g.y2, g.z2); }
      }
      endShape();

    } else {
      // phosphor afterglow: the channel ghost decays, branches fade first;
      // stronger strikes linger longer
      const ga = b.age - B.leaderFrames - B.returnFrames;
      const g0 = exp(-ga / ((B.glowFrames / 3) * max(1, b.amp)));
      const alpha = 80 * g0;
      if (alpha < 3) continue;
      stroke(B.glowCol[0], B.glowCol[1], B.glowCol[2], alpha);
      strokeWeight(1);
      beginShape(LINES);
      for (let s = 0; s < b.segs.length; s++) {
        const g = b.segs[s];
        if (g.o <= 1) { vertex(g.x1, g.y1, g.z1); vertex(g.x2, g.y2, g.z2); }
      }
      endShape();
    }
  }
}

// the thunder listener at field center — visible only when sound is on,
// so the delay/pan geometry has a visible anchor
function drawListener() {
  if (!SND.enabled) return;
  stroke(143, 163, 184, 130);
  strokeWeight(1);
  noFill();
  push();
  translate(0, -0.5, 0);
  rotateX(HALF_PI);
  circle(0, 0, 16);
  circle(0, 0, 34);
  pop();
}

// reticle where the cursor's ray meets the active plane
function drawReticle() {
  if (!hoverPt) return;
  const M = CONFIG.layerMeta[activeLayer];
  const y = layerY(activeLayer);
  stroke(M.col[0], M.col[1], M.col[2], 230);
  strokeWeight(1.5);
  noFill();
  push();
  translate(hoverPt.x, y, hoverPt.z);
  rotateX(HALF_PI);
  circle(0, 0, 26);
  line(-20, 0, 20, 0);
  line(0, -20, 0, 20);
  pop();
}

// ------------------------------------------------------------------ HUD
function buildHUD() {
  if (typeof document === 'undefined') return;
  const base = 'position:fixed;font:12px monospace;' +
               'pointer-events:none;user-select:none;white-space:pre;z-index:10;';
  hudEl = document.createElement('div');
  hudEl.style.cssText = base + 'left:16px;top:14px;color:#7dffa8;';
  helpEl = document.createElement('div');
  helpEl.style.cssText = base + 'left:16px;bottom:14px;color:#ff5ad0;opacity:0.7;';
  helpEl.textContent =
    'drag orbit   scroll zoom   [1-3] active plane   click strike on plane\n' +
    '[A] sound   [S] live/synthetic   [W] weather   [H] isolate   [G] charge\n' +
    '[P] debris   [R] cam   [space] pause';
  document.body.appendChild(hudEl);
  document.body.appendChild(helpEl);

  // plane labels: DOM text projected onto each layer's camera-near corner
  for (let l = 0; l < CONFIG.field.layers; l++) {
    const M = CONFIG.layerMeta[l];
    const el = document.createElement('div');
    el.style.cssText = base + 'left:0;top:0;font-size:11px;' +
      'color:rgb(' + M.col[0] + ',' + M.col[1] + ',' + M.col[2] + ');';
    document.body.appendChild(el);
    layerLabelEls.push(el);
  }
  // floating strike tags, recycled from a fixed pool
  for (let i = 0; i < TAG_POOL; i++) {
    const el = document.createElement('div');
    el.style.cssText = base + 'left:0;top:0;font-size:11px;color:#fff;opacity:0;';
    document.body.appendChild(el);
    tagEls.push(el);
  }
}

// grid coordinates for synthetic strikes; real degrees for live ones
function fmtCoord(v) {
  return (v >= 0 ? '+' : '-') + nf(floor(abs(v)), 3, 0);
}
function fmtGeo(lat, lon) {
  return abs(lat).toFixed(1) + '\u00B0' + (lat >= 0 ? 'N' : 'S') + ' ' +
         abs(lon).toFixed(1) + '\u00B0' + (lon >= 0 ? 'E' : 'W');
}
function strikeLabel(s) {
  return (s.geo ? fmtGeo(s.geo.lat, s.geo.lon)
                : fmtCoord(s.x) + ',' + fmtCoord(s.z)) + ' ' + LAYER_SHORT[s.layer];
}
const LAYER_SHORT = ['SFC', '850', '500'];

// reposition all world-pinned DOM labels; runs every frame
function updateLabels() {
  if (!hudEl) return;
  const e = camEye();
  for (let l = 0; l < CONFIG.field.layers; l++) {
    const el = layerLabelEls[l];
    if (!layerVisible(l)) { el.style.opacity = 0; continue; }
    // ride the corner nearest the camera so labels stay foreground
    const cx = (e.x >= 0 ? 1 : -1) * (halfW + 26);
    const cz = (e.z >= 0 ? 1 : -1) * (halfW + 26);
    const p = projectToScreen(cx, layerY(l), cz);
    if (!p) { el.style.opacity = 0; continue; }
    const active = l === activeLayer;
    el.textContent = '[' + (l + 1) + '] ' + CONFIG.layerMeta[l].name.trim() +
                     (active ? ' \u25CF' : '');
    el.style.opacity = active ? 1 : 0.55;
    el.style.transform = 'translate(' + (p.x - 14) + 'px,' + (p.y - 7) + 'px)';
  }

  // strike tags: newest strikes within the tag lifetime
  const now = millis();
  let t = 0;
  for (let i = strikeLog.length - 1; i >= 0 && t < TAG_POOL; i--) {
    const s = strikeLog[i];
    const age = now - s.ms;
    if (age > TAG_LIFE_MS) break;
    const p = projectToScreen(s.x, layerY(s.layer), s.z);
    const el = tagEls[t++];
    if (!p) { el.style.opacity = 0; continue; }
    el.textContent = strikeLabel(s);
    el.style.opacity = (1 - age / TAG_LIFE_MS) * 0.95;
    el.style.transform = 'translate(' + (p.x + 12) + 'px,' + (p.y - 18) + 'px)';
  }
  for (; t < TAG_POOL; t++) tagEls[t].style.opacity = 0;
}

function updateHUD() {
  if (!hudEl) return;
  const now = millis();
  while (strikeTimes.length && now - strikeTimes[0] > 60000) strikeTimes.shift();
  const M = CONFIG.layerMeta[activeLayer];
  let srcLine = 'SYNTHETIC';
  if (source === liveSource) {
    const st = liveSource.state;
    if (st === 'live') srcLine = 'LIVE \u25AA BLITZORTUNG';
    else if (st === 'connecting') srcLine = 'LIVE \u25AA CONNECTING\u2026';
    else if (st === 'unavailable') srcLine = 'LIVE \u25AA UNAVAILABLE \u25AA SYN FALLBACK';
    else srcLine = 'LIVE \u25AA RECONNECTING \u25AA SYN FALLBACK';
  }
  let s = 'STORM OBSERVATORY  v0.10.1 · p5 2.3.0\n' +
    'SOURCE   ' + srcLine + '\n' +
    (source === liveSource
      ? 'REGION   ' + CONFIG.live.region.name +
        (liveSource.dropped ? '  (' + liveSource.dropped + ' dropped)' : '') + '\n'
      : '') +
    'FPS      ' + nf(frameRate(), 2, 0) + '\n' +
    'STRIKES  ' + nf(strikeCount, 6) + '\n' +
    'RATE     ' + nf(strikeTimes.length / 60, 1, 2) + ' /s\n' +
    'RAIN     ' + rainActive + '\n' +
    'SND    ' + (SND.unavailable ? 'UNAVAILABLE'
                   : SND.enabled ? 'ON \u25AA thunder + 7.83 Hz drone' : 'OFF  [A]') + '\n' +
    'PLANE    [' + (activeLayer + 1) + '] ' + M.name.trim() +
    (isolate ? '  (isolated)' : '') +
    (paused ? '\nPAUSED' : '');

  if (strikeLog.length) {
    const last = strikeLog[strikeLog.length - 1];
    s += '\nLAST     ' + strikeLabel(last) + '  ' +
         nf((now - last.ms) / 1000, 1, 1) + 's ago\nLOG';
    for (let i = strikeLog.length - 1, n = 0; i >= 0 && n < 4; i--, n++) {
      const e = strikeLog[i];
      const hms = new Date(e.wall).toTimeString().slice(0, 8);
      s += (n === 0 ? '      ' : '\n         ') + hms + '  ' + strikeLabel(e);
    }
  }
  hudEl.textContent = s;
}

// ----------------------------------------------------------------- LOOP
function draw() {
  background(CONFIG.bg[0], CONFIG.bg[1], CONFIG.bg[2]);
  const dt = min(deltaTime, 50) / 1000;

  if (!paused) {
    source.update(dt);
    updateWind();
    updateCharge();
    updateBolts();
    if (showParticles) updateParticles();
    if (showWeather) updateRain();
  }

  applyCamera();

  // idle auto-orbit: slow drift after inactivity, easing in; any input stops it
  const idle = millis() - lastInputMs;
  if (idle > CONFIG.idle.delayMs && !dragging) {
    const ramp = min(1, (idle - CONFIG.idle.delayMs) / CONFIG.idle.rampMs);
    cam.azimuth += CONFIG.idle.speed * ramp;
  }

  hoverPt = dragging ? null
    : planeHit(screenRay(mouseX, mouseY), layerY(activeLayer));

  drawPlaneFrames();
  drawGeoOutline();
  if (showCharge) drawCharge();
  drawVectors();
  if (showParticles) drawParticles();
  if (showWeather) drawRain();
  if (showWeather) drawClouds();   // translucent masses late in draw order
  drawStrikes();
  drawReticle();
  drawListener();
  updateLabels();

  if (SND.enabled && SND.drone && frameCount % 15 === 0)
    SND.drone.setActivity(min(1, (strikeTimes.length / 60) / 3));

  if (frameCount % 10 === 0) updateHUD();
}

// ---------------------------------------------------------------- INPUT
function mousePressed() {
  lastInputMs = millis();
  dragging = true;
  dragMoved = 0;
}

function mouseDragged() {
  lastInputMs = millis();
  dragMoved += abs(movedX) + abs(movedY);
  cam.azimuth += movedX * 0.006;
  cam.elevation = constrain(cam.elevation + movedY * 0.005,
                            CONFIG.cam.minEl, CONFIG.cam.maxEl);
}

function mouseReleased() {
  dragging = false;
  if (dragMoved < 6) {   // a click, not an orbit
    const hit = planeHit(screenRay(mouseX, mouseY), layerY(activeLayer));
    if (hit) triggerStrike(hit.x, hit.z, activeLayer, 1.2);
  }
}

function mouseWheel(event) {
  lastInputMs = millis();
  cam.radius = constrain(cam.radius + event.delta * 1.2,
                         CONFIG.cam.minR, CONFIG.cam.maxR);
  return false;
}

function keyPressed() {
  lastInputMs = millis();
  if (key === '1' || key === '2' || key === '3') {
    activeLayer = int(key) - 1;
  } else if (key === 'h' || key === 'H') {
    isolate = !isolate;
  } else if (key === 'g' || key === 'G') {
    showCharge = !showCharge;
  } else if (key === 'p' || key === 'P') {
    showParticles = !showParticles;
  } else if (key === 'w' || key === 'W') {
    showWeather = !showWeather;
  } else if (key === 'a' || key === 'A') {
    audioToggle();
  } else if (key === 's' || key === 'S') {
    useLive = !useLive;
    if (useLive) {
      source = liveSource;
      liveSource.connect();
    } else {
      liveSource.disconnect();   // don't hold their socket while unused
      source = synthSource;
    }
  } else if (key === 'r' || key === 'R') {
    cam.radius = CONFIG.cam.radius;
    cam.azimuth = CONFIG.cam.azimuth;
    cam.elevation = CONFIG.cam.elevation;
  } else if (key === ' ') {
    paused = !paused;
    return false;
  }
  updateHUD();
}
