/*
  sim/tracker.js — the observer's sky, as shared orchestration.

  WHY THIS EXISTS: this logic lived inside the p5 composition root, so the
  Three renderer could not have Observer Mode without duplicating ~50 lines
  of pass-tracking — and duplicated orchestration is exactly how the two
  builds drifted apart in the first place. Pulled below the renderer
  boundary it is pure, headlessly testable, and shared: both roots feed it
  positions and read the same answer.

  Injection instead of imports: positionAtKm(obj, tMs, out) writes a
  true-scale core-frame km position, so the tracker needs no propagator,
  no ephemeris module, and no renderer.
*/

'use strict';

import { coreToEci, visibilityState, solarElevationDeg, MIN_ELEV_DEG }
  from './observer.js';
import { inShadow } from './sun.js';
import { passEndsInMin } from './observer.js';

export class SkyTracker {
  #prevId = null;
  #prevRange = 0;
  #prevSimT = 0;
  #eci = new Float64Array(3);
  #fut = new Float64Array(3);
  #futEci = new Float64Array(3);

  /* sun: the ephemeris result; sunAt(tMs): ephemeris at a future instant
     (only used for the pass-duration search). Returns null when there is
     no observer or nothing above the horizon. */
  update({ observer, objects, headsKm, sun, sunAt, simT, positionAtKm, isDark }) {
    if (!observer || !objects.length) { this.#prevId = null; return null; }
    const solarElevDeg = solarElevationDeg(
      observer.lat, observer.lon, sun.declDeg, sun.subsolarLonDeg);

    let best = null, bestAny = null, above = 0, visible = 0;
    for (let i = 0; i < objects.length; i++) {
      coreToEci(headsKm[i*3], headsKm[i*3+1], headsKm[i*3+2], this.#eci);
      const look = observer.lookAt(this.#eci[0], this.#eci[1], this.#eci[2], sun.gmstDeg);
      if (look.elevDeg < MIN_ELEV_DEG) continue;
      above++;
      const vis = visibilityState({ elevDeg: look.elevDeg,
        sunlit: !isDark(i), solarElevDeg });
      if (!bestAny || look.elevDeg > bestAny.elevDeg) bestAny = { idx: i, ...look, vis };
      if (vis === 'visible') {
        visible++;
        if (!best || look.elevDeg > best.elevDeg) best = { idx: i, ...look, vis };
      }
    }
    const pick = best || bestAny;
    if (!pick) { this.#prevId = null; return { tracked: null, above, visible }; }

    const obj = objects[pick.idx];
    const dtSim = (simT - this.#prevSimT) / 1000;        // simulated seconds
    const rangeRate = (this.#prevId === obj.id && dtSim > 1e-3)
      ? (pick.rangeKm - this.#prevRange) / dtSim : 0;
    const changed = this.#prevId !== obj.id;
    this.#prevId = obj.id; this.#prevRange = pick.rangeKm; this.#prevSimT = simT;

    /* remaining visibility, by forward search on the real geometry */
    let passMin = 0;
    if (best && sunAt) {
      passMin = passEndsInMin(tt => {
        positionAtKm(obj, tt, this.#fut);
        const s2 = sunAt(tt);
        coreToEci(this.#fut[0], this.#fut[1], this.#fut[2], this.#futEci);
        const lk = observer.lookAt(this.#futEci[0], this.#futEci[1], this.#futEci[2],
                                  s2.gmstDeg);
        return { elevDeg: lk.elevDeg,
          sunlit: !inShadow(this.#fut[0], this.#fut[1], this.#fut[2], s2.eciDir),
          solarElevDeg: solarElevationDeg(observer.lat, observer.lon,
                                          s2.declDeg, s2.subsolarLonDeg) };
      }, simT);
    }

    return {
      tracked: { id: obj.id, name: obj.name, idx: pick.idx, obj, ...pick },
      isVisible: !!best, changed, rangeRate, passMin,
      above, visible, solarElevDeg,
    };
  }
}
