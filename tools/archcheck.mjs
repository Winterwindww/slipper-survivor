/* 流派审计：一局结束时，到底有几条流派被点满？
   用法：node tools/archcheck.mjs [--minutes 10] [--chars knight,ranger]
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MINUTES = Number(arg('minutes', 10));
const SEED = Number(arg('seed', 12345));
const CHARS = arg('chars', 'knight,ranger,engineer,keeper,chef').split(',');
const DT = 1 / 60;

function makeCtx(){
  const target = {};
  return new Proxy(target, {
    get(t, k){
      if(k in t) return t[k];
      if(k === 'canvas') return { width:16, height:16 };
      if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
      if(k === 'createPattern') return () => ({});
      if(k === 'measureText') return () => ({ width:10 });
      if(k === 'getImageData') return (x,y,w,h) => ({ data:new Uint8ClampedArray(Math.max(1,w*h*4)) });
      return () => {};
    },
    set(t,k,v){ t[k]=v; return true; }
  });
}
function makeEl(tag){
  return {
    tagName:(tag||'div').toUpperCase(), id:'', className:'', textContent:'', innerHTML:'', title:'',
    offsetWidth:100, width:16, height:16,
    style:{ setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; } },
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl('canvas'); }, querySelectorAll(){ return []; },
    getContext(){ return makeCtx(); }, focus(){}, blur(){}, click(){}
  };
}
function createEnv(seed){
  const elements = new Map();
  const document = {
    getElementById(id){ if(!elements.has(id)){ const e=makeEl('div'); e.id=id; elements.set(id,e); } return elements.get(id); },
    createElement(tag){ return makeEl(tag); }, querySelector(){ return makeEl('div'); },
    addEventListener(){}, body:makeEl('body'), documentElement:makeEl('html')
  };
  const sandbox = {
    console, document,
    performance:{ now:() => Number(process.hrtime.bigint()/1000n)/1000 },
    requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth:1280, innerHeight:720, devicePixelRatio:1,
    addEventListener(){}, removeEventListener(){}
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox; sandbox.self=sandbox;
  sandbox.__slipperSeed=seed;
  const ctx=vm.createContext(sandbox);
  vm.runInContext(`(function(){ let a=(__slipperSeed>>>0)||1;
    Math.random=function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };})();`, ctx);
  return ctx;
}
function extractScript(html){
  const s=html.indexOf('<script>'), e=html.lastIndexOf('</script>');
  return html.slice(s+8,e);
}

const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const code = extractScript(html);

function run(charId, seed){
  const ctx = createEnv(seed);
  vm.runInContext(code, ctx, { filename:'slipper-survivor.js' });
  const SS = ctx.__SS;
  SS.start(charId);
  SS.state.mode = 'playing';
  const keys = SS.keys, ARENA = SS.arena;
  const DIRS = [];
  for(let i=0;i<8;i++) DIRS.push([Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4)]);
  let aiT=0, lastDx=0, lastDy=0;
  function steer(dt){
    aiT -= dt; if(aiT>0) return; aiT=0.06;
    const p=SS.P, list=SS.enemies, gemList=SS.gems, step=52;
    let gx=0,gy=0,gd=1e9;
    for(let i=0;i<gemList.length;i++){
      const g=gemList[i]; const d=(g.x-p.x)**2+(g.y-p.y)**2;
      if(d<gd){ gd=d; gx=g.x; gy=g.y; }
    }
    gd=Math.sqrt(gd);
    let best=0, bestScore=-1e9;
    for(let k=0;k<8;k++){
      const nx=p.x+DIRS[k][0]*step, ny=p.y+DIRS[k][1]*step;
      let minD=9999, crowd=0;
      for(let i=0;i<list.length;i++){
        const e=list[i]; if(e.dead) continue;
        const dx=nx-e.x, dy=ny-e.y, d2=dx*dx+dy*dy;
        if(d2>260*260) continue;
        const d=Math.sqrt(d2); if(d<minD) minD=d; crowd+=1/(d2+400);
      }
      let score=minD-crowd*2200;
      let br=0; const eb=SS.ebullets;
      for(let i=0;i<eb.length;i++){
        const b=eb[i];
        for(let tt=0;tt<=0.5;tt+=0.1){
          const dd=Math.hypot(nx-(b.x+b.vx*tt), ny-(b.y+b.vy*tt));
          if(dd<46) br+=(46-dd)*(0.5-tt)*0.5;
        }
      }
      score-=br;
      if(nx<34||nx>ARENA.w-34||ny<34||ny>ARENA.h-34) score-=420;
      const dc=Math.hypot(nx-ARENA.w/2, ny-ARENA.h/2);
      score-=Math.max(0,dc-380)*0.9;
      if(gd<1e8 && minD>52 && SS.P.hp>SS.P.maxHp*0.45) score+=(step-Math.hypot(nx-gx,ny-gy))*1.6;
      score+=(DIRS[k][0]*lastDx+DIRS[k][1]*lastDy)*34;
      if(score>bestScore){ bestScore=score; best=k; }
    }
    keys['w']=keys['a']=keys['s']=keys['d']=false;
    lastDx=DIRS[best][0]; lastDy=DIRS[best][1];
    if(DIRS[best][0]>0.2) keys['d']=true;
    if(DIRS[best][0]<-0.2) keys['a']=true;
    if(DIRS[best][1]>0.2) keys['s']=true;
    if(DIRS[best][1]<-0.2) keys['w']=true;
  }
  const steps = Math.round(MINUTES*60/DT);
  for(let i=0;i<steps;i++){
    if(SS.state.mode==='levelup'||SS.state.mode==='modpick'){ let g=0; while((SS.state.mode==='levelup'||SS.state.mode==='modpick')&&g++<60) SS.autoPick(); continue; }
    if(SS.state.mode==='gameover') break;
    steer(DT);
    SS.step(DT);
  }
  const P = SS.P;
  const arch = [];
  for(const id in P.arch){ const a=P.arch[id]; if(a.pts>0) arch.push({ id, pts:+a.pts.toFixed(2), raw:+(a.raw||0).toFixed(1), tier:a.tier }); }
  arch.sort((a,b)=>b.pts-a.pts);
  return { char:charId, time:+SS.state.time.toFixed(0), level:P.level, relics:Object.keys(P.relics).length, arch };
}

console.log('\n=== 流派审计（' + MINUTES + ' 分钟，seed ' + SEED + '）===\n');
for(const c of CHARS){
  const r = run(c, SEED);
  const t3 = r.arch.filter(a=>a.tier>=3).length;
  const t2 = r.arch.filter(a=>a.tier===2).length;
  const t1 = r.arch.filter(a=>a.tier===1).length;
  console.log(`${c.padEnd(10)} 存活 ${String(r.time).padStart(4)}s · Lv${String(r.level).padStart(3)} · 遗物 ${String(r.relics).padStart(2)} 件 · 流派 Ⅲ级 ${t3} / Ⅱ级 ${t2} / Ⅰ级 ${t1}`);
  console.log('   ' + r.arch.slice(0,6).map(a => `${a.id}(${a.pts}分/${a.tier}级)`).join('  ') || '   （无）');
  console.log('');
}
