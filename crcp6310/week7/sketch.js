/* =====================================================================
   Particle Motion Studies — CRCP 6310 (Week 7)
   John McSwain · jimcswain@smu.edu
   Live   — https://johnmcswain.github.io/crcp6310/week7/particles.html
   Sketch — https://johnmcswain.github.io/crcp6310/week7/sketch.js

   One live signal (Wikimedia EventStreams), six particle physics:
   Cellular · Flocking · Membrane · Crystalline · Thermal · Physarum.

   p5.js Web Editor: this file is sketch.js — the editor's index.html supplies
   p5 and the canvas. (In the standalone particles.html, this same code is
   inlined and p5 1.x is pulled from a CDN; both are built from one source.)
   ===================================================================== */

const TAU = Math.PI*2;

// ---- entropy pool (mulberry32, fed by the live stream) --------------
let poolState = (Date.now() >>> 0) || 1;
function rng(){ poolState=(poolState+0x6D2B79F5)|0; let t=Math.imul(poolState^(poolState>>>15),1|poolState); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }
const rrange=(a,b)=>a+(b-a)*rng();
const rint=n=>Math.floor(rng()*n);
function mixEntropy(x){ poolState=(poolState^(x|0))>>>0; poolState=Math.imul(poolState^(poolState>>>13),0x85EBCA6B)>>>0; }
function hashStr(s){ let h=2166136261>>>0; for(let k=0;k<s.length;k++){ h^=s.charCodeAt(k); h=Math.imul(h,16777619);} return h>>>0; }

// ---- chromatics -----------------------------------------------------
const mod360=x=>((x%360)+360)%360;
const HARMONIES=[
  { name:'Analogous', fn:(K,base)=>{ const span=120,out=[]; for(let k=0;k<K;k++){const t=K>1?k/(K-1):0.5; out.push({h:mod360(base+(t-0.5)*span),s:80,b:k%2?84:100});} return out; }},
  { name:'Complementary', fn:(K,base)=>{ const half=Math.ceil(K/2),spread=44,out=[]; for(let k=0;k<K;k++){const inA=k<half;const cnt=inA?half:K-half;const idx=inA?k:k-half;const t=cnt>1?idx/(cnt-1):0.5; out.push({h:mod360(base+(inA?0:180)+(t-0.5)*spread),s:80,b:k%2?84:100});} return out; }},
  { name:'Triadic', fn:(K,base)=>{ const out=[]; for(let k=0;k<K;k++) out.push({h:mod360(base+(k%3)*120),s:80,b:Math.floor(k/3)===0?100:74}); return out; }},
  { name:'Split-Comp', fn:(K,base)=>{ const a=[0,150,210],out=[]; for(let k=0;k<K;k++) out.push({h:mod360(base+a[k%3]),s:80,b:Math.floor(k/3)===0?100:76}); return out; }},
];
let baseHue=210, harmonyIndex=0; const HUE_SPEED=2;
let ph=[],ps=[],pb=[];
const K=6;

// ---- shared particle state ------------------------------------------
let S, N;
let px=[],py=[],vx=[],vy=[],sp=[];
let count=new Array(K).fill(0);
let paused=false, showMatrix=true;
const trailAlpha=0.14;

const wrapD=d=>(d>0.5?d-1:(d<-0.5?d+1:d));
const wrapPos=()=>{ for(let i=0;i<N;i++){ if(px[i]<0)px[i]+=1; else if(px[i]>=1)px[i]-=1; if(py[i]<0)py[i]+=1; else if(py[i]>=1)py[i]-=1; } };
const zeroVel=()=>{ for(let i=0;i<N;i++){ vx[i]=0; vy[i]=0; } };
function setSpecies(i,s){ count[sp[i]]--; sp[i]=s; count[s]++; }
function recount(){ count.fill(0); for(let i=0;i<N;i++) count[sp[i]]++; }

