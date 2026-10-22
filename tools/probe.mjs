/* 数据探针：把"肉不肉""充能是不是永远满"变成数字。
   用法：
     node tools/probe.mjs                       # 默认 10 分钟，全部角色
     node tools/probe.mjs --minutes 10 --chars ranger,knight
     node tools/probe.mjs --still               # 站桩（不做走位）
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
const SEEDS = Number(arg('seeds', 3));
const STILL = argv.includes('--still');
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
function extractScript(html){
  const s = html.indexOf('<script>'), e = html.lastIndexOf('</script>');
  return html.slice(s + 8, e);
}

function run(charId, minutes, seed){
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ctx = createEnv(seed);
  vm.runInContext(extractScript(html), ctx, { filename: 'slipper-survivor.js' });
  const SS = ctx.__SS;
  SS.start(charId);
  SS.state.mode = 'playing';

  const A = {
    char: charId,
    dmgIn: 0, dmgOut: 0, heal: 0, healIn: 0,
    overloadT: 0, overloadN: 0, chargeSum: 0, chargeSamples: 0,
    chargeFullT: 0,            /* 充能 ≥99 的时长 */
    bossDmgTaken: 0, bossHitN: 0,
    diedAt: null,
    hpAt: {},                  /* 分钟 -> [hp, maxHp] */
    rangedKills: 0, rangedSeen: 0,
    dmgByMinute: [],
    hpByMinute: [],
  };

  const keys = SS.keys;
  const ARENA = SS.arena;
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
        const e = list[i];
        if(e.dead) continue;
        const dx = nx - e.x, dy = ny - e.y, d2 = dx * dx + dy * dy;
        if(d2 > 260 * 260) continue;
        const d = Math.sqrt(d2);
        if(d < minD) minD = d;
        crowd += 1 / (d2 + 400);
      }
      let score = minD - crowd * 2200;
      /* 【3.3】远程怪加密之后，不会躲弹的 AI 完全测不出真实生存力：
         它只看怪的位置，站在弹幕里照样"觉得安全"。
         这里把未来 0.5 秒内会经过的敌弹也算进威胁，
         否则"远程怪增加"会被误读成"游戏变得不可能"。 */
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
  let lastMinute = -1;
  let prevDmgIn = 0, prevHeal = 0;
  for(let i = 0; i < steps; i++){
    if(SS.state.mode === 'levelup' || SS.state.mode === 'modpick'){ autoPick(); continue; }
    if(SS.state.mode === 'gameover'){ A.diedAt = SS.state.time; break; }
    if(!STILL) steer(DT);
    SS.step(DT);

    const P = SS.P;
    A.chargeSamples++;
    A.chargeSum += P.charge || 0;
    if((P.charge || 0) >= 99) A.chargeFullT += DT;
    if(P.overload > 0) A.overloadT += DT;
    /* 【4.2】护盾也算"受伤"：只统计生命值会漏掉工程师这种"盾吃九成"的角色 */
    if(A._lastSh !== undefined && (P.shield || 0) < A._lastSh){
      A.dmgIn += A._lastSh - (P.shield || 0);
    }
    A._lastSh = P.shield || 0;
    if(P.hp < (A._lastHp || P.maxHp)){
      A.dmgIn += (A._lastHp || P.maxHp) - P.hp;
    } else if(A._lastHp !== undefined && P.hp > A._lastHp){
      /* 【4.0】对手伤害的对称项：把"这一局一共回了多少血"也记下来。
         只看受伤会误判——厨师每分钟吃 250% 血还能活，是因为他在不停回血；
         不称一下另一头，就分不清"耐打"和"打不死"。 */
      A.healIn += P.hp - A._lastHp;
    }
    A._lastHp = P.hp;

    /* 【3.5】贴身压力：同屏数量会被 cap 卡死，真正决定压力的是"够得着玩家的怪" */
    {
      const near = SS.enemies;
      let n60 = 0, nearSum = 0, nearN = 0;
      for(let i = 0; i < near.length; i++){
        const e = near[i];
        if(e.dead) continue;
        const dd = Math.hypot(e.x - P.x, e.y - P.y);
        if(dd < 70) n60++;
        if(dd < 240){ nearSum += dd; nearN++; }
      }
      A._n60 = (A._n60 || 0) + n60;
      A._n60c = (A._n60c || 0) + 1;
      A._nearSum = (A._nearSum || 0) + (nearN ? nearSum / nearN : 0);
      /* 【4.0】4.0 的接触伤害是"一口一口咬"，所以真正要看的不是"几只怪在 70px 内"，
         而是"这一帧有几只怪真的咬到了"。biteN 由 applyContact 写入。 */
      A._bite = (A._bite || 0) + (SS.state.biteN || 0);
      A._biters = (A._biters || 0) + (SS.state.contactN || 0);
    }
    const m = Math.floor(SS.state.time / 60);
    if(m !== lastMinute){
      lastMinute = m;
      const dS = SS.state.dmgSrc || { contact:0, hit:0, boss:0 };
      const dP = A._prevSrc || { contact:0, hit:0, boss:0 };
      const dIn = Math.max(1, Math.round(A.dmgIn - prevDmgIn));
      A.hpByMinute.push({ m, hp: Math.round(P.hp), maxHp: Math.round(P.maxHp), lv: P.level || 1,
        dmgIn: Math.round(A.dmgIn - prevDmgIn),
        press: Math.round((A.dmgIn - prevDmgIn) / Math.max(1, P.maxHp) * 100),
        srcC: Math.round((dS.contact - dP.contact) / dIn * 100),
        srcH: Math.round((dS.hit - dP.hit) / dIn * 100),
        srcB: Math.round((dS.boss - dP.boss) / dIn * 100),
        n60: A._n60c ? Math.round(A._n60 / A._n60c * 10) / 10 : 0,
        near: A._nearSum / Math.max(1, A._n60c),
        bites: Math.round((A._bite || 0) / Math.max(1, A._n60c) * 100) / 100,
        biters: Math.round((A._biters || 0) / Math.max(1, A._n60c) * 10) / 10,
        overloads: (SS.P.overloadCount || 0),
        enemies: SS.enemies.filter(e => !e.dead).length,
        ranged: SS.enemies.filter(e => !e.dead && e.shot).length });
      A._prevSrc = { contact: dS.contact, hit: dS.hit, boss: dS.boss };
      prevDmgIn = A.dmgIn;
      prevHeal = A.heal;
      A._n60 = 0; A._n60c = 0; A._nearSum = 0; A._bite = 0; A._biters = 0;
    }
  }
  /* 统计超载次数：overloadCount 在 P 上 */
  A.overloadN = SS.P.overloadCount || 0;
  A.finalTime = SS.state.time;
  A.alive = SS.state.mode !== 'gameover';
  A.level = SS.P.level;
  A.kills = SS.state.kills;
  A.maxHp = SS.P.maxHp;
  A.avgCharge = A.chargeSum / Math.max(1, A.chargeSamples);
  A.chargeFullPct = A.chargeFullT / Math.max(0.001, SS.state.time);
  A.overloadPct = A.overloadT / Math.max(0.001, SS.state.time);
  A.dmgInPerSec = A.dmgIn / Math.max(0.001, SS.state.time);
  A.healInPerSec = A.healIn / Math.max(0.001, SS.state.time);
  return A;
}

