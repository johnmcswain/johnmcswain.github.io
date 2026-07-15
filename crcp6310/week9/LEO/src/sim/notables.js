/*
  sim/notables.js — the focus tour's picks: pure selection over the
  normalized ensemble, headlessly testable. Order is the F-key cycle.
*/

'use strict';

export function pickNotables(objects) {
  if (!objects.length) return [];
  let newest = 0, lowest = 0, highest = 0, iss = -1;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    if (o.epoch > objects[newest].epoch)  newest = i;
    if (o.altKm < objects[lowest].altKm)  lowest = i;
    if (o.altKm > objects[highest].altKm) highest = i;
    if (iss < 0 && /\bISS\b|ZARYA/.test(o.name)) iss = i;
  }
  const out = [
    { key: 'newest elements', idx: newest },
    { key: 'lowest orbit',    idx: lowest },
    { key: 'highest orbit',   idx: highest },
  ];
  if (iss >= 0) out.push({ key: 'station', idx: iss });
  /* dedupe while preserving order (e.g. ISS may also be the lowest) */
  const seen = new Set();
  return out.filter(n => !seen.has(n.idx) && seen.add(n.idx));
}
