/* 穿模审计：怪会不会钻进玩家身体。
   用法：node tools/overlap.mjs [--minutes 3] [--char ranger]

   【3.4】用户反馈「幽灵一样的精灵怪出现就直接贴在身上」。
   根因不是幽灵特殊，而是所有 AI 都朝玩家中心点走、没有任何边缘约束：
   快的怪一帧就能穿过身体，之后每帧锁在玩家坐标上。
   这个脚本量"最大穿透深度"和"穿模帧占比"，改前应该能看到明显数值，
   改后应为 0（怪被钉在身体圈边缘）。
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MINUTES = Number(arg('minutes', 3));
const CHAR = arg('char', 'ranger');
const SEED = Number(arg('seed', 2026));
const DT = 1 / 60;

function makeCtx(){
  const target = {};
  return new Proxy(target, {
    get(t, k){
      if(k in t) return t[k];
      if(k === 'canvas') return { width: 16, height: 16 };
      if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
      if(k === 'createPattern') return () => ({});
      if(k === 'measureText') return () => ({ width: 10 });
      if(k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
}
function makeEl(tag){
  return {
    tagName: (tag || 'div').toUpperCase(), id:'', className:'', textContent:'', innerHTML:'', title:'',
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
    getElementById(id){ if(!elements.has(id)){ const e = makeEl('div'); e.id = id; elements.set(id, e); } return elements.get(id); },
    createElement(tag){ return makeEl(tag); },
    querySelector(){ return makeEl('div'); },
    addEventListener(){}, body: makeEl('body'), documentElement: makeEl('html')
  };
  const sandbox = {
    console, document,
    performance:{ now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth:1280, innerHeight:720, devicePixelRatio:1,
    addEventListener(){}, removeEventListener(){}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.__slipperSeed = seed;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(`(function(){ let a = (__slipperSeed>>>0)||1;
    Math.random = function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };})();`, ctx);
  return ctx;
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ctx = createEnv(SEED);
vm.runInContext(html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')),
  ctx, { filename: 'slipper-survivor.js' });
const SS = ctx.__SS;
SS.start(CHAR);
SS.state.mode = 'playing';

const byType = {};
let worst = 0, worstType = '', worstT = 0;
let frames = 0, badFrames = 0;

const total = Math.round(MINUTES * 60 / DT);
for(let f = 0; f < total; f++){
  SS.autoPick();
  SS.step(DT);
  if(SS.state.mode === 'gameover') break;
  const p = SS.P, list = SS.enemies;
  frames++;
  let frameBad = false;
  for(let i = 0; i < list.length; i++){
    const e = list[i];
    if(e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const bodyR = e.r + p.r;
    const pen = bodyR - d;          /* > 0 表示已经进到身体圈里 */
    if(pen <= 0) continue;
    frameBad = true;
    const rec = byType[e.type] || (byType[e.type] = { n: 0, maxPen: 0 });
    rec.n++;
    if(pen > rec.maxPen) rec.maxPen = pen;
    if(pen > worst){ worst = pen; worstType = e.type; worstT = SS.state.time; }
  }
  if(frameBad) badFrames++;
}

const rounded = Math.round;
console.log(`角色 ${CHAR} · ${MINUTES} 分钟 · seed ${SEED}`);
console.log(`存活到 ${rounded(SS.state.time)}s，等级 ${SS.P.level}`);
console.log(`穿模帧 ${badFrames} / ${frames}（${(badFrames / Math.max(1, frames) * 100).toFixed(1)}%）`);
console.log(`最大穿透 ${worst.toFixed(1)}px` + (worstType ? `（${worstType}，第 ${rounded(worstT)} 秒）` : ''));
const rows = Object.keys(byType).sort((a, b) => byType[b].maxPen - byType[a].maxPen);
if(rows.length){
  console.log('按怪种类（次数 / 最大穿透）：');
  for(const k of rows) console.log(`  ${k.padEnd(10)} ${String(byType[k].n).padStart(6)}  ${byType[k].maxPen.toFixed(1)}px`);
} else {
  console.log('没有任何怪进入玩家身体。');
}