const rows = [];
const SEEDLIST = [];
for(let i = 0; i < SEEDS; i++) SEEDLIST.push(SEED + i * 999);
for(const c of CHARS){
  for(const seed of SEEDLIST){
    try { rows.push(run(c, MINUTES, seed)); }
    catch(err){ console.error(c, seed, err.message); }
  }
}

const fmt = (n, d) => (n === null || n === undefined || Number.isNaN(n)) ? '-' : Number(n).toFixed(d === undefined ? 1 : d);
const byChar = {};
for(const r of rows){ (byChar[r.char] = byChar[r.char] || []).push(r); }
const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/* 全角色合并中位：这是"AI 打一局大概能活多久"的唯一口径。
   目标区间 260~340 秒——AI 比人差，所以真人的分布会更靠右。 */
{
  const all = [];
  for(const c in byChar) for(const x of byChar[c]) all.push(x.finalTime);
  all.sort((a, b) => a - b);
  const overall = all.length ? all[Math.floor(all.length / 2)] : 0;
  const clears = all.filter(t => t >= 600).length;
  const early = all.filter(t => t < 180).length;
  /* 【5.0 KPI】首 BOSS 阵亡率：BOSS 在 150 秒登场、下一个在 240 秒，
     所以死在 [150,240) 就是"倒在第一个 BOSS 手里"。
     这是用户明确给的目标：约 1/4 的局应该过不去第一个 BOSS。 */
  const bossWall = all.filter(t => t >= 150 && t < 240).length;
  const preBoss = all.filter(t => t < 150).length;
  console.log('\n>>> AI 合并中位存活 ' + Math.round(overall) + 's（目标 260~300s）· 通关 ' +
    clears + '/' + all.length + ' · 3 分钟前死亡 ' + early + '/' + all.length);
  console.log('>>> 首 BOSS 阵亡 ' + bossWall + '/' + all.length +
    '（' + Math.round(bossWall / Math.max(1, all.length) * 100) + '%，目标 25%）· BOSS 前阵亡 ' +
    preBoss + '/' + all.length + '（' + Math.round(preBoss / Math.max(1, all.length) * 100) + '%）');
}
console.log('\n=== 汇总（' + SEEDS + ' 种子中位，' + MINUTES + ' 分钟，' + (STILL ? '站桩' : '走位') + '）===\n');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('角色', 12) + pad('存活', 8) + pad('死亡数', 8) + pad('Lv', 5) + pad('击杀', 8) + pad('最大生命', 10)
  + pad('受伤/秒', 10) + pad('回复/秒', 10) + pad('超载次数', 10) + pad('超载占比', 10) + pad('充能均值', 10) + pad('满充占比', 10));
