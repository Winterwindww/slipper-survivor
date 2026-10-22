import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const ROOT='C:/Users/13206/WorkBuddy/2026-10-18-10-38-08/repo';
const el=()=>({classList:{add(){},remove(){},toggle(){},contains(){return true}},style:{setProperty(){}},appendChild(){},addEventListener(){},querySelector(){return el()},set textContent(v){},get textContent(){return ''},set innerHTML(v){},get innerHTML(){return ''},width:0,height:0,getContext(){return new Proxy({},{get(){return ()=>({addColorStop(){}})}})}});
const elements=new Map();
const ctxMock=new Proxy({},{get(t,k){ if(k==='canvas')return{width:16,height:16}; return ()=>({addColorStop(){}});},set(){return true}});
const document={getElementById(id){ if(!elements.has(id)) elements.set(id,el()); return elements.get(id);}, createElement(){return el()}, querySelector(){return el()}, addEventListener(){}, body:el()};
const sandbox={console,document,performance:{now:()=>Date.now()},requestAnimationFrame(){return 0},cancelAnimationFrame(){},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},localStorage:{getItem(){return null},setItem(){},removeItem(){}},innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
const C=vm.createContext(sandbox);
vm.runInContext(`(function(){let a=12345;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`,C);
const html=fs.readFileSync((process.argv[2]||path.join(ROOT,'index.html')),'utf8');
const code=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
vm.runInContext(code,C,{filename:'game.js'});
const SS=C.__SS;
SS.start('ranger'); SS.state.mode='playing';
const keys=SS.keys;
let last=-3;
for(let i=0;i<60*70;i++){
  if(SS.state.mode==='levelup'||SS.state.mode==='modpick'){ let g=0; while((SS.state.mode==='levelup'||SS.state.mode==='modpick')&&g++<40) SS.autoPick(); }
  if(SS.state.mode==='gameover'){ console.log('DEAD at', SS.state.time.toFixed(1)); break; }
  // simple flee
  const p=SS.P, list=SS.enemies;
  let ax=0,ay=0,n=0;
  for(const e of list){ const dx=p.x-e.x, dy=p.y-e.y; const d2=dx*dx+dy*dy; if(d2>140*140||d2<1)continue; const w=1/Math.max(24,Math.sqrt(d2)); ax+=dx*w; ay+=dy*w; n++; }
  keys['w']=keys['a']=keys['s']=keys['d']=false;
  if(n){ if(ax>0.02)keys['d']=true; if(ax<-0.02)keys['a']=true; if(ay>0.02)keys['s']=true; if(ay<-0.02)keys['w']=true; }
  else { keys['w']=true; }
  SS.step(1/60);
  const t=SS.state.time;
  if(t-last>=3){ last=t;
    const s=SS.snapshot();
    console.log(`t=${t.toFixed(0)} hp=${s.hp}/${s.maxHp} en=${s.enemies} contact=${s.contact} kills=${s.kills} lv=${s.level} dps=${s.dps} bul=${s.bullets}`);
  }
}