// --- reusable uniform-grid neighbor index: O(N) build, O(k) query, torus-aware ---
// Used by every radius-based behavior (cellular / flocking / thermal) so the
// pairwise-scan code lives in ONE place. cell width >= query radius => 3x3 covers it.
let CAND=new Int32Array(1);
function ensureCand(){ if(CAND.length<N) CAND=new Int32Array(N); }
function makeGrid(cell){
  const gN=Math.max(1,Math.floor(1/cell)), heads=new Int32Array(gN*gN), next=new Int32Array(N);
  return {
    build(){ heads.fill(-1); for(let i=0;i<N;i++){ let gx=(px[i]*gN)|0,gy=(py[i]*gN)|0; if(gx<0)gx=0;else if(gx>=gN)gx=gN-1; if(gy<0)gy=0;else if(gy>=gN)gy=gN-1; const c=gy*gN+gx; next[i]=heads[c]; heads[c]=i; } },
    collect(i){ let gx=(px[i]*gN)|0,gy=(py[i]*gN)|0; if(gx<0)gx=0;else if(gx>=gN)gx=gN-1; if(gy<0)gy=0;else if(gy>=gN)gy=gN-1; let n=0;
      for(let oy=-1;oy<=1;oy++){ const cy=((gy+oy)%gN+gN)%gN; for(let ox=-1;ox<=1;ox++){ const cx=((gx+ox)%gN+gN)%gN; let j=heads[cy*gN+cx]; while(j!==-1){ if(j!==i) CAND[n++]=j; j=next[j]; } } }
      return n; }
  };
}

// ---- stream state + coupling ---------------------------------------
const STREAM_URL='https://stream.wikimedia.org/v2/stream/recentchange';
let es=null, streamStatus='connecting', startMs=0, simTimer=null;
let liveInfluence=true, coupling=1.2;
const NOTABLE_BASE=700;
let eventQueue=[]; const MAX_QUEUE=600, MAX_DRAIN=60;
let evCount=0, eventsPerSec=0, rateT=0;
let intensity=0, intensityTarget=0;
let lastEvent=null;
const SIM_WIKIS=['en.wikipedia.org','commons.wikimedia.org','www.wikidata.org','de.wikipedia.org','es.wikipedia.org','fr.wikipedia.org','ja.wikipedia.org'];

// ---- shared coupling primitives ------------------------------------
function pickTargetOfSpecies(s){ for(let t=0;t<20;t++){ const i=rint(N); if(sp[i]===s) return i; } return rint(N); }
function convertSpecies(s){ if(count[s]>0.60*N) return; const i=rint(N); if(sp[i]!==s) setSpecies(i,s); }
function bloom(cx,cy,s){ if(count[s]>0.70*N) return; const r2=0.05*0.05;
  for(let i=0;i<N;i++){ const dx=wrapD(px[i]-cx),dy=wrapD(py[i]-cy); if(dx*dx+dy*dy<r2 && sp[i]!==s) setSpecies(i,s); } }
function shockwave(cx,cy,mag){ const R=0.13;
  for(let i=0;i<N;i++){ const dx=wrapD(px[i]-cx),dy=wrapD(py[i]-cy); const d=Math.hypot(dx,dy);
    if(d<R && d>1e-5){ const w=mag*(1-d/R)/d; vx[i]+=dx*w; vy[i]+=dy*w; } } }

// =====================================================================
//  BEHAVIOR REGISTRY  (enter / step / kick / onNotable / back / overlay)
// =====================================================================
const cellular = {
  name:'Cellular', mapping:'projects bloom & scatter cells', kick:4.0,
  dt:0.02, forceFactor:10, rMax:0.10, beta:0.30, frict:Math.pow(0.5,0.02/0.040), matrix:null,
  enter(){ zeroVel(); this.matrix=randomMatrix(); this.grid=makeGrid(this.rMax); },
  reroll(){ this.matrix=randomMatrix(); },
  force(r,a){ if(r<this.beta) return r/this.beta-1; if(r<1) return a*(1-Math.abs(2*r-1-this.beta)/(1-this.beta)); return 0; },
  step(){
    const m=this.matrix, rMax=this.rMax, g=this.grid; g.build();
    for(let i=0;i<N;i++){ let fx=0,fy=0; const xi=px[i],yi=py[i],row=m[sp[i]]; const cnt=g.collect(i);
      for(let k=0;k<cnt;k++){ const j=CAND[k]; const rx=wrapD(px[j]-xi),ry=wrapD(py[j]-yi); const d=Math.sqrt(rx*rx+ry*ry);
        if(d>0&&d<rMax){ const f=this.force(d/rMax,row[sp[j]]); fx+=(rx/d)*f; fy+=(ry/d)*f; } }
      fx*=rMax*this.forceFactor; fy*=rMax*this.forceFactor; vx[i]=vx[i]*this.frict+fx*this.dt; vy[i]=vy[i]*this.frict+fy*this.dt; }
    for(let i=0;i<N;i++){ px[i]+=vx[i]*this.dt; py[i]+=vy[i]*this.dt; } wrapPos();
  },
  overlay(){ if(showMatrix) drawMatrix(this.matrix); },
};