console.log('-'.repeat(102));
for(const c in byChar){
  const g = byChar[c];
  console.log(pad(c, 12) + pad(fmt(med(g.map(x => x.finalTime)), 0) + 's', 8)
    + pad(g.filter(x => !x.alive).length + '/' + g.length, 8)
    + pad(fmt(med(g.map(x => x.level)), 0), 5) + pad(fmt(med(g.map(x => x.kills)), 0), 8)
    + pad(fmt(med(g.map(x => x.maxHp)), 0), 10)
    + pad(fmt(med(g.map(x => x.dmgInPerSec)), 2), 10)
    + pad(fmt(med(g.map(x => x.healInPerSec)), 2), 10)
    + pad(fmt(med(g.map(x => x.overloadN)), 0), 10)
    + pad(fmt(med(g.map(x => x.overloadPct)) * 100, 0) + '%', 10)
    + pad(fmt(med(g.map(x => x.avgCharge)), 0), 10)
    + pad(fmt(med(g.map(x => x.chargeFullPct)) * 100, 0) + '%', 10));
}

/* 机器可读的结果行：给 probe-fast.mjs 并行汇总用 */
for(const c in byChar){
  for(const r of byChar[c]){
    console.log('__RUN__ ' + JSON.stringify({ char: c, t: Math.round(r.finalTime), alive: !!r.alive }));
  }
}
if(!argv.includes('--quiet')) console.log('\n=== 逐分钟（第一个种子样本）===\n');
console.log('\n=== 逐分钟（第一个种子样本）===\n');
if(!argv.includes('--quiet')) for(const c in byChar){
  console.log('--- ' + c + ' ---');
  console.log(pad('分钟', 6) + pad('Lv', 5) + pad('生命', 12) + pad('本分钟受伤', 12) + pad('占血量', 8) + pad('咬/秒', 8) + pad('可咬怪', 8) + pad('同屏怪', 8) + pad('远程怪', 8) + pad('贴身%', 8) + pad('弹幕%', 8) + pad('BOSS%', 8));
  for(const s of byChar[c][0].hpByMinute){
    console.log(pad(s.m + 1, 6) + pad(s.lv, 5) + pad(s.hp + '/' + s.maxHp, 12)
      + pad(s.dmgIn, 12) + pad((s.press === undefined ? '-' : s.press + '%'), 8)
      + pad((s.bites === undefined ? '-' : (s.bites * 60).toFixed(2)), 8)
      + pad((s.biters === undefined ? '-' : s.biters), 8)
      + pad(s.enemies, 8) + pad(s.ranged, 8)
      + pad((s.srcC === undefined ? '-' : s.srcC + '%'), 8) + pad((s.srcH === undefined ? '-' : s.srcH + '%'), 8) + pad((s.srcB === undefined ? '-' : s.srcB + '%'), 8));
  }
  console.log('');
}
