import * as THREE from 'three';
const mat=(name,color,o={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.75,metalness:.12,...o});m.name=name;return m};
const M={hullUp:mat('hull_grey',0x7d8b98,{side:THREE.DoubleSide}),boot:mat('boot_stripe',0x161b21,{side:THREE.DoubleSide}),hullLow:mat('antifouling_red',0x7a2f2f,{side:THREE.DoubleSide}),
 deck:mat('deck_nonskid',0x56616b),house:mat('superstructure',0x93a0ac),dark:mat('dark_gear',0x1f2832),light:mat('light_grey',0xc2cad1),glass:mat('bridge_glass',0x0b1822,{roughness:.2,metalness:.3}),
 vls:mat('vls_hatch',0x2a3441),radar:mat('radar_array',0x22d3ee,{emissive:0x0a5560,emissiveIntensity:.7}),helo:mat('deck_marking',0xe9b52e,{emissive:0x4a3600,emissiveIntensity:.5}),
 white:mat('white_marking',0xe8edf1),orange:mat('rhib_tube',0xd98a2b),heli:mat('aircraft',0x4a545e),brass:mat('prop_bronze',0xb08a45),elev:mat('elevator',0x2c3a48)};
M.sub=mat('pressure_hull',0x5f6b77,{side:THREE.DoubleSide,roughness:.9});M.subSail=mat('sail_fairwater',0x7b8793,{side:THREE.DoubleSide,roughness:.85});
const hullMats=[M.hullUp,M.boot,M.hullLow],subMats=[M.sub,M.subSail];
const setXray=on=>{hullMats.forEach(m=>{m.transparent=on;m.opacity=on?.5:1;m.depthWrite=!on;m.needsUpdate=true});subMats.forEach(m=>{m.transparent=on;m.opacity=on?.72:1;m.depthWrite=!on;m.needsUpdate=true});if(typeof split!=='undefined'&&split)split.cm.forEach(([o,c])=>{c.transparent=o.transparent;c.opacity=o.opacity;c.depthWrite=o.depthWrite;c.needsUpdate=true})};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const add=(g,name,geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.name=name;o.position.set(x,y,z);g.add(o);return o};
const bx=(g,n,m,w,h,d,x,y,z)=>add(g,n,new THREE.BoxGeometry(w,h,d),m,x,y,z);
const cyl=(g,n,m,r0,r1,h,x,y,z,seg=24)=>add(g,n,new THREE.CylinderGeometry(r0,r1,h,seg),m,x,y,z);
const strip=(g,n,m,x1,z1,x2,z2,w,y,h=.03)=>{const len=Math.hypot(x2-x1,z2-z1);const o=bx(g,n,m,len,h,w,(x1+x2)/2,y,(z1+z2)/2);o.rotation.y=-Math.atan2(z2-z1,x2-x1);return o};
const plate=(g,n,m,pts,depth,y)=>{const s=new THREE.Shape();pts.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));const gg=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false});gg.rotateX(-Math.PI/2);return add(g,n,gg,m,0,y,0)};
const chamf=(g,n,m,x0,z0,x1,z1,c,h,y)=>plate(g,n,m,[[x0+c,z0],[x1-c,z0],[x1,z0+c],[x1,z1-c],[x1-c,z1],[x0+c,z1],[x0,z1-c],[x0,z0+c]],h,y);
let lastHull=null,lights=[];
function loft(g,name,prof,m,c){const R=prof[prof.length-1].wf===0?prof.length*2-1:prof.length*2,pos=[],idx=[],xs=[];const N=90;for(let i=0;i<=N;i++)xs.push(c.x0+(c.x1-c.x0)*i/N);
 xs.forEach(x=>{const ring=prof.map(p=>[p,-1]);for(let k=prof.length-1;k>=(prof[prof.length-1].wf===0?1:0);k--)ring.push([prof[k],1]);
  ring.forEach(([p,s])=>{const f=p.y/c.HH,xr=x>c.bowX?c.bowX+(x-c.bowX)*(.82+.18*f):x;pos.push(xr,p.y,(c.zOff||0)+s*c.hw(x)*p.wf)})});
 for(let i=0;i<N;i++)for(let j=0;j<R-1;j++){const a=i*R+j,b=(i+1)*R+j;idx.push(a,b,a+1,b,b+1,a+1)}
 const cc=pos.length/3;pos.push(c.x0,c.HH/2,c.zOff||0);for(let j=0;j<R-1;j++)idx.push(cc,j,j+1);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return add(g,name,geo,m,0,0,0)}
