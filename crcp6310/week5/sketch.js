/*
================================================================================
  FLOWING POLYGON ATTRACTORS  —  p5.js sketch
  Strange attractors (Lorenz, Rössler, Aizawa, Thomas, Halvorsen) drawn as a
  stream of polygons flowing along the trajectory.
--------------------------------------------------------------------------------
  Author : John McSwain (jimcswain@smu.edu)
  Repo   : https://github.com/johnmcswain/johnmcswain.github.io/week5/polygon-attractors.html
  Live   : https://johnmcswain.github.io/week5/polygon-attractors.html
--------------------------------------------------------------------------------
  RUN : drop this into the p5.js web editor, OR load it after p5.js from an
        index.html, e.g.
          <script src="p5.min.js"></script>
          <script src="sketch.js"></script>
  CONTROLS:
    Scroll ......... zoom in / out          Double-click ... reset zoom
    Drag ........... rotate the view        B .............. skiatron / dark theme
    1 – 5 .......... choose attractor        T .............. cycle palette (dark only)
    [  ] ........... polygon sides           -  = ........... fractal depth
    Up / Down ...... flow speed              Left / Right ... colour-wheel spin
    ,  . ........... stream count
  THEMES : dark = colourful palettes; skiatron = monochrome dark-trace CRT.
================================================================================
*/
"use strict";

// --- chaotic systems: each f returns the derivative (ẋ, ẏ, ż) at a point ---
const SYS = {
  Lorenz:    { dt:.006, s:[.1,0,0],          f:(x,y,z)=>[10*(y-x), x*(28-z)-y, x*y-8/3*z] },
  "Rössler": { dt:.02,  s:[.1,0,0],          f:(x,y,z)=>[-y-z, x+.2*y, .2+z*(x-5.7)] },
  Aizawa:    { dt:.012, s:[.1,0,0],          f:(x,y,z)=>[(z-.7)*x-3.5*y, 3.5*x+(z-.7)*y,
                                               .6+.95*z-z*z*z/3-(x*x+y*y)*(1+.25*z)+.1*z*x*x*x] },
  Thomas:    { dt:.05,  s:[1.1,1.1,-.5],     f:(x,y,z)=>[Math.sin(y)-.208*x, Math.sin(z)-.208*y, Math.sin(x)-.208*z] },
  Halvorsen: { dt:.008, s:[-1.48,-1.51,2.04],f:(x,y,z)=>[-1.89*x-4*y-4*z-y*y, -1.89*y-4*z-4*x-z*z, -1.89*z-4*x-4*y-x*x] }
};
const NAMES = Object.keys(SYS);