const flocking = {
  name:'Flocking', mapping:'edits startle · rate = speed', kick:0.018,
  R1:0.055, Rsep:0.020, maxS:0.0065, minS:0.0035, wAlign:0.06, wCoh:0.020, wSep:0.10,
  enter(){ this.grid=makeGrid(this.R1); this.nvx=new Float32Array(N); this.nvy=new Float32Array(N); for(let i=0;i<N;i++){ const a=rng()*TAU; vx[i]=Math.cos(a)*this.maxS; vy[i]=Math.sin(a)*this.maxS; } },
  reroll(){ this.enter(); },
  step(){
    const R1s=this.R1*this.R1, Rss=this.Rsep*this.Rsep, g=this.grid; g.build();
    const maxS=this.maxS*(0.5+0.9*intensity), minS=this.minS*(0.5+0.9*intensity);
    const nvx=this.nvx, nvy=this.nvy;
    for(let i=0;i<N;i++){ let av=0,aw=0,cx=0,cy=0,sx=0,sy=0,cnt=0; const xi=px[i],yi=py[i]; const c=g.collect(i);
      for(let k=0;k<c;k++){ const j=CAND[k]; const dx=wrapD(px[j]-xi),dy=wrapD(py[j]-yi); const d2=dx*dx+dy*dy;
        if(d2<R1s){ av+=vx[j]; aw+=vy[j]; cx+=dx; cy+=dy; cnt++; if(d2<Rss&&d2>0){ const inv=1/Math.sqrt(d2); sx-=dx*inv; sy-=dy*inv; } } }
      let nx=vx[i], ny=vy[i];
      if(cnt>0){ nx+=(av/cnt-vx[i])*this.wAlign; ny+=(aw/cnt-vy[i])*this.wAlign; nx+=(cx/cnt)*this.wCoh; ny+=(cy/cnt)*this.wCoh; nx+=sx*this.wSep*0.001; ny+=sy*this.wSep*0.001; }
      const m=Math.hypot(nx,ny);
      if(m>maxS){ nx=nx/m*maxS; ny=ny/m*maxS; } else if(m<minS&&m>0){ nx=nx/m*minS; ny=ny/m*minS; }
      nvx[i]=nx; nvy[i]=ny; }
    for(let i=0;i<N;i++){ vx[i]=nvx[i]; vy[i]=nvy[i]; px[i]+=vx[i]; py[i]+=vy[i]; } wrapPos();
  },
};

const membrane = {
  name:'Membrane', mapping:'edits pluck · rate = shimmer', kick:0.030,
  sa:null, sb:null, rest:null, nn:3, k:0.45, damp:0.92,
  enter(){ zeroVel(); this.build(); },
  reroll(){ this.enter(); },
  build(){ const set=new Set(),sa=[],sb=[],rest=[],nn=this.nn;
    for(let i=0;i<N;i++){ const best=[];
      for(let j=0;j<N;j++){ if(j===i)continue; const dx=wrapD(px[j]-px[i]),dy=wrapD(py[j]-py[i]); const d=Math.hypot(dx,dy);
        if(best.length<nn){ best.push({j,d}); best.sort((a,b)=>a.d-b.d); } else if(d<best[nn-1].d){ best[nn-1]={j,d}; best.sort((a,b)=>a.d-b.d); } }
      for(const b of best){ const a=Math.min(i,b.j),c=Math.max(i,b.j),key=a*N+c; if(!set.has(key)){ set.add(key); sa.push(a); sb.push(c); rest.push(b.d); } } }
    this.sa=sa; this.sb=sb; this.rest=rest; },
  step(){ const ax=new Float32Array(N), ay=new Float32Array(N); const sa=this.sa,sb=this.sb,rest=this.rest,k=this.k;
    for(let s=0;s<sa.length;s++){ const i=sa[s],j=sb[s]; let dx=wrapD(px[j]-px[i]),dy=wrapD(py[j]-py[i]); const d=Math.hypot(dx,dy)||1e-6; const f=k*(d-rest[s])/d; const fx=f*dx,fy=f*dy; ax[i]+=fx; ay[i]+=fy; ax[j]-=fx; ay[j]-=fy; }
    const sh=intensity*0.0015;
    for(let i=0;i<N;i++){ vx[i]=(vx[i]+ax[i])*this.damp + (rng()*2-1)*sh; vy[i]=(vy[i]+ay[i])*this.damp + (rng()*2-1)*sh; px[i]+=vx[i]; py[i]+=vy[i]; } wrapPos(); },
  back(){ const sa=this.sa,sb=this.sb; push(); stroke(0,0,100,0.10); strokeWeight(0.75);
    for(let s=0;s<sa.length;s++){ const i=sa[s],j=sb[s]; let dx=wrapD(px[j]-px[i]),dy=wrapD(py[j]-py[i]); if(Math.abs(dx)>0.5||Math.abs(dy)>0.5)continue; line(px[i]*S,py[i]*S,(px[i]+dx)*S,(py[i]+dy)*S); } pop(); },
};

