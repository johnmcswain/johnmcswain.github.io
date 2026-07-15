'use strict';
/* hud.js — Hud: every DOM overlay touch lives here (panel, ramp, status pip,
   motif/sound buttons, hover card). All lookups are guarded so the sketch
   also runs headless / in the p5.js editor with no overlay markup. */

export class Hud {
  /* DOM helpers — guarded so the sketch also runs without the overlay */
  static $(id){ return document.getElementById(id); }
  static setText(id, v){ const e = Hud.$(id); if(e) e.textContent = v; }

  static shortPlace(p){ if(!p) return ''; const i = p.indexOf('of '); return i >= 0 ? p.slice(i + 3) : p; }

  static ago(t){
    const s = (Date.now() - t) / 1000;
    if(s < 90)     return Math.round(s) + 's ago';
    if(s < 5400)   return Math.round(s / 60) + 'm ago';
    if(s < 172800) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }

  bindButtons({ onHarmony, onData, onMotif, onSound }){
    const hb = Hud.$('harmonybtn'); if(hb) hb.addEventListener('click', onHarmony);
    const db = Hud.$('databtn');    if(db){ db.textContent = 'DATA: LIVE'; db.addEventListener('click', onData); }
    const mb = Hud.$('motifbtn');   if(mb) mb.addEventListener('click', onMotif);
    const sb = Hud.$('soundbtn');   if(sb) sb.addEventListener('click', onSound);
  }

  updateRamp(palette){
    const ramp = document.querySelector('.ramp'); if(!ramp) return;
    const stops = [];
    for(let i = 0; i <= 6; i++){
      const t = i / 6, c = palette.depthColor(t * 700).map(Math.round);
      stops.push('rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ') ' + Math.round(t * 100) + '%');
    }
    ramp.style.background = 'linear-gradient(90deg, ' + stops.join(',') + ')';
  }

  updatePalLabel(palette){
    Hud.setText('s-pal', palette.name + ' \u00b7 ' + Math.round(palette.baseHue) + '\u00b0');
  }

  updateHarmonyButton(palette){ Hud.setText('harmonybtn', palette.name.toUpperCase()); }
  updateDataButton(dataMode){ Hud.setText('databtn', dataMode === 'live' ? 'DATA: LIVE' : 'DATA: SYNTH'); }

  /* the left status panel — reads a snapshot of engine state */
  updatePanel(engine){
    const feed = engine.feed, palette = engine.palette;
    const cap = engine.maxSeedsFor(feed.period);
    Hud.setText('s-src',  engine.dataMode === 'live' ? 'USGS live' : 'synthetic');
    Hud.setText('s-feed', feed.magLabel + ' / ' + feed.period);
    Hud.setText('s-count', engine.quakes.length
      + (engine.dataMode === 'live' && engine.quakes.length > cap ? ' (showing ' + cap + ')' : ''));
    Hud.setText('s-sym', engine.symmetry + '-fold');
    this.updatePalLabel(palette);
    Hud.setText('s-motif', engine.activeMotif().name + ' \u00b7 ' + (engine.motifIdx + 1) + '/' + engine.motifs.length);
    Hud.setText('c-mag', feed.magLabel);
    Hud.setText('c-per', feed.period);
    Hud.setText('s-upd', feed.lastUpdated ? Hud.ago(feed.lastUpdated) : '\u2014');
    const top = engine.quakes.reduce((a, b) => (b.mag > ((a && a.mag) ?? -9) ? b : a), null);
    Hud.setText('s-max', top ? 'M' + top.mag.toFixed(1) + ' \u00b7 ' + Hud.shortPlace(top.place) : '\u2014');
  }

  refreshMotifUI(engine){
    const m = engine.activeMotif();
    Hud.setText('motifbtn', (engine.motifIdx + 1) + ' \u00b7 ' + m.name.toUpperCase());
    Hud.setText('motiflabel', m.name);
    const sb = Hud.$('soundbtn');
    if(sb){
      sb.textContent = engine.sonifier.on ? 'SOUND: ON' : 'SOUND: OFF';
      sb.classList.toggle('on', engine.sonifier.on);
    }
  }

  renderStatus(liveState, dataMode){
    const el = Hud.$('status'); if(!el) return;
    if(dataMode === 'synthetic'){ el.className = 'status synth'; el.textContent = 'synthetic specimen'; return; }
    el.className = 'status ' + liveState;
    el.textContent = liveState === 'live' ? 'live' : liveState === 'offline' ? 'offline \u00b7 cached' : 'loading';
  }

  /* hover card: pass the hovered seed, or null to hide */
  hover(best){
    const el = Hud.$('hover'); if(!el) return;
    if(best){
      el.classList.add('on');
      const hm = Hud.$('h-mag');
      if(hm){ hm.textContent = best.mag.toFixed(1); hm.style.color = 'rgb(' + best.col.map(Math.round).join(',') + ')'; }
      Hud.setText('h-place', best.place || 'unknown locale');
      Hud.setText('h-meta', best.depth.toFixed(0) + ' km deep \u00b7 ' + Hud.ago(best.time));
    } else el.classList.remove('on');
  }
}