// Runge–Kutta 4 — one integration step of system f, from state s, over time dt
const rk4 = (f,s,dt) => {
  const k1=f(...s),
        k2=f(s[0]+dt/2*k1[0], s[1]+dt/2*k1[1], s[2]+dt/2*k1[2]),
        k3=f(s[0]+dt/2*k2[0], s[1]+dt/2*k2[1], s[2]+dt/2*k2[2]),
        k4=f(s[0]+dt*k3[0],   s[1]+dt*k3[1],   s[2]+dt*k3[2]);
  return s.map((v,i)=> v + dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
};

// fractal polygon: a regular n-gon, then `depth` recursive Koch passes
const TAU2 = Math.PI*2;
const ngon = n => Array.from({length:n}, (_,i) => { const a=i/n*TAU2-Math.PI/2; return [Math.cos(a),Math.sin(a)]; });
const koch = pts => pts.flatMap((p1,i) => {                 // every edge -> 4 edges with an outward bump
  const p2=pts[(i+1)%pts.length];
  const a=[p1[0]+(p2[0]-p1[0])/3, p1[1]+(p2[1]-p1[1])/3];
  const b=[p1[0]+2/3*(p2[0]-p1[0]), p1[1]+2/3*(p2[1]-p1[1])];
  const vx=b[0]-a[0], vy=b[1]-a[1], turn=(c,s)=>[a[0]+vx*c-vy*s, a[1]+vx*s+vy*c];
  let peak=turn(Math.cos(-TAU2/6), Math.sin(-TAU2/6));
  if (peak[0]**2+peak[1]**2 < ((a[0]+b[0])/2)**2 + ((a[1]+b[1])/2)**2)   // flip if it pointed inward
      peak=turn(Math.cos(TAU2/6), Math.sin(TAU2/6));
  return [p1, a, peak, b];
});
const fractalPoly = (sides,depth) => { let p=ngon(sides); while (depth-->0) p=koch(p); return p; };

// colour palettes (dark theme) as HSB hue ranges; the end hue may exceed 360 and wrap
const THEMES = [
  {name:"Aurora",h:[160,280],sat:85,bri:92}, {name:"Ember",h:[5,55],sat:92,bri:96},
  {name:"Spectrum",h:[0,340],sat:82,bri:96}, {name:"Ice",h:[185,215],sat:50,bri:100},
  {name:"Magma",h:[280,400],sat:90,bri:95}
];
// skiatron (light theme) monochrome: dark trace blended toward the grey field by depth
const FIELD=[168,169,163], TRACE=[35,42,54];
const mix = k => [lerp(FIELD[0],TRACE[0],k), lerp(FIELD[1],TRACE[1],k), lerp(FIELD[2],TRACE[2],k)];

// --- state ---
let path=[], poly=[], cn=0;                 // trajectory · current polygon · its vertex count
let sysName="Lorenz", sides=5, depth=1, want=320, count=320, themeIx=0;
let phase=0, flow=1, spin=.12, hue=0, light=false;
let zoom=1, zTarget=1, rx=.35, ry=0, drag=false, mx=0, my=0, cx, cy, scl;
const BUDGET=110000;                         // max polygon vertices per frame (keeps 60fps)

// rebuild the polygon and cap the stream count to the vertex budget
function build(){ poly=fractalPoly(sides,depth); cn=poly.length; count=max(20,min(want,floor(BUDGET/cn))); }

// integrate a system, normalise the path into [-1,1], then build the polygon
function load(name){ sysName=name;
  const {f,s,dt}=SYS[name]; let st=[...s];
  for (let i=0;i<600;i++) st=rk4(f,st,dt);                  // discard the transient
  const raw=[]; for (let i=0;i<22000;i++){ raw.push(st); st=rk4(f,st,dt); }
  const lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9];
  raw.forEach(q=>q.forEach((v,a)=>{ lo[a]=Math.min(lo[a],v); hi[a]=Math.max(hi[a],v); }));
  const mid=lo.map((v,a)=>(v+hi[a])/2), half=Math.max(...hi.map((v,a)=>v-lo[a]))/2||1;
  path=raw.map(q=>q.map((v,a)=>(v-mid[a])/half)); build();
}
const at = f => {                                           // interpolated point at a fractional, wrapping index
  const n=path.length, i=((f%n)+n)%n, j=floor(i), k=(j+1)%n, t=i-j;
  return path[j].map((v,a)=> v+(path[k][a]-v)*t); };
function project(q){                                        // rotate (Y then X), flatten -> [screenX, screenY, depth]
  const cyy=cos(ry),syy=sin(ry),cxx=cos(rx),sxx=sin(rx);
  const X=q[0]*cyy+q[2]*syy, Z=-q[0]*syy+q[2]*cyy, Y=q[1], s=scl*zoom;
  return [cx+X*s, cy+(Y*cxx-Z*sxx)*s, Y*sxx+Z*cxx];
}
function reticle(){                                         // faint + registration marks (skiatron motif)
  stroke(mix(.4)); strokeWeight(1); const m=22, g=7;
  [[m,m],[width-m,m],[m,height-m],[width-m,height-m]].forEach(([x,y])=>{ line(x-g,y,x+g,y); line(x,y-g,x,y+g); }); }
const sizeOf = () => min(min(windowWidth-20,820), 760);     // responsive square-ish canvas

function setup(){ createCanvas(sizeOf(), sizeOf()*.625); cx=width/2; cy=height/2; scl=min(width,height)*.38; load("Lorenz"); }
function windowResized(){ resizeCanvas(sizeOf(), sizeOf()*.625); cx=width/2; cy=height/2; scl=min(width,height)*.38; }

