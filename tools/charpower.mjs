/* 角色输出对比：同一个走位 AI、同一个种子、同一个时间窗，
   看每个角色在 1~5 分钟真打出来多少伤害（不是面板，是 dealDamage 累计）。

   用法：
     node tools/charpower.mjs                     # 5 角色 × 1 种子 × 5 分钟
     node tools/charpower.mjs --minutes 6 --seeds 2
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MINUTES = Number(arg('minutes', 5));
const SEED = Number(arg('seed', 12345));
const SEEDS = Number(arg('seeds', 1));
const CHARS = arg('chars', 'ranger,knight,engineer,keeper,chef').split(',');
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
    Math.random = function(){ a|=0; a=a+0x6D2B79F5|0; let t = Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };})();`, ctx);
  return ctx;
}

function run(charId, minutes, seed){
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const s = html.indexOf('<script>'), e = html.lastIndexOf('</script>');
  const ctx = createEnv(seed);
  vm.runInContext(html.slice(s + 8, e), ctx, { filename: 'slipper-survivor.js' });
  const SS = ctx.__SS;
  SS.start(charId);
  SS.state.mode = 'playing';

  const keys = SS.keys, ARENA = SS.arena;
  const DIRS = [];
  for(let i = 0; i < 8; i++) DIRS.push([Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
  let aiT = 0, lastDx = 0, lastDy = 0;

  function steer(dt){
    aiT -= dt;
    if(aiT > 0) return;
    aiT = 0.06;
    const p = SS.P, list = SS.enemies, gemList = SS.gems;
    const step = 52;
    let gx = 0, gy = 0, gd = 1e9;
    for(let i = 0; i < gemList.length; i++){
      const g = gemList[i];
      const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
      if(d < gd){ gd = d; gx = g.x; gy = g.y; }
    }
    gd = Math.sqrt(gd);
    let best = 0, bestScore = -1e9;
    for(let k = 0; k < 8; k++){
      const nx = p.x + DIRS[k][0] * step, ny = p.y + DIRS[k][1] * step;
      let minD = 9999, crowd = 0;
      for(let i = 0; i < list.length; i++){
        const en = list[i];
        if(en.dead) continue;
        const dx = nx - en.x, dy = ny - en.y, d2 = dx * dx + dy * dy;
        if(d2 > 260 * 260) continue;
        const d = Math.sqrt(d2);
        if(d < minD) minD = d;
        crowd += 1 / (d2 + 400);
      }
      let score = minD - crowd * 2200;
      let bulletRisk = 0;
      const eb = SS.ebullets;
      for(let i = 0; i < eb.length; i++){
        const b = eb[i];
        for(let tt = 0; tt <= 0.5; tt += 0.1){
          const bx = b.x + b.vx * tt, by = b.y + b.vy * tt;
          const dd = Math.hypot(nx - bx, ny - by);
          if(dd < 46) bulletRisk += (46 - dd) * (0.5 - tt) * 0.5;
        }
      }
      score -= bulletRisk;
      if(nx < 34 || nx > ARENA.w - 34 || ny < 34 || ny > ARENA.h - 34) score -= 420;
      const dc = Math.hypot(nx - ARENA.w / 2, ny - ARENA.h / 2);
      score -= Math.max(0, dc - 380) * 0.9;
      if(gd < 1e8 && minD > 52 && SS.P.hp > SS.P.maxHp * 0.45) score += (step - Math.hypot(nx - gx, ny - gy)) * 1.6;
      score += (DIRS[k][0] * lastDx + DIRS[k][1] * lastDy) * 34;
      if(score > bestScore){ bestScore = score; best = k; }
    }
    keys['w'] = keys['a'] = keys['s'] = keys['d'] = false;
    lastDx = DIRS[best][0]; lastDy = DIRS[best][1];
    if(DIRS[best][0] > 0.2) keys['d'] = true;
    if(DIRS[best][0] < -0.2) keys['a'] = true;
    if(DIRS[best][1] > 0.2) keys['s'] = true;
    if(DIRS[best][1] < -0.2) keys['w'] = true;
  }
  function autoPick(){
    let guard = 0;
    while((SS.state.mode === 'levelup' || SS.state.mode === 'modpick') && guard++ < 60) SS.autoPick();
  }

  const steps = Math.round(minutes * 60 / DT);
  const out = { char: charId, minutes: [], diedAt: null };
  let lastMin = -1, prevD = 0;
  for(let i = 0; i < steps; i++){
    if(SS.state.mode === 'levelup' || SS.state.mode === 'modpick'){ autoPick(); continue; }
    if(SS.state.mode === 'gameover'){ out.diedAt = SS.state.time; break; }
    steer(DT);
    SS.step(DT);

    const m = Math.floor(SS.state.time / 60);
    if(m !== lastMin){
      lastMin = m;
      const dNow = SS.state.dmgDealt || 0;
      out.minutes.push({
        m,
        dps: Math.round((dNow - prevD) / 60),
        total: Math.round(dNow),
        lv: SS.P.level,
        maxHp: Math.round(SS.P.maxHp),
        hp: Math.round(SS.P.hp),
        weapons: Object.keys(SS.P.weapons),
        wlv: Object.keys(SS.P.weapons).map(id => id + SS.P.weapons[id]).join(' '),
        arch: SS.arch ? Object.keys(SS.arch()).map(k => k + SS.arch()[k].tier).join(',') : ''
      });
      prevD = dNow;
    }
  }
  out.kills = SS.state.kills;
  out.finalDps = (SS.state.dmgDealt || 0) / Math.max(1, SS.state.time);
  return out;
}

const rows = [];
for(const c of CHARS){
  for(let i = 0; i < SEEDS; i++){
    try { rows.push(run(c, MINUTES, SEED + i * 999)); }
    catch(err){ console.error(c, err.message); }
  }
}

const pad = (s, n) => String(s).padEnd(n);
const pr = (s, n) => String(s).padStart(n);

console.log('\n=== 角色输出（' + SEEDS + ' 种子，' + MINUTES + ' 分钟，同一走位 AI）===\n');
const mins = [];
for(const r of rows) for(const x of r.minutes) if(!mins.includes(x.m)) mins.push(x.m);
mins.sort((a, b) => a - b);

console.log(pad('角色', 10) + mins.map(m => pr((m + 1) + '分', 9)).join('') + pr('均值', 9) + pr('击杀', 8) + pr('阵亡', 8));
console.log('-'.repeat(10 + mins.length * 9 + 25));
for(const c of CHARS){
  const g = rows.filter(r => r.char === c);
  if(!g.length) continue;
  const cells = mins.map(m => {
    const vals = g.map(r => { const x = r.minutes.find(y => y.m === m); return x ? x.dps : 0; });
    return pr(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), 9);
  }).join('');
  const avg = Math.round(g.reduce((a, r) => a + r.finalDps, 0) / g.length);
  const kills = Math.round(g.reduce((a, r) => a + r.kills, 0) / g.length);
  const died = g.map(r => r.diedAt ? Math.round(r.diedAt) + 's' : '-').join('/');
  console.log(pad(c, 10) + cells + pr(avg, 9) + pr(kills, 8) + pr(died, 8));
}

console.log('\n=== 每分钟构筑（第一个种子）===');
for(const r of rows.filter((x, i) => i % SEEDS === 0)){
  console.log('--- ' + r.char + ' ---');
  for(const x of r.minutes){
    console.log(pad((x.m + 1) + '分', 6) + pad('Lv' + x.lv, 6) + pad('血量 ' + x.hp + '/' + x.maxHp, 14)
      + pad('DPS ' + x.dps, 9) + '  武器 ' + x.wlv);
  }
}