const crystalline = {
  name:'Crystalline', mapping:'edits seed crystals · rate = growth',
  frozen:null, grid:null, gridN:0, cell:0, freezeDist:0.011,
  frozenCount:0, order:[], cap:0, stepBase:0.004,
  enter(){
    this.gridN=Math.max(8,Math.floor(1/this.freezeDist)); this.cell=1/this.gridN;
    this.grid=new Array(this.gridN*this.gridN); for(let c=0;c<this.grid.length;c++) this.grid[c]=[];
    this.frozen=new Uint8Array(N); this.frozenCount=0; this.order=[]; this.cap=Math.floor(N*0.5);
    zeroVel();
    for(let k=0;k<4;k++) this.freezeAs(rint(N), rint(K));
  },
  reroll(){ this.enter(); },
  cidx(x,y){ let gx=Math.floor(x*this.gridN),gy=Math.floor(y*this.gridN); gx=((gx%this.gridN)+this.gridN)%this.gridN; gy=((gy%this.gridN)+this.gridN)%this.gridN; return gy*this.gridN+gx; },
  freezeAs(i,s){
    if(this.frozen[i]){ setSpecies(i,s); return; }
    if(this.frozenCount>=this.cap) this.recycleOldest();
    setSpecies(i,s); this.frozen[i]=1; this.grid[this.cidx(px[i],py[i])].push(i); this.order.push(i); this.frozenCount++; vx[i]=0; vy[i]=0;
  },
  recycleOldest(){
    while(this.order.length){ const idx=this.order.shift(); if(this.frozen[idx]){ this.frozen[idx]=0;
      const arr=this.grid[this.cidx(px[idx],py[idx])]; const p=arr.indexOf(idx); if(p>=0) arr.splice(p,1); this.frozenCount--;
      const a=rng()*TAU, r=this.freezeDist*2.5; px[idx]+=Math.cos(a)*r; py[idx]+=Math.sin(a)*r;
      if(px[idx]<0)px[idx]+=1; else if(px[idx]>=1)px[idx]-=1; if(py[idx]<0)py[idx]+=1; else if(py[idx]>=1)py[idx]-=1; return; } }
  },
  step(){
    const step=this.stepBase*(0.5+intensity*1.2), fd2=this.freezeDist*this.freezeDist, gN=this.gridN;
    for(let i=0;i<N;i++){ if(this.frozen[i]) continue;
      px[i]+=(rng()*2-1)*step; py[i]+=(rng()*2-1)*step;
      if(px[i]<0)px[i]+=1; else if(px[i]>=1)px[i]-=1; if(py[i]<0)py[i]+=1; else if(py[i]>=1)py[i]-=1;
      const gx=Math.floor(px[i]*gN), gy=Math.floor(py[i]*gN); let stuck=-1;
      for(let oy=-1;oy<=1 && stuck<0;oy++) for(let ox=-1;ox<=1 && stuck<0;ox++){
        const cx=((gx+ox)%gN+gN)%gN, cy=((gy+oy)%gN+gN)%gN, arr=this.grid[cy*gN+cx];
        for(let a=0;a<arr.length;a++){ const j=arr[a]; const dx=wrapD(px[j]-px[i]),dy=wrapD(py[j]-py[i]); if(dx*dx+dy*dy<fd2){ stuck=j; break; } } }
      if(stuck>=0) this.freezeAs(i, sp[stuck]);
    }
  },
  coupleEvent(server,delta,s){
    if(Math.abs(delta) < NOTABLE_BASE/coupling) return;
    let seed=-1; for(let t=0;t<30;t++){ const i=rint(N); if(!this.frozen[i]){ seed=i; break; } }
    if(seed<0) return; this.freezeAs(seed,s);
    lastEvent={x:px[seed],y:py[seed],s,delta,wiki:server,t:millis()};
  },
  render(){
    for(let i=0;i<N;i++){ const s=sp[i],x=px[i]*S,y=py[i]*S;
      if(this.frozen[i]){ fill(ph[s],ps[s],pb[s],0.12); circle(x,y,8); fill(ph[s],ps[s],pb[s],1); circle(x,y,3.8); }
      else { fill(ph[s],ps[s],Math.max(30,pb[s]-30),0.30); circle(x,y,2.2); } }
  },
};

