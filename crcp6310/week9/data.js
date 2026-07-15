'use strict';
/* data.js — QuakeFeed: the USGS live feed, the offline fallback, and the
   designed synthetic specimen. Owns feed selection (magnitude band + time
   window); the engine owns the live/synthetic MODE and layout. */

const TAU = Math.PI * 2;

export class QuakeFeed {
  static MAG_KEYS  = ['all', '2.5', '4.5', 'significant'];
  static MAG_LABEL = { all: 'all', ['2.5']: 'M2.5+', ['4.5']: 'M4.5+', significant: 'major' };
  static PERIODS   = ['hour', 'day', 'week', 'month'];

  constructor(){
    this.magIdx = 0;
    this.perIdx = 1;
    this.live = [];                                       // last successful (or offline-fallback) event list
    this.lastUpdated = 0;
  }

  get magKey(){ return QuakeFeed.MAG_KEYS[this.magIdx]; }
  get magLabel(){ return QuakeFeed.MAG_LABEL[this.magKey]; }
  get period(){ return QuakeFeed.PERIODS[this.perIdx]; }

  cycleMag(){ this.magIdx = (this.magIdx + 1) % QuakeFeed.MAG_KEYS.length; }
  cyclePeriod(){ this.perIdx = (this.perIdx + 1) % QuakeFeed.PERIODS.length; }

  /* fetch the current feed; resolves 'live' or 'offline' (never rejects) */
  async fetch(){
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/'
              + this.magKey + '_' + this.period + '.geojson';
    try{
      const res = await fetch(url); if(!res.ok) throw new Error(res.status);
      const data = await res.json();
      this.live = data.features
        .filter(f => f.properties.mag !== null && f.geometry)
        .map(f => ({ mag: f.properties.mag, place: f.properties.place, time: f.properties.time,
          depth: f.geometry.coordinates[2] ?? 0, url: f.properties.url }))
        .sort((a, b) => b.time - a.time);
      this.lastUpdated = (data.metadata && data.metadata.generated) || Date.now();
      return 'live';
    }catch(e){
      this.live = QuakeFeed.offline(this.period); this.lastUpdated = Date.now();
      return 'offline';
    }
  }

  /* offline fallback: a plausible synthetic event list for the window */
  static offline(per){
    const span = ({ hour: 3.6e6, day: 8.64e7, week: 6.05e8, month: 2.6e9 })[per];
    const now = Date.now(), out = [], n = per === 'month' ? 900 : per === 'week' ? 500 : 240;
    for(let i = 0; i < n; i++){
      const m = Math.max(-0.5, 7.5 * Math.pow(Math.random(), 3.2));
      out.push({ mag: m, place: 'synthetic event', time: now - Math.random() * span,
        depth: Math.pow(Math.random(), 2) * 300, url: '#' });
    }
    return out.sort((a, b) => b.time - a.time);
  }

  /* SYNTHETIC specimen: concentric, evenly spaced rings -> rotational
     symmetry + every shape band represented */
  static buildSpecimen(){
    const out = [];
    const ring = (radFrac, count, mag, sizeFrac, variants, phase) => {
      for(let j = 0; j < count; j++){
        const v = variants ? variants[j % variants.length] : null;
        out.push({ mag, depth: (j / Math.max(count, 1)) * 700, place: 'specimen', time: Date.now(),
          ang: (j / count) * TAU + (phase || 0), radFrac, sizeFrac, kp: v ? v[0] : 0, kq: v ? v[1] : 0 });
      }
    };
    ring(0.00, 1,  6.8, 0.120, [[3,5]], 0);                             // centerpiece knot
    ring(0.30, 8,  5.0, 0.072, [[2,3],[3,2],[2,5],[5,2]], 0);           // moderate knot variants
    ring(0.50, 8,  6.6, 0.085, [[3,5],[5,3],[3,4],[4,3]], Math.PI / 8); // strong knot variants
    ring(0.68, 16, 3.5, 0.045, null, 0);                                // torus rings
    ring(0.85, 24, 1.5, 0.020, null, Math.PI / 24);                     // torus dots
    return out;
  }
}
