/*
  test/smoke.mjs — headless smoke tests for feeds/celestrak.js
  Run: node test/smoke.mjs        (no browser, no network, no GPU)

  Coverage, in the house style:
    1. NaN gate           — malformed records dropped, no NaN anywhere downstream
    2. Physical sanity    — mean motion vs. altitude strictly inverse (Kepler III)
    3. Known anchors      — ISS ~420 km / ~93 min; Starlink ~550 km within tolerance
    4. Propagation        — M advances exactly n*360 deg/day; phase wraps [0,360)
    5. Shell coherence    — co-planar Starlink pair keeps constant angular offset
    6. Audio band         — orbital Hz after +23 octaves lands 200 Hz..4 kHz,
                            monotone in mean motion; shell pair beats < 2 Hz
    7. Staleness          — debris with old epoch reports larger staleDays
    8. Cache discipline   — second load() must NOT hit the network (usage policy)
*/

import { readFile } from 'node:fs/promises';
import { CelestrakFeed, orbitalHz } from '../src/feeds/celestrak.js';
import { orbital3D, scaledRadiusKm, inclHue, staleAlpha, orbitsMotif,
         trailSpanDeg, R_EARTH_KM, hueBucket, alphaLevel, foldRotate,
         HUE_BUCKETS, ALPHA_LEVELS } from '../src/render/orbits.js';