const thermal = {
  name:'Thermal', mapping:'edit rate = temperature', kick:0.030,
  T:0.3, d0:0.030, rC:0.055, kC:0.14,
  enter(){ zeroVel(); this.T=0.3; this.grid=makeGrid(this.rC); },
  reroll(){ zeroVel(); },
  step(){ const target=liveInfluence?constrain(eventsPerSec/40,0.05,1.2):0.12; this.T+=(target-this.T)*0.05;
    const noise=this.T*0.011, rC=this.rC, rC2=rC*rC, d0=this.d0, g=this.grid; g.build();
    for(let i=0;i<N;i++){ let axv=0,ayv=0; const xi=px[i],yi=py[i]; const c=g.collect(i);
      for(let k=0;k<c;k++){ const j=CAND[k]; const dx=wrapD(px[j]-xi),dy=wrapD(py[j]-yi); const d2=dx*dx+dy*dy;
        if(d2<rC2&&d2>1e-9){ const d=Math.sqrt(d2); const f=this.kC*(d-d0)*(1-d/rC)/d; axv+=dx*f; ayv+=dy*f; } }
      vx[i]=(vx[i]+axv+(rng()*2-1)*noise)*0.90; vy[i]=(vy[i]+ayv+(rng()*2-1)*noise)*0.90; }
    for(let i=0;i<N;i++){ px[i]+=vx[i]; py[i]+=vy[i]; } wrapPos(); },
  overlay(){ push(); fill(0,0,100,0.5); textSize(11); textAlign(LEFT,TOP); const hot=this.T>0.6?'hot':(this.T>0.3?'warm':'cold'); text('T = '+this.T.toFixed(2)+'  ('+hot+')',14,14); pop(); },
};