function draw(){
  zoom += (zTarget-zoom)*.12;                               // ease the zoom
  if (!drag) ry += .003;                                    // slow auto-rotate
  phase += flow; hue = (hue+spin)%360;                      // advance the stream and the colour wheel

  if (light) { colorMode(RGB,255); background(168,169,163); }            // skiatron grey field
  else       { colorMode(HSB,360,100,100,255); background(218,50,7); }   // dark field

  const th=THEMES[themeIx], n=path.length, gap=n/count, look=max(2,n*.0015), items=[];
  for (let i=0;i<count;i++){                                // place each polygon along the path
    const f=phase+i*gap, a=project(at(f)), b=project(at(f+look));
    items.push({ x:a[0], y:a[1], d:a[2], ang:atan2(b[1]-a[1],b[0]-a[0]), t:((f%n+n)%n)/(n-1) });
  }
  items.sort((u,v)=>u.d-v.d);                               // painter's algorithm: far ones first

  strokeWeight(light?1:.8);
  for (const it of items){
    const r=scl*.05*constrain(map(it.d,-1,1,.55,1.3),.4,1.5)*zoom;
    push(); translate(it.x,it.y); rotate(it.ang);
    if (light){                                             // skiatron: dark trace, fades to grey with depth
      const k=constrain(map(it.d,-1,1,.15,.95),.12,1);
      fill(mix(k*.3)); stroke(mix(k));
    } else {                                                // dark theme: cycle the colour palette
      const al=constrain(map(it.d,-1,1,55,235),40,255), h=(lerp(th.h[0],th.h[1],it.t)+hue)%360;
      fill(h,th.sat,th.bri,al*.6); stroke(h,th.sat,min(100,th.bri+8),al);
    }
    beginShape(); for (const pt of poly) vertex(pt[0]*r, pt[1]*r); endShape(CLOSE);
    pop();
  }
  if (light) reticle();

  noStroke();
  if (light) fill(35,42,54); else fill(color(210,14,62,200));
  textFont("monospace"); textSize(11); textAlign(LEFT,BOTTOM);
  text(`${sysName} · ${count} polygons (${cn}-gon) · zoom ${zoom.toFixed(1)}× · ${light?"skiatron":th.name}`, 12, height-10);
}

// --- input ---
const over = () => mouseX>=0 && mouseX<=width && mouseY>=0 && mouseY<=height;
function mouseWheel(e){ if(!over()) return; zTarget=constrain(zTarget*(e.delta>0?.9:1.1),.3,9); return false; }
function doubleClicked(){ if(over()) zTarget=1; }
function mousePressed(){ if(over()){ drag=true; mx=mouseX; my=mouseY; } }
function mouseDragged(){ if(!drag) return; ry+=(mouseX-mx)*.008; rx=constrain(rx+(mouseY-my)*.008,-1.45,1.45); mx=mouseX; my=mouseY; }
function mouseReleased(){ drag=false; }
function keyPressed(){
  if (key>="1" && key<="5")        load(NAMES[+key-1]);                 // 1–5  attractor
  else if (key==="t"||key==="T")   themeIx=(themeIx+1)%THEMES.length;   // T    palette (dark only)
  else if (key==="b"||key==="B")   light=!light;                       // B    skiatron / dark theme
  else if (key==="[")  { sides=max(3,sides-1); build(); }              // [ ]  polygon sides
  else if (key==="]")  { sides=min(8,sides+1); build(); }
  else if (key==="-")  { depth=max(0,depth-1); build(); }              // - =  fractal depth
  else if (key==="=")  { depth=min(3,depth+1); build(); }
  else if (key===",")  { want=max(40,want-40);  build(); }             // , .  stream count
  else if (key===".")  { want=min(700,want+40); build(); }
  else if (keyCode===UP_ARROW)    flow=min(40,flow+2);                 // ↑ ↓  flow speed
  else if (keyCode===DOWN_ARROW)  flow=max(0,flow-2);
  else if (keyCode===LEFT_ARROW)  spin=max(0,spin-.05);                // ← →  colour spin
  else if (keyCode===RIGHT_ARROW) spin=min(1.5,spin+.05);
}
