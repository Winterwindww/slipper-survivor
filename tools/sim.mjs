/* 无头模拟器：在 Node 里跑真实游戏逻辑（不渲染），用于回归与平衡测试
   用法：
     node tools/sim.mjs                      # 6 分钟
     node tools/sim.mjs --minutes 16 --json
     node tools/sim.mjs --runs 3 --minutes 10
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const MINUTES = Number(arg('minutes', 6));
const RUNS = Number(arg('runs', 1));
const SEED = Number(arg('seed', 12345));
const JSON_OUT = argv.includes('--json');
const TRACE = argv.includes('--trace');
const STILL = argv.includes('--still');   /* 站桩：玩家不动，复现"站着不动也能过"的场景 */
const CHAR = arg('char', '');
const DT = 1 / 60;

function makeCtx(){
  const target = {};
  return new Proxy(target, {
    get(t, k){
      if(k in t) return t[k];
      if(k === 'canvas') return { width: 16, height: 16 };
      if(k === 'createLinearGradient' || k === 'createRadialGradient'){
        return () => ({ addColorStop(){} });
      }
      if(k === 'createPattern') return () => ({});
      if(k === 'measureText') return () => ({ width: 10 });
      if(k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
}

function makeEl(tag){
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: '', className: '', textContent: '', innerHTML: '', title: '',
    offsetWidth: 100, width: 16, height: 16,
    style: { setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; } },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl('canvas'); },
    querySelectorAll(){ return []; },
    getContext(){ return makeCtx(); },
    focus(){}, blur(){}, click(){}
  };
  return el;
}

function createEnv(seed){
  const elements = new Map();
  const document = {
    getElementById(id){
      if(!elements.has(id)){ const e = makeEl('div'); e.id = id; elements.set(id, e); }
      return elements.get(id);
    },
    createElement(tag){ return makeEl(tag); },
    querySelector(){ return makeEl('div'); },
    addEventListener(){},
    body: makeEl('body'),
    documentElement: makeEl('html')
  };

  const sandbox = {
    console,
    document,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame(){ return 0; },
    cancelAnimationFrame(){},
    setTimeout(){ return 0; },
    clearTimeout(){},
    setInterval(){ return 0; },
    clearInterval(){},
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener(){},
    removeEventListener(){}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.__slipperSeed = seed;

  const ctx = vm.createContext(sandbox);
  /* 可复现随机数 */
  vm.runInContext(`
    (function(){
      let a = (__slipperSeed >>> 0) || 1;
      Math.random = function(){
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })();
  `, ctx);
  return ctx;
}

function extractScript(html){
  const start = html.indexOf('<script>');
  const end = html.lastIndexOf('</script>');
  if(start < 0 || end < 0) throw new Error('no script tag');
  return html.slice(start + 8, end);
}

function runOnce(seed, minutes){
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const code = extractScript(html);
  const ctx = createEnv(seed);
  vm.runInContext(code, ctx, { filename: 'slipper-survivor.js' });

  const SS = ctx.__SS;
  if(!SS) throw new Error('__SS debug API missing');

  SS.start(CHAR || undefined);
  SS.state.mode = 'playing';

  const steps = Math.round(minutes * 60 / DT);
  const peaks = { enemies: 0, bullets: 0, particles: 0 };
  const trace = [];
  let gameOverAt = null;
  const t0 = process.hrtime.bigint();
  let picks = 0;

  /* 简易走位 AI：8 方向势场评估，选“下一步离怪最远”的方向 */
  const keys = SS.keys;
  const ARENA = SS.arena;
  const DIRS = [];
  for(let i = 0; i < 8; i++) DIRS.push([Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
  let aiT = 0;
  let lastDx = 0, lastDy = 0;
  function steer(dt){
    aiT -= dt;
    if(aiT > 0) return;
    aiT = 0.06;
    const p = SS.P;
    const list = SS.enemies;
    const gemList = SS.gems;
    const step = 52;
    /* 最近的宝石：没威胁时去捡，否则优先保命 */
    let gx = 0, gy = 0, gd = 1e9;
    for(let i = 0; i < gemList.length; i++){
      const g = gemList[i];
      const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
      if(d < gd){ gd = d; gx = g.x; gy = g.y; }
    }
    gd = Math.sqrt(gd);
    let best = 0, bestScore = -1e9;
    for(let k = 0; k < 8; k++){
      const nx = p.x + DIRS[k][0] * step;
      const ny = p.y + DIRS[k][1] * step;
      let minD = 9999, crowd = 0;
      for(let i = 0; i < list.length; i++){
        const e = list[i];
        if(e.dead) continue;
        const dx = nx - e.x, dy = ny - e.y;
        const d2 = dx * dx + dy * dy;
        if(d2 > 260 * 260) continue;
        const d = Math.sqrt(d2);
        if(d < minD) minD = d;
        crowd += 1 / (d2 + 400);
      }
      let score = minD - crowd * 2200;
      if(nx < 34 || nx > ARENA.w - 34 || ny < 34 || ny > ARENA.h - 34) score -= 420;
      /* 别贴边：始终偏回场地中心，避免被围在角落 */
      const dc = Math.hypot(nx - ARENA.w / 2, ny - ARENA.h / 2);
      score -= Math.max(0, dc - 380) * 0.9;
      /* 离最近的怪还够远、且血量安全时，朝宝石靠 */
      if(gd < 1e8 && minD > 52 && SS.P.hp > SS.P.maxHp * 0.45){
        const gD = Math.hypot(nx - gx, ny - gy);
        score += (step - gD) * 1.6;
      }
      /* 惯性：避免每 60ms 左右横跳，结果原地不动 */
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

  for(let i = 0; i < steps; i++){
    if(SS.state.mode === 'levelup' || SS.state.mode === 'modpick'){
      let guard = 0;
      while((SS.state.mode === 'levelup' || SS.state.mode === 'modpick') && guard++ < 60){ SS.autoPick(); picks++; }
    }
    if(SS.state.mode === 'gameover'){ gameOverAt = SS.state.time; break; }

    if(!STILL) steer(DT);
    SS.step(DT);

    if(SS.state.mode === 'gameover'){ gameOverAt = SS.state.time; break; }
    if(SS.enemies.length > peaks.enemies) peaks.enemies = SS.enemies.length;
    if(SS.bullets.length > peaks.bullets) peaks.bullets = SS.bullets.length;
    /* 每 2 秒采一次压力曲线：血量、贴身怪数、累计受伤/治疗 */
    if(TRACE && i % 120 === 0){
      const st = SS.state;
      trace.push({
        t: +st.time.toFixed(1),
        hp: Math.round(SS.P.hp),
        maxHp: Math.round(SS.P.maxHp),
        atk: st.contactN || 0,
        en: SS.enemies.length,
        hurt: Math.round(st.hurtAcc || 0),
        heal: Math.round(st.healAcc || 0),
        lv: SS.P.level,
        minD: (function(){ let m=1e9; for(const e of SS.enemies){ if(e.dead) continue; const d=Math.hypot(e.x-SS.P.x,e.y-SS.P.y); if(d<m) m=d; } return m===1e9?-1:Math.round(m); })(),
        pr: Math.round(SS.P.r)
      });
    }
  }

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const snap = SS.snapshot();
  return { seed, simMinutes: minutes, wallMs: Math.round(ms), gameOverAt, picks, peaks, trace, snap };
}

const results = [];
for(let r = 0; r < RUNS; r++){
  try{
    results.push(runOnce(SEED + r * 7919, MINUTES));
  }catch(e){
    console.error('SIM ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

if(JSON_OUT){
  console.log(JSON.stringify(results, null, 2));
} else {
  for(const r of results){
    console.log(`\nseed ${r.seed} · 模拟 ${r.simMinutes} 分钟 · 逻辑耗时 ${r.wallMs}ms · 选卡 ${r.picks} 次`);
    console.log(`  存活 ${r.gameOverAt ? r.gameOverAt.toFixed(1) + 's（阵亡）' : r.snap.time + 's'}` +
                ` · 击杀 ${r.snap.kills} · Lv.${r.snap.level}` +
                ` · HP ${r.snap.hp}/${r.snap.maxHp}`);
    console.log(`  峰值：敌人 ${r.peaks.enemies} / 子弹 ${r.peaks.bullets} / 宝石 ${r.snap.gems}`);
    console.log(`  武器：${Object.entries(r.snap.weapons).map(([k, v]) => k + ' Lv' + v).join('、') || '—'}`);
    console.log(`  伤害：${r.snap.dmg.slice(0, 5).map(([k, v]) => k + ' ' + v).join(' · ') || '—'}`);
    const perMin = r.wallMs / Math.max(0.1, (r.gameOverAt || r.snap.time) / 60);
    console.log(`  逻辑成本：${perMin.toFixed(0)}ms / 游戏分钟`);
    if(TRACE && r.trace){
      console.log('  时间\t血量\t贴身\t敌人\t累计受伤\t累计治疗\t等级');
      for(const s of r.trace) console.log(`  ${s.t}\t${s.hp}/${s.maxHp}\t${s.atk}\t${s.en}\t${s.hurt}\t${s.heal}\tLv${s.lv}\t最近${s.minD}\tpr${s.pr}`);
    }
  }
}