const physarum = {
  name:'Physarum', mapping:'edits drop food · network grows',
  G:180, step:0.0022, sensorDist:0.013, sensorAngle:0.45, rotate:0.55, deposit:1.0, decay:0.90,
  field:null, tmp:null, lut:null, gfx:null, head:null, foods:[], lutHue:null,
  enter(){
    zeroVel(); const G=this.G;
    if(!this.field || this.field.length!==G*G){ this.field=new Float32Array(G*G); this.tmp=new Float32Array(G*G); this.lut=new Float32Array(768); }
    else this.field.fill(0);
    if(!this.gfx){ this.gfx=createGraphics(G,G); this.gfx.pixelDensity(1); }
    this.foods=[]; this.head=new Float32Array(N);
    for(let i=0;i<N;i++) this.head[i]=rng()*TAU;
  },
  reroll(){ this.enter(); },
  sample(nx,ny){ const G=this.G; let x=nx-Math.floor(nx), y=ny-Math.floor(ny); let gx=(x*G)|0, gy=(y*G)|0; if(gx>=G)gx=G-1; if(gy>=G)gy=G-1; return this.field[gy*G+gx]; },
  blob(nx,ny,amt){ const G=this.G, cx=(nx*G)|0, cy=(ny*G)|0, R=4;
    for(let oy=-R;oy<=R;oy++) for(let ox=-R;ox<=R;ox++){ const d2=ox*ox+oy*oy; if(d2>R*R)continue; const gx=((cx+ox)%G+G)%G, gy=((cy+oy)%G+G)%G; this.field[gy*G+gx]+=amt*(1-Math.sqrt(d2)/R); } },
  step(){
    const G=this.G, f=this.field, tmp=this.tmp;
    const st=this.step*(0.6+intensity*0.9), sd=this.sensorDist, sa=this.sensorAngle, rot=this.rotate, dep=this.deposit, H=this.head;
    for(let i=0;i<N;i++){
      const a=H[i], x=px[i], y=py[i];
      const fC=this.sample(x+Math.cos(a)*sd, y+Math.sin(a)*sd);
      const fL=this.sample(x+Math.cos(a-sa)*sd, y+Math.sin(a-sa)*sd);
      const fR=this.sample(x+Math.cos(a+sa)*sd, y+Math.sin(a+sa)*sd);
      let na=a;
      if(fC>=fL && fC>=fR){}
      else if(fL>fR) na=a-rot;
      else if(fR>fL) na=a+rot;
      else na=a+(rng()<0.5?rot:-rot);
      H[i]=na;
      let nx=x+Math.cos(na)*st, ny=y+Math.sin(na)*st;
      if(nx<0)nx+=1; else if(nx>=1)nx-=1; if(ny<0)ny+=1; else if(ny>=1)ny-=1;
      px[i]=nx; py[i]=ny;
      let gx=(nx*G)|0, gy=(ny*G)|0; if(gx<0)gx=0; else if(gx>=G)gx=G-1; if(gy<0)gy=0; else if(gy>=G)gy=G-1;
      f[gy*G+gx]+=dep;
    }
    const now=millis();
    for(const fo of this.foods) this.blob(fo.x,fo.y,fo.str), fo.str*=0.985;
    this.foods=this.foods.filter(fo=>fo.str>0.05 && now-fo.born<7000);
    const dec=this.decay;
    for(let y=0;y<G;y++){ const yo=y*G; for(let x=0;x<G;x++){ const l=(x-1+G)%G, r=(x+1)%G; tmp[yo+x]=(f[yo+l]+f[yo+x]+f[yo+r])/3; } }
    for(let y=0;y<G;y++){ const u=((y-1+G)%G)*G, d=((y+1)%G)*G, yo=y*G; for(let x=0;x<G;x++){ f[yo+x]=((tmp[u+x]+tmp[yo+x]+tmp[d+x])/3)*dec; } }
  },
  coupleEvent(server,delta,s){ if(Math.abs(delta)<NOTABLE_BASE/coupling) return; const x=rng(),y=rng();
    this.foods.push({x,y,str:constrain(Math.abs(delta)/1500,0.4,3)*coupling,born:millis()}); lastEvent={x,y,s,delta,wiki:server,t:millis()}; },
  render(){
    const G=this.G, f=this.field, gp=this.gfx, lut=this.lut;
    if(this.lutHue!==baseHue){ this.lutHue=baseHue; for(let l=0;l<256;l++){ const t=l/255; const c=color(baseHue, constrain(90-70*t,0,100), constrain(14+92*t,0,100)); lut[l*3]=red(c); lut[l*3+1]=green(c); lut[l*3+2]=blue(c); } }
    gp.loadPixels(); const p8=gp.pixels;
    for(let i=0;i<G*G;i++){ let l=f[i]*22; if(l>255)l=255; l=l|0; const b=i*4,o=l*3; p8[b]=lut[o]; p8[b+1]=lut[o+1]; p8[b+2]=lut[o+2]; p8[b+3]=255; }
    gp.updatePixels();
    push(); imageMode(CORNER); image(gp,0,0,S,S); pop();
    push(); stroke(0,0,100,0.05); strokeWeight(1); for(let i=0;i<N;i++) point(px[i]*S,py[i]*S); pop();
  },
};

const BEHAVIORS=[cellular, flocking, membrane, crystalline, thermal, physarum];
let behaviorIndex=0;
const current=()=>BEHAVIORS[behaviorIndex];

// =====================================================================
function setup(){
  S=Math.floor(Math.min(windowWidth,windowHeight));
  createCanvas(S,S); colorMode(HSB,360,100,100,1); noStroke();
  buildPalette(); N=constrain(Math.round(S*S/900),300,1000);
  initParticles(); current().enter(); background(0,0,3);
  startMs=millis(); rateT=millis(); connectStream();
}
let lastHue=-1, lastHarm=-1;
function buildPalette(){ if(baseHue===lastHue && harmonyIndex===lastHarm) return; lastHue=baseHue; lastHarm=harmonyIndex; const c=HARMONIES[harmonyIndex].fn(K,baseHue); ph=c.map(x=>x.h); ps=c.map(x=>x.s); pb=c.map(x=>x.b); }
function initParticles(){ px=[];py=[];vx=[];vy=[];sp=[]; for(let i=0;i<N;i++){ px.push(rng()); py.push(rng()); vx.push(0); vy.push(0); sp.push(rint(K)); } recount(); ensureCand(); }
function randomMatrix(){ const m=[]; for(let i=0;i<K;i++){ const r=[]; for(let j=0;j<K;j++) r.push(rng()*2-1); m.push(r);} return m; }