import { findClosePairs, Blooms } from '../src/sim/conjunctions.js';
import { latLonToXYZ, COASTLINE_COUNT } from '../src/render/earth.js';
import { sunEphemeris, inShadow, sunDiscRadius, SUN_ANGULAR_RADIUS_RAD } from '../src/sim/sun.js';
import { STAR_COUNT } from '../src/render/sky.js';
import stars from '../src/render/stars_data.js';
import { pickNotables } from '../src/sim/notables.js';
import { GroundTrack, eciToEarthFixed } from '../src/sim/groundtrack.js';
import { hsv } from '../src/render/color.js';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/omm_sample.json', import.meta.url), 'utf8'));

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else    { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

/* stub fetch: counts calls, serves the fixture */
let fetchCalls = 0;
const feed = new CelestrakFeed({
  fetchImpl: async () => (fetchCalls++, { ok: true, json: async () => fixture }),
});

const objs = await feed.load('starlink');

/* 1 — NaN gate ------------------------------------------------------------ */
console.log('\n[1] NaN gate');
check('malformed records dropped', objs.length === fixture.length - 2,
      `${objs.length} of ${fixture.length}`);
const numericKeys = ['epoch','meanMotion','incl','ecc','raan','argp','m0','smaKm','altKm','periodMin','freqHz'];
check('no NaN in any normalized field',
      objs.every(o => numericKeys.every(k => Number.isFinite(o[k]))));

/* 2 — Kepler III monotonicity --------------------------------------------- */
console.log('\n[2] physical sanity');
const byMotion = [...objs].sort((a, b) => a.meanMotion - b.meanMotion);
check('altitude strictly decreases as mean motion increases',
      byMotion.every((o, i) => i === 0 || o.altKm < byMotion[i - 1].altKm));

/* 3 — known anchors -------------------------------------------------------- */
const iss  = objs.find(o => o.id === '25544');
const sl1  = objs.find(o => o.id === '55574');
const sl2  = objs.find(o => o.id === '55575');
check('ISS altitude ~420 km', Math.abs(iss.altKm - 420) < 25, iss.altKm.toFixed(1) + ' km');
check('ISS period ~92.9 min', Math.abs(iss.periodMin - 92.9) < 0.5, iss.periodMin.toFixed(2) + ' min');
check('Starlink shell ~550 km', Math.abs(sl1.altKm - 550) < 25, sl1.altKm.toFixed(1) + ' km');
check('6-digit catalog id survives normalize', objs.some(o => o.id === '100001'));

/* 4 — propagation causality ------------------------------------------------ */
console.log('\n[4] propagation');
const t0 = iss.epoch, oneDay = 86400_000;
const p0 = feed.propagate(iss, t0);
const p1 = feed.propagate(iss, t0 + oneDay);
check('M at epoch equals M0', Math.abs(p0.meanAnomaly - iss.m0) < 1e-9);
const advanced = ((p1.meanAnomaly - p0.meanAnomaly) % 360 + 360) % 360;
const expected = (iss.meanMotion * 360) % 360;
check('M advances n*360 deg per day (mod 360)',
      Math.abs(advanced - expected) < 1e-6,
      `${advanced.toFixed(6)} vs ${expected.toFixed(6)}`);
const samples = Array.from({length: 500}, (_, i) => feed.propagate(iss, t0 + i * 7.3e5));
check('phase always wraps to [0,360)',
      samples.every(s => s.angle >= 0 && s.angle < 360 && s.meanAnomaly >= 0 && s.meanAnomaly < 360));
check('no NaN across 500 propagation samples',
      samples.every(s => Number.isFinite(s.angle) && Number.isFinite(s.staleDays)));

/* 5 — shell coherence ------------------------------------------------------ */
console.log('\n[5] shell coherence');
const t = Date.parse('2026-07-15T00:00:00Z');
const offsets = [0, 3600e3, 7200e3].map(dt => {
  const a = feed.propagate(sl1, t + dt).angle, b = feed.propagate(sl2, t + dt).angle;
  return ((b - a) % 360 + 360) % 360;
});
const drift = Math.max(...offsets) - Math.min(...offsets);
check('co-planar pair keeps near-constant offset over 2 h', drift < 0.5,
      `drift ${drift.toFixed(4)} deg`);

/* 6 — audio band ----------------------------------------------------------- */
console.log('\n[6] sonification band');
check('all LEO voices land in 200 Hz..4 kHz',
      objs.every(o => o.freqHz > 200 && o.freqHz < 4000));
check('frequency monotone in mean motion',
      byMotion.every((o, i) => i === 0 || o.freqHz > byMotion[i - 1].freqHz));
const beat = Math.abs(sl1.freqHz - sl2.freqHz);
check('Starlink shell pair beats slowly (< 2 Hz)', beat > 0 && beat < 2,
      beat.toFixed(3) + ' Hz');
check('orbitalHz helper agrees with normalize', orbitalHz(iss.meanMotion) === iss.freqHz);

/* 7 — staleness ------------------------------------------------------------ */
console.log('\n[7] epoch staleness');
const deb = objs.find(o => o.id === '34427');
check('older epoch reports larger staleDays',
      feed.propagate(deb, t).staleDays > feed.propagate(iss, t).staleDays);

/* 8 — cache discipline ------------------------------------------------------ */
console.log('\n[8] usage policy');
await feed.load('starlink');
check('second load() served from cache, zero extra fetches', fetchCalls === 1);

/* 9 — render geometry (pure math, no p5) ---------------------------------- */
console.log('\n[9] render geometry');
const norm = v => Math.hypot(...v);
check('orbital radius monotone in altitude, both exaggerations',
      [1, 4].every(x => byMotion.every((o, i) => i === 0 ||
        scaledRadiusKm(o.altKm, x) < scaledRadiusKm(byMotion[i-1].altKm, x))));
check('true scale: LEO shells within 1.0..1.4 Earth radii',
      objs.every(o => { const rr = scaledRadiusKm(o.altKm, 1) / R_EARTH_KM;
                        return rr > 1 && rr < 1.4; }));
const o3 = (i, O, u, r) => orbital3D(i, O, u, r, new Float64Array(3));
check('orbital3D preserves radius over full revolution',
      Array.from({length: 73}, (_, k) => norm(o3(51.6, 214.5, k * 5, 1000)))
        .every(r => Math.abs(r - 1000) < 1e-9));
check('equatorial orbit stays in the equatorial plane (y = 0)',
      Array.from({length: 36}, (_, k) => o3(0, 0, k * 10, 500)[1])
        .every(y => Math.abs(y) < 1e-9));
check('polar orbit passes over the poles (|y| reaches r)',
      Math.abs(Math.min(...Array.from({length: 361},
        (_, k) => o3(90, 30, k, 500)[1])) + 500) < 1e-6);
check('retrograde flips in-plane direction sign (physics, not a hack)',
      Math.sign(o3(97.5, 0, 1, 1)[2] - o3(97.5, 0, 0, 1)[2]) !==
      Math.sign(o3(53.0, 0, 1, 1)[2] - o3(53.0, 0, 0, 1)[2]));
check('hue finite and in [0,360) across 0..180 deg inclination',
      Array.from({length: 181}, (_, i) => inclHue(i)).every(h => Number.isFinite(h) && h >= 0 && h < 360));
check('stale alpha bounded and monotone non-increasing',
      staleAlpha(0) === 255 && staleAlpha(10) < staleAlpha(1) && staleAlpha(1e4) >= 0.15 * 255 - 1e-9);
const prepped = orbitsMotif.prepare(objs.map(o => ({...o})));
check('prepare: hue bucket precomputed and in range',
      prepped.every(o => Number.isInteger(o._hb) && o._hb >= 0 && o._hb < HUE_BUCKETS));
const spans = [60, 240, 600].map(s => trailSpanDeg(iss.meanMotion, s));
check('trail span monotone non-decreasing in time scale',
      spans[0] <= spans[1] && spans[1] <= spans[2]);
check('trail span clamped: floor at 1x, ceiling at 600x',
      trailSpanDeg(iss.meanMotion, 1) >= 2 - 1e-9 && spans[2] <= 42 + 1e-9,
      spans.map(v => v.toFixed(1)).join('/') + ' deg');
check('trail span monotone in mean motion (same scale)',
      trailSpanDeg(15.5, 240) > trailSpanDeg(14.3, 240));
check('trail span never NaN for degenerate inputs',
      [0, -1, 1e6].every(mm => Number.isFinite(trailSpanDeg(mm, 240))));
const vv = orbitsMotif.voices(prepped, 4);
check('voice picker returns ≤ n voices with finite Hz',
      vv.length <= 4 && vv.length > 0 && vv.every(v => Number.isFinite(v.hz)));

/* 10 — batching + folds ------------------------------------------------------ */
console.log('\n[10] batching + folds');
check('hue buckets cover [0, HUE_BUCKETS) across all inclinations',
      Array.from({length: 181}, (_, i) => hueBucket(i))
        .every(b => Number.isInteger(b) && b >= 0 && b < HUE_BUCKETS));
check('alpha levels cover [0, ALPHA_LEVELS) across 0..255',
      [0, 63, 128, 200, 255].map(alphaLevel)
        .every(l => Number.isInteger(l) && l >= 0 && l < ALPHA_LEVELS));
const fr = new Float32Array(3);
foldRotate(3, 7, 4, Math.PI / 3, fr);
check('fold rotation preserves radius and the polar axis',
      Math.abs(Math.hypot(fr[0], fr[2]) - Math.hypot(3, 4)) < 1e-6 && fr[1] === 7);
foldRotate(3, 7, 4, 0, fr);
check('zero-fold rotation is identity', fr[0] === 3 && fr[1] === 7 && fr[2] === 4);

/* 11 — conjunctions ----------------------------------------------------------- */
console.log('\n[11] conjunctions');
const P = (pts) => { const a = new Float32Array(pts.length * 3);
  pts.forEach((v, i) => a.set(v, i * 3)); return a; };
const near = P([[7000, 0, 0], [7010, 0, 0], [7400, 0, 0]]);
const found = findClosePairs(near, 3, 30);
check('grid finds the close pair and only it',
      found.length === 1 && found[0][0] === 0 && found[0][1] === 1 &&
      Math.abs(found[0][2] - 10) < 1e-6);
check('cell-boundary pair is not missed (neighbor scan)',
      findClosePairs(P([[29.9, 0, 0], [30.1, 0, 0]]), 2, 30).length === 1);
/* brute-force cross-check on a random cloud */
const rng = (seed => () => (seed = seed * 48271 % 2147483647) / 2147483647)(42);
const cloud = Array.from({length: 200}, () =>
  [6800 + rng() * 800, (rng() - 0.5) * 1200, (rng() - 0.5) * 1200]);
const gridPairs = findClosePairs(P(cloud), 200, 60)
  .map(([i, j]) => i < j ? i + '-' + j : j + '-' + i).sort();
const brute = [];
for (let i = 0; i < 200; i++) for (let j = i + 1; j < 200; j++) {
  const d = Math.hypot(...cloud[i].map((v, k) => v - cloud[j][k]));
  if (d < 60) brute.push(i + '-' + j);
}
check('grid matches brute force on a 200-object cloud',
      JSON.stringify(gridPairs) === JSON.stringify(brute.sort()),
      gridPairs.length + ' vs ' + brute.length + ' pairs');
const bl = new Blooms(4);
bl.spawn(1, 2, 3); bl.step(0.7);
const lv = bl.items[0].life;
check('bloom decays toward zero and clamps',
      lv > 0 && lv < 1 && (bl.step(99), bl.items[0].life === 0));
for (let i = 0; i < 9; i++) bl.spawn(i, 0, 0);
check('bloom pool recycles at fixed capacity', bl.items.length === 4);

/* 12 — sun + eclipse ---------------------------------------------------------- */
console.log('\n[12] sun + eclipse');
const equinox  = sunEphemeris(Date.parse('2026-03-20T14:46:00Z'));
const junsol   = sunEphemeris(Date.parse('2026-06-21T02:25:00Z'));
const decsol   = sunEphemeris(Date.parse('2025-12-21T15:03:00Z'));
check('declination ~0 at March equinox', Math.abs(equinox.declDeg) < 0.1,
      equinox.declDeg.toFixed(3) + ' deg');
check('declination ~ +23.4 at June solstice', Math.abs(junsol.declDeg - 23.44) < 0.05,
      junsol.declDeg.toFixed(3) + ' deg');
check('declination ~ -23.4 at December solstice', Math.abs(decsol.declDeg + 23.44) < 0.05,
      decsol.declDeg.toFixed(3) + ' deg');
const noon = sunEphemeris(Date.parse('2026-07-15T12:00:00Z'));
check('subsolar longitude near Greenwich at 12:00 UTC (within equation of time)',
      Math.abs(noon.subsolarLonDeg) < 5, noon.subsolarLonDeg.toFixed(2) + ' deg');
const g0 = sunEphemeris(0).gmstDeg, g6 = sunEphemeris(6 * 3600e3).gmstDeg;
check('GMST advances ~90.25 deg in 6 hours (sidereal, not solar)',
      Math.abs(((g6 - g0 + 360) % 360) - 90.246) < 0.01);
check('ephemeris outputs finite across a year of samples',
      Array.from({length: 365}, (_, d) => sunEphemeris(Date.parse('2026-01-01T00:00:00Z') + d * 86400e3))
        .every(e => Number.isFinite(e.declDeg) && Number.isFinite(e.gmstDeg) &&
                    Math.abs(Math.hypot(...e.eciDir) - 1) < 1e-9));
const S = [1, 0, 0];
check('anti-solar point at LEO altitude is in shadow', inShadow(-6800, 0, 0, S));
check('sun-side point is lit', !inShadow(6800, 0, 0, S));
check('anti-solar but beyond one Earth radius off-axis is lit',
      !inShadow(-6800, 6500, 0, S));
check('shadow boundary respects the cylinder radius',
      inShadow(-7000, 6300, 0, S) && !inShadow(-7000, 6450, 0, S));

/* 13 — sun presentation + sky + focus ---------------------------------------- */
console.log('\n[13] sun disc, stars, focus tour');
check('photosphere disc at true angular size (0.267 deg of its distance)',
      Math.abs(sunDiscRadius(1000) - 1000 * Math.tan(SUN_ANGULAR_RADIUS_RAD)) < 1e-9 &&
      Math.abs(sunDiscRadius(1000) - 4.66) < 0.05);
check('star catalog present with the right census (~500 to mag 4.0)',
      STAR_COUNT > 400 && STAR_COUNT < 600, STAR_COUNT + ' stars');
check('star coordinates in range, magnitudes sorted ascending',
      stars.every(([ra, dec, mag]) => ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 &&
        Number.isFinite(mag)) &&
      stars.every(([, , mag], i) => i === 0 || mag >= stars[i-1][2]));
check('Sirius leads the catalog', Math.abs(stars[0][2] + 1.44) < 0.05);
const nb = pickNotables(objs);
check('notables: newest has max epoch, lowest has min altitude',
      objs[nb.find(n => n.key === 'newest elements').idx].epoch ===
        Math.max(...objs.map(o => o.epoch)) &&
      objs[nb.find(n => n.key === 'lowest orbit').idx].altKm ===
        Math.min(...objs.map(o => o.altKm)));
check('notables: ISS reachable under some key, indices deduped',
      nb.some(n => /ISS|ZARYA/.test(objs[n.idx].name)) &&
      new Set(nb.map(n => n.idx)).size === nb.length);
/* when ISS is not otherwise notable it must get its own station entry */
const padded = objs.map(o => o.id === '25544' ? { ...o, altKm: 700 } : o);
check('notables: station key appears when ISS is not lowest/highest/newest',
      pickNotables(padded).some(n => n.key === 'station'));
check('notables on empty ensemble is empty', pickNotables([]).length === 0);

/* 14 — ground track + color --------------------------------------------------- */
console.log('\n[14] ground track + color');
const ef = new Float32Array(3);
eciToEarthFixed(1, 0.5, 0, Math.PI / 2, ef);
check('ECI->earth-fixed: quarter-turn about the polar axis, y preserved',
      Math.abs(ef[0]) < 1e-7 && ef[1] === 0.5 && Math.abs(ef[2] + 1) < 1e-7);
eciToEarthFixed(0.3, -0.2, 0.7, 1.234, ef);
check('frame conversion preserves length',
      Math.abs(Math.hypot(ef[0], ef[1], ef[2]) - Math.hypot(0.3, -0.2, 0.7)) < 1e-7);
const gt = new GroundTrack(5);
for (let i = 1; i <= 8; i++) gt.push(i, 0, 0);
check('track ring buffer wraps at capacity', gt.n === 5);
const seen = [];
gt.each((x, y, z, rec) => seen.push([x, rec]));
check('track iterates oldest->newest, normalized, recency in (0,1]',
      seen.length === 5 && seen.every(([x]) => x === 1) &&
      seen[0][1] < seen[4][1] && seen[4][1] === 1);
gt.push(NaN, 0, 0); gt.push(0, 0, 0);
check('track NaN/zero gate holds', gt.n === 5);
check('hsv anchors correct after extraction',
      JSON.stringify(hsv(0, 1, 1))   === JSON.stringify([255, 0, 0]) &&
      JSON.stringify(hsv(120, 1, 1)) === JSON.stringify([0, 255, 0]) &&
      JSON.stringify(hsv(240, 1, 1)) === JSON.stringify([0, 0, 255]));

/* 15 — earth ---------------------------------------------------------------- */
console.log('\n[15] earth');
check('coastline polylines present', COASTLINE_COUNT > 50);
check('latLonToXYZ lands on the unit sphere',
      [[0,0],[45,45],[-33.9,151.2],[90,0],[-90,0]]
        .every(([la,lo]) => Math.abs(norm(latLonToXYZ(la, lo)) - 1) < 1e-9));
check('north pole maps to -Y (globe upright in p5 space)',
      latLonToXYZ(90, 0)[1] < -0.999);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