function hull(g,c){if(!lastHull)lastHull=c;const k=c.HH/10,s=(a)=>a.map(p=>({y:p.y*k,wf:p.wf}));
 loft(g,'hull_underwater',s([{y:5,wf:.92},{y:3.6,wf:.84},{y:2.2,wf:.66},{y:1,wf:.36},{y:0,wf:0}]),M.hullLow,c);
 loft(g,'hull_boot_stripe',s([{y:5.7,wf:.935},{y:5,wf:.92}]),M.boot,c);
 loft(g,'hull_topsides',s([{y:10,wf:c.flare||1.04},{y:8,wf:1.0},{y:5.7,wf:.935}]),M.hullUp,c)}
function jet(g,x,y,z,rot,n){const j=new THREE.Group();j.name=n;const f=add(j,'fuselage',new THREE.CapsuleGeometry(.8,6.5,4,12),M.heli,0,.9,0);f.rotation.z=Math.PI/2;bx(j,'wing',M.heli,3,.12,9.5,-.4,.8,0);bx(j,'stabilizer',M.heli,1.4,.1,4,-3.4,.9,0);for(const s of[-1,1])bx(j,'tail_fin',M.heli,1.6,1.9,.12,-3.3,1.9,s*.9);add(j,'canopy',new THREE.SphereGeometry(.6,12,10),M.glass,1.4,1.5,0).scale.set(1.6,.7,.8);j.position.set(x,y,z);j.rotation.y=rot;g.add(j)}
const mk=(x,y,z,side='up',base)=>({p:V(x,y,z),side,base:base??y-3});
/* ================= DDG ================= */
export function buildDDG(){const g=new THREE.Group();g.name='DDG';const S=.15,P=(x,y)=>[(x-500)*S,(y-150)*S],D=10.3;
 const bow=[];for(let i=0;i<=200;i++){const u=i/200,a=(1-u)*(1-u),b=2*u*(1-u),cc=u*u;bow.push([a*690+b*870+cc*972,150-(a*60+b*68+cc*150)])}
 const hwSvg=x=>{if(x<=40)return 72;if(x<=690)return 72+(x-40)/650*18;if(x>=972)return 0;for(let i=1;i<bow.length;i++)if(bow[i][0]>=x){const a=bow[i-1],b=bow[i],k=(x-a[0])/Math.max(b[0]-a[0],1e-6);return a[1]+(b[1]-a[1])*k}return 0};
 const hw=x=>hwSvg(x/S+500)*S,c={x0:-69,x1:70.8,bowX:28.5,HH:10,hw};hull(g,c);
 const pts=[];for(let i=0;i<=90;i++){const x=c.x0+(c.x1-c.x0)*i/90;pts.push([x,hw(x)*1.04])}const poly=[...pts.map(([x,z])=>[x,-z]),...pts.slice().reverse().map(([x,z])=>[x,z])];plate(g,'main_deck',M.deck,poly,.3,10);
 {const a=[],b=[];for(let i=2;i<88;i++){const[x,z]=pts[i],w=z-.3;if(w<1)break;a.push(V(x,D+1.1,-w));b.push(V(x,D+1.1,w))}add(g,'deck_railing',new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...a,...b.reverse()]),400,.07,4,false),M.light,0,0,0)}
 const box=(n,m,x0,y0,x1,y1,h,base=D)=>{const[a,c2]=P(x0,y0),[b,d]=P(x1,y1);return bx(g,n,m,Math.abs(b-a),h,Math.abs(d-c2),(a+b)/2,base+h/2,(c2+d)/2)};
 const cb=(n,m,x0,y0,x1,y1,ch,h,base)=>{const[a,c2]=P(x0,y0),[b,d]=P(x1,y1);return chamf(g,n,m,a,c2,b,d,ch*S,h,base)};
 box('helo_deck',M.dark,52,92,212,208,.12,D+.3);
 {const[x,z]=P(132,150);const r=add(g,'helo_circle',new THREE.RingGeometry(5.8,6.5,48),M.helo,x,D+.46,z);r.rotation.x=-Math.PI/2;box('helo_bar_x',M.helo,88,148.5,176,151.5,.02,D+.44);box('helo_bar_z',M.helo,130.5,106,133.5,194,.02,D+.44);
  const hg=new THREE.Group();hg.name='helicopter';add(hg,'fuselage',new THREE.SphereGeometry(1.2,24,16),M.heli,0,2,0).scale.set(2.4,1,.95);add(hg,'cockpit',new THREE.SphereGeometry(.95,16,12),M.glass,1.9,2.2,0).scale.set(1,.75,.9);bx(hg,'tail_boom',M.heli,5,.55,.5,-4.2,2.4,0);bx(hg,'tail_fin',M.heli,.9,1.6,.15,-6.4,3.1,0);cyl(hg,'rotor_mast',M.dark,.15,.15,.8,0,3.3,0,8);
  for(let i=0;i<4;i++){const b=bx(hg,'blade_'+i,M.dark,4.9,.06,.35,Math.cos(i*Math.PI/2+.5)*2.5,3.75,Math.sin(i*Math.PI/2+.5)*2.5);b.rotation.y=-(i*Math.PI/2+.5)}
  for(const[wx,wz]of[[1.2,0],[-1.6,-1],[-1.6,1]])cyl(hg,'wheel',M.dark,.28,.28,.2,wx,.55,wz,12).rotation.x=Math.PI/2;hg.position.set(x+.5,D+.5,z);g.add(hg)}
 box('hangar',M.house,214,98,288,202,6.5);box('hangar_roof',M.light,216,100,286,200,.15,D+6.5);{const[x,z]=P(214,150);bx(g,'hangar_door',M.dark,.12,5.2,11.5,x-.04,D+3,z);bx(g,'hangar_door_stripe',M.helo,.14,.3,11.8,x-.05,D+5.8,z)}
 for(const[n,x]of[['aft_vls',318],['fwd_vls',686]]){box(n+'_frame',M.dark,x-4,114,x+84,186,.35);const cg=new THREE.BoxGeometry(1.15,.12,1.15);for(let i=0;i<8;i++)for(let j=0;j<6;j++){const[px,pz]=P(x+i*10+5,118+j*10+5);add(g,n+'_hatch_'+i+'_'+j,cg,M.vls,px,D+.5,pz)}}
 cb('deckhouse_lvl1',M.house,410,90,652,210,14,5,D);cb('deckhouse_lvl2',M.house,430,104,640,196,12,4,D+5);cb('bridge_block',M.house,560,112,646,188,12,4.2,D+9);box('bridge_roof',M.light,562,114,644,186,.15,D+13.2);
 {const[x,z]=P(646,150);bx(g,'bridge_windows_front',M.glass,.12,1.1,9.4,x,D+11.2,z);for(const s of[-1,1]){const[x2,z2]=P(603,150+s*38);bx(g,'bridge_windows_side',M.glass,11.6,1.1,.12,x2,D+11.2,z2)}}
 {const[x,z]=P(475,150);box('funnel_block',M.house,446,122,504,178,4.5,D+9);for(const dz of[-1,1]){cyl(g,'exhaust_stack',M.dark,2.1,2.5,2.6,x,D+14.7,z+dz*2.9);cyl(g,'exhaust_grille',M.vls,1.5,1.5,.05,x,D+16.1,z+dz*2.9,16)}}
 for(const[x0,y0,rot,n]of[[636,118,Math.PI/4,'fwd_port'],[636,182,-Math.PI/4,'fwd_stbd'],[574,118,3*Math.PI/4,'aft_port'],[574,182,-3*Math.PI/4,'aft_stbd']]){const[x,z]=P(x0,y0);add(g,'array_'+n,new THREE.BoxGeometry(.5,4.8,4.8),M.radar,x,D+11.6,z).rotation.y=rot}
 {const[x,z]=P(540,150),by=D+13.5;cyl(g,'mast_tower',M.house,.9,1.9,16,x,by+8,z,4).rotation.y=Math.PI/4;bx(g,'mast_platform_low',M.dark,5.2,.3,5.2,x,by+7,z);bx(g,'mast_platform_high',M.dark,3.6,.3,3.6,x,by+12,z);bx(g,'yardarm',M.dark,.3,.3,9,x,by+14.5,z);bx(g,'sps_radar_bar',M.light,.35,.9,7,x,by+16.4,z);
  for(const[dx,dz,hh]of[[1.4,1.4,6],[-1.4,1.4,5],[-1.4,-1.4,7],[1.4,-1.4,4.5]])cyl(g,'antenna_whip',M.dark,.04,.06,hh,x+dx,by+12.2+hh/2,z+dz,6);for(const dz of[-1,1])cyl(g,'esm_drum',M.light,.7,.7,1,x,by+13.2,z+dz*3.8,16)}
 for(const[n,sy]of[['satcom_port',100],['satcom_stbd',200]]){const[x,z]=P(510,sy);cyl(g,n+'_base',M.dark,1,1.2,.8,x,D+5.4,z,16);add(g,n,new THREE.SphereGeometry(1.7,24,16,0,Math.PI*2,0,Math.PI/2),M.light,x,D+5.8,z)}
 for(const[n,x0,y0,base]of[['ciws_hangar',262,150,D+6.65],['ciws_aft',440,104,D+9]]){const[x,z]=P(x0,y0);cyl(g,n+'_pedestal',M.dark,1,1.3,1.4,x,base+.7,z,16);add(g,n+'_radome',new THREE.SphereGeometry(1.15,20,14),M.light,x,base+2.1,z);add(g,n+'_gun',new THREE.CylinderGeometry(.18,.18,2.2,10),M.dark,x+1.4,base+1.5,z+.8).rotation.z=Math.PI/2}
 for(const s of[-1,1]){const[x,z]=P(480,150+s*70);const r=add(g,'rhib',new THREE.CapsuleGeometry(.95,4.6,6,16),M.orange,x,D+1.3,z);r.rotation.z=Math.PI/2;bx(g,'rhib_console',M.dark,1,.8,.8,x,D+2.2,z);bx(g,'rhib_cradle',M.dark,6.4,.3,1.8,x,D+.45,z)}
 for(const dy of[-24,24]){const[x,z]=P(800,150+dy);cyl(g,'windlass',M.dark,.9,1,1.2,x,D+.9,z,16)}
 for(const[a,b,c2,d]of[[790,110,806,150],[806,150,790,190]]){const[x1,z1]=P(a,b),[x2,z2]=P(c2,d);strip(g,'breakwater',M.light,x1,z1,x2,z2,.15,D+.9,1.2)}
 {const[x,z]=P(844,150);cyl(g,'gun_base',M.dark,2.7,2.9,.5,x,D+.55,z,28);const s=new THREE.Shape();[[-2.2,0],[2.2,0],[1.5,2.3],[-.6,2.7],[-2.2,1.6]].forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));const gg=new THREE.ExtrudeGeometry(s,{depth:3.6,bevelEnabled:false});gg.translate(0,0,-1.8);add(g,'gun_turret',gg,M.house,x,D+.8,z);add(g,'gun_barrel',new THREE.CylinderGeometry(.22,.26,6.2,14),M.dark,x+4.6,D+2.2,z).rotation.z=Math.PI/2;add(g,'gun_muzzle_brake',new THREE.CylinderGeometry(.34,.34,.7,14),M.dark,x+7.6,D+2.2,z).rotation.z=Math.PI/2}
 {const[x,z]=P(912,150);add(g,'sonar_dome',new THREE.SphereGeometry(1,24,16),M.dark,x,2,z).scale.set(4,2.2,2.2)}
 for(const s of[-1,1]){const px=-67.4,pz=s*4.6;cyl(g,'prop_shaft',M.dark,.28,.28,13,px+6.2,2.2,pz,10).rotation.z=Math.PI/2;const pg=new THREE.Group();pg.name='propeller';pg.position.set(px,1.3,pz);g.add(pg);add(pg,'hub',new THREE.SphereGeometry(.38,12,10),M.brass,0,0,0);for(let i=0;i<5;i++){const a=new THREE.Group();a.rotation.x=i*Math.PI*2/5;pg.add(a);add(a,'blade',new THREE.BoxGeometry(.1,1.4,.5),M.brass,0,.9,0).rotation.y=.5}bx(g,'rudder',M.dark,2.2,3.4,.22,px-1.6,2,pz+s*.8)}
 const m=(k,sx,sy,y,side)=>{const[x,z]=P(sx,sy);return mk(x,y,z,side,k)};
 const mounts={flight:{...m(D,132,150,20,'dn'),base:D},vls_aft:{...m(D,358,150,17,'up'),base:D},sat:{...m(D+5.8,510,100,27,'up'),base:D+5.8},air_radar:{...m(D+13.2,610,150,33,'dn'),base:D+13.2},vls_fwd:{...m(D,726,150,17,'up'),base:D},gun:{...m(D,844,150,17,'dn'),base:D},
  engine_p:m(0,300,150,3.6,'up'),engine_s:m(0,400,150,3.6,'up'),genset_1:m(0,480,150,3.6,'up'),chill:m(0,580,150,3.6,'up'),genset_2:m(0,660,150,3.6,'up'),sonar:m(0,912,150,3.6,'up')};
 mounts.engine_p.p.z=-3.2;mounts.engine_s.p.z=3.2;mounts.genset_1.p.z=-3.2;mounts.chill.p.z=3.2;mounts.genset_2.p.z=-3.2;mounts.sonar.p.z=3.2;
 lights.push([6,D+13.5+17.3,0]);return{g,mounts,len:140,beam:27,HH:10,mid:0,deckY:D,vlsX:[-21.3,33.9],houses:[{x0:-13.5,x1:22.8,w:18,y0:D,h:14}],name:'USS Kestrel Bay',hullId:'DDG-1047 (fictional)'}}