// ---- stream plumbing ------------------------------------------------
function connectStream(){ try{ es=new EventSource(STREAM_URL);
    es.onmessage=(e)=>{ if(streamStatus!=='live'){ streamStatus='live'; stopSim(); } try{ const d=JSON.parse(e.data); if(d&&d.meta&&d.meta.domain==='canary')return; enqueue(d);}catch(_){} };
    es.onerror=()=>{}; }catch(_){ startSim(); } }
function startSim(){ if(simTimer)return; streamStatus='sim';
  simTimer=setInterval(()=>{ const server=SIM_WIKIS[Math.floor(Math.random()*SIM_WIKIS.length)]; const big=Math.random()<0.24; const delta=Math.round((Math.random()*2-1)*(big?2400:300));
    enqueue({server_name:server,length:{old:1000,new:1000+delta},title:'Sim/'+Math.random().toString(36).slice(2,8),user:'Sim'+Math.floor(Math.random()*9999),meta:{}}); },120); }
function stopSim(){ if(simTimer){ clearInterval(simTimer); simTimer=null; } }
function enqueue(d){ if(eventQueue.length<MAX_QUEUE) eventQueue.push(d); evCount++; }
function drainEvents(){
  let n=Math.min(MAX_DRAIN,eventQueue.length);
  while(n-->0){ const d=eventQueue.shift(); const server=d.server_name||d.wiki||'';
    let delta=0; if(d.length&&typeof d.length.new==='number'&&typeof d.length.old==='number') delta=d.length.new-d.length.old;
    mixEntropy(delta); mixEntropy(hashStr(server)); mixEntropy(d.title?d.title.length:0); mixEntropy(d.user?hashStr(String(d.user)):0);
    if(!liveInfluence) continue;
    const s=hashStr(server)%K;
    if(current().coupleEvent){ current().coupleEvent(server,delta,s); continue; }
    // continuous: species mix tracks active projects
    let conv=Math.round((1+Math.min(3,Math.floor(Math.abs(delta)/1500)))*coupling);
    for(let c=0;c<conv;c++) convertSpecies(s);
    // punctuated: notable edits act on a real cluster with reach
    const eff=NOTABLE_BASE/coupling;
    if(Math.abs(delta)>=eff){
      const i0=pickTargetOfSpecies(s); const cx=px[i0], cy=py[i0];
      bloom(cx,cy,s);
      const size=constrain(Math.abs(delta)/2500,0.3,1.6)*coupling;
      shockwave(cx,cy,current().kick*size);
      if(current().onNotable) current().onNotable(cx,cy,s,delta,size);
      lastEvent={x:cx,y:cy,s,delta,wiki:server,t:millis()};
    }
  }
}

// ---- loop -----------------------------------------------------------
function draw(){
  if(keyIsDown(LEFT_ARROW)) baseHue=mod360(baseHue-HUE_SPEED);
  if(keyIsDown(RIGHT_ARROW)) baseHue=mod360(baseHue+HUE_SPEED);
  buildPalette();
  if(streamStatus==='connecting' && millis()-startMs>4000) startSim();
  if(millis()-rateT>1000){ eventsPerSec=evCount; evCount=0; rateT=millis(); intensityTarget=constrain(eventsPerSec/35,0,1.5); }
  intensity += (intensityTarget-intensity)*0.05;
  drainEvents();

  fill(0,0,3,trailAlpha); rect(0,0,S,S);
  if(!paused){ current().step(); applyStir(); }
  if(current().back) current().back();
  if(current().render) current().render(); else render();
  drawEventMarker();
  if(current().overlay) current().overlay();
  drawHUD();
}
function applyStir(){ if(!(mouseIsPressed&&mouseX>=0&&mouseX<S&&mouseY>=0&&mouseY<S))return; const mx=mouseX/S,my=mouseY/S,R=0.14;
  for(let i=0;i<N;i++){ const dx=wrapD(mx-px[i]),dy=wrapD(my-py[i]); const d=Math.hypot(dx,dy); if(d<R){ const p=0.15*(1-d/R); px[i]+=dx*p; py[i]+=dy*p; } } wrapPos(); }
