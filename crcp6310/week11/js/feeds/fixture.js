/*
  feeds/fixture.js — offline fallback: real recorded OMM elements (2026-07-14),
  clearly labeled as such in the HUD. Honest provenance: these are genuine
  catalog records that go stale, never synthesized fakes.
  esbuild's json loader inlines the fixture into the bundle.
*/

'use strict';

import records from './fixture_data.js';
import feed from './celestrak.js';

export const RECORDED_AT = '2026-07-14';
export function fixtureObjects() {
  /* drop the deliberately-malformed test records via the same NaN gate */
  return feed.normalize(records);
}