function render(){ for(let i=0;i<N;i++){ const s=sp[i],x=px[i]*S,y=py[i]*S; fill(ph[s],ps[s],pb[s],0.10); circle(x,y,9); fill(ph[s],ps[s],pb[s],1); circle(x,y,3.4); } }

function drawEventMarker(){ if(!lastEvent)return; const age=(millis()-lastEvent.t)/1000; if(age>1.2)return;
  const x=lastEvent.x*S,y=lastEvent.y*S,s=lastEvent.s;
  push(); noFill(); stroke(ph[s],ps[s],pb[s],1-age/1.2); strokeWeight(2); circle(x,y,10+age*0.13*2*S);
  noStroke(); fill(0,0,100,0.85*(1-age/1.2)); textSize(11); textAlign(CENTER,BOTTOM);
  text((lastEvent.delta>=0?'+':'')+lastEvent.delta+'  '+lastEvent.wiki.replace('.org',''),x,y-8-age*40); pop(); }
function drawMatrix(m){ const cell=15,ox=14,oy=40; push();
  for(let k=0;k<K;k++){ fill(ph[k],ps[k],pb[k],1); rect(ox+(k+1)*cell,oy,cell-2,cell-2); rect(ox,oy+(k+1)*cell,cell-2,cell-2); }
  for(let i=0;i<K;i++)for(let j=0;j<K;j++){ const v=m[i][j]; fill(v>=0?150:0,80,25+70*Math.min(1,Math.abs(v)),1); rect(ox+(j+1)*cell,oy+(i+1)*cell,cell-2,cell-2); } pop(); }

function drawHUD(){
  push();
  const dotHue=streamStatus==='live'?130:(streamStatus==='sim'?40:0);
  const label=streamStatus==='live'?'LIVE':(streamStatus==='sim'?'SIM':'connecting');
  textAlign(RIGHT,TOP); textSize(12);
  fill(dotHue,80,95,1); circle(S-150,20,9);
  fill(0,0,100,0.85); text(label+'   '+eventsPerSec+' ev/s',S-14,14);
  fill(0,0,100,0.45); textSize(10); text('coupling x'+coupling.toFixed(1)+(liveInfluence?'':'  (paused)'),S-14,34);

  // live species-mix bar (composition tracks active projects)
  const bw=150,bx=14,by=S-66,bh=12; let cum=0;
  for(let k=0;k<K;k++){ const w=bw*count[k]/N; fill(ph[k],ps[k],pb[k],1); rect(bx+cum,by,Math.max(0,w-0.5),bh); cum+=w; }
  fill(0,0,100,0.85); textSize(13); textAlign(LEFT,BOTTOM);
  text(current().name+'  \u2014  '+current().mapping,14,by-6);
  fill(0,0,100,0.5); textSize(11);
  text(HARMONIES[harmonyIndex].name+'  ·  hue '+Math.round(baseHue)+'\u00B0',bx+bw+10,S-56);
  fill(0,0,100,0.45);
  text('B behavior · \u2190\u2192 hue · H harmony · R reroll · Space pause',14,S-22);
  text('M matrix · C reseed · L stream · [ ] coupling · drag stir',14,S-8);
  pop();
}

function keyPressed(){
  if(key==='b'||key==='B'){ behaviorIndex=(behaviorIndex+1)%BEHAVIORS.length; current().enter(); }
  else if(key==='r'||key==='R'){ const c=current(); if(c.reroll)c.reroll(); else c.enter(); }
  else if(key===' ') paused=!paused;
  else if(key==='m'||key==='M') showMatrix=!showMatrix;
  else if(key==='c'||key==='C'){ initParticles(); current().enter(); }
  else if(key==='h'||key==='H') harmonyIndex=(harmonyIndex+1)%HARMONIES.length;
  else if(key==='l'||key==='L') liveInfluence=!liveInfluence;
  else if(key==='[') coupling=Math.max(0.2,Math.round((coupling-0.2)*10)/10);
  else if(key===']') coupling=Math.min(3.0,Math.round((coupling+0.2)*10)/10);
  if(keyCode===LEFT_ARROW||keyCode===RIGHT_ARROW) return false;
}
function windowResized(){ S=Math.floor(Math.min(windowWidth,windowHeight)); resizeCanvas(S,S); N=constrain(Math.round(S*S/900),300,1000); initParticles(); current().enter(); background(0,0,3); }
