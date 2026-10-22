/* 2.6 回归验证：只验证本轮改动的行为，不跑完整对局
   用法：node tools/verify-2.6.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

function makeCtx(){
  const t = {};
  return new Proxy(t, {
    get(o, k){
      if(k in o) return o[k];
      if(k === 'canvas') return { width: 16, height: 16 };
      if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
      if(k === 'createPattern') return () => ({});
      if(k === 'measureText') return () => ({ width: 10 });
      if(k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      return () => {};
    },
    set(o, k, v){ o[k] = v; return true; }
  });
}
function makeEl(tag){
  return {
    tagName: (tag || 'div').toUpperCase(), id: '', className: '', textContent: '', innerHTML: '', title: '',
    offsetWidth: 100, width: 16, height: 16,
    style: { setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; } },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl('canvas'); }, querySelectorAll(){ return []; },
    getContext(){ return makeCtx(); }, focus(){}, blur(){}, click(){}
  };
}

function boot(seed){
  const els = new Map();
  const sandbox = {
    console,
    document: {
      getElementById(id){ if(!els.has(id)){ const e = makeEl('div'); e.id = id; els.set(id, e); } return els.get(id); },
      createElement(tag){ return makeEl(tag); },
      querySelector(){ return makeEl('div'); },
      addEventListener(){},
      body: makeEl('body'), documentElement: makeEl('html')
    },
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener(){}, removeEventListener(){}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.__slipperSeed = seed || 12345;
  const ctx = vm.createContext(sandbox);
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
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const s = html.indexOf('<script>'), e = html.lastIndexOf('</script>');
  vm.runInContext(html.slice(s + 8, e), ctx, { filename: 'slipper.js' });
  const SS = ctx.__SS;
  if(!SS) throw new Error('__SS missing');
  return SS;
}

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('  通过 ' + name + (detail ? '  ' + detail : '')); }
  else { fail++; console.log('  失败 ' + name + (detail ? '  ' + detail : '')); }
}

function startGame(SS, char){
  SS.start(char || 'chef');
  SS.state.mode = 'playing';
  return SS;
}

function run(SS, seconds, dt){
  const step = dt || 1 / 60;
  const n = Math.round(seconds / step);
  for(let i = 0; i < n; i++) SS.step(step);
}

console.log('=== 2.6 回归验证 ===');

/* 1. 重开一局：经验需求必须回到 1 级 */
{
  const SS = boot();
  startGame(SS);
  for(let i = 0; i < 15; i++) SS.forceLevel();
  const lvBefore = SS.P.level;
  const xpBefore = SS.P.xpNext;
  startGame(SS);
  const lvAfter = SS.P.level;
  const xpAfter = SS.P.xpNext;
  ok('重开后等级归 1', lvAfter === 1, `Lv${lvBefore}→Lv${lvAfter}`);
  ok('重开后经验需求归 1 级', xpAfter < xpBefore && xpAfter < 80, `需求 ${xpBefore}→${xpAfter}`);
  ok('重开后经验归零', SS.P.xp === 0, 'xp=' + SS.P.xp);
}

/* 2. 治疗：从"硬预算"改成"边际递减"（4.0）
      仍然必须满足同一条设计目标——连续触发不能换来无限续航，
      但允许"一次大治疗"生效（那是玩家主动拿到的奖励）。 */
{
  const SS = boot();
  startGame(SS);
  SS.P.hp = Math.max(1, Math.round(SS.P.maxHp * 0.2));
  const before = SS.P.hp;
  const per = SS.P.maxHp * 0.05;
  const first = SS.healTest(per);
  let total = first, last = first;
  for(let i = 0; i < 199; i++){ last = SS.healTest(per); total += last; }
  ok('连续治疗有边际递减', last < first * 0.25, `首次 ${first.toFixed(1)} → 第 200 次 ${last.toFixed(1)}`);
  ok('连续治疗总量受控（不是无限续航）', total < per * 12,
     `200 次共回 ${total.toFixed(1)}（请求量 ${(per * 200).toFixed(0)}）`);
  ok('血量确有增加', SS.P.hp > before, `${before}→${SS.P.hp.toFixed(1)}`);
  /* 停止触发之后效率会恢复：这不是"扣血惩罚"，只是"别指望一口气回满" */
  run(SS, 3);
  SS.P.hp = SS.P.maxHp * 0.5;      /* 先把血条放低，否则回血被"已满"截断 */
  const more = SS.healTest(SS.P.maxHp * 0.05);
  /* 【5.0】治疗改成令牌桶之后，"恢复"的含义是桶重新蓄满：
     单次最多能拿到的量 = 桶容量（1 秒预算）。以首次的量为基准比较。 */
  ok('停止触发后治疗池重新蓄满', more > first * 0.9, '3 秒后单次回了 ' + more.toFixed(1) +
     '（池容量 ' + (SS.P.maxHp * 0.007).toFixed(1) + '）');
}

/* 3. 减速与眩晕真的影响移动 */
{
  const SS = boot();
  startGame(SS);
  const measure = (mutate) => {
    const list = SS.enemies;
    const e = list[list.length - 1];
    const x0 = e.x, y0 = e.y;
    if(mutate) mutate(e);
    /* 只推进 AI 一条：直接 step 会带上全系统，取位移模长即可 */
    for(let i = 0; i < 60; i++) SS.step(1 / 60);
    return Math.hypot(e.x - x0, e.y - y0);
  };
  SS.spawn('brute', 1);
  const base = measure(null);
  SS.spawn('brute', 1);
  const slowed = measure(e => { e.slowT = 30; });
  SS.spawn('brute', 1);
  const stunned = measure(e => { e.stun = 30; });
  ok('减速真的生效但不锁死', slowed < base * 0.8 && slowed > base * 0.3, `正常 ${base.toFixed(1)} → 减速 ${slowed.toFixed(1)}`);
  ok('眩晕真的生效', stunned < base * 0.25, `正常 ${base.toFixed(1)} → 眩晕 ${stunned.toFixed(1)}`);
}

/* 4. 三种新远程怪能被生成，并且带正确弹道配置 */
{
  const SS = boot();
  startGame(SS);
  const checks = [
    ['sniper', 1, 380],
    ['spitter', 1, 200],
    ['thrower', 1, 300]
  ];
  for(const [id, n, keepNear] of checks){
    SS.spawn(id, 1);
    const e = SS.enemies[SS.enemies.length - 1];
    const good = e && e.shot && e.shot.n === n && Math.abs(e.shot.keep[0] - keepNear) < 1;
    ok('远程怪 ' + id + ' 可生成且配置正确', !!good, good ? `连发${e.shot.n} 射程${e.shot.range}` : '缺 shot 配置');
  }
}

/* 5. 真实开火：一次命中不会把改造过的元素全挂上 */
{
  const SS = boot();
  startGame(SS, 'chef');
  SS.giveWeapon('flamer', 5);
  SS.P.wmod.flamer = ['burn', 'chill', 'venom', 'volt'];
  SS.render();                       /* 让改造生效 */
  SS.spawn('brute', 1);
  const e = SS.enemies[SS.enemies.length - 1];
  e.x = SS.P.x + 26;
  e.y = SS.P.y + 6;
  e.hp = e.maxHp = 1e9;              /* 别让它死，只看元素 */
  let maxKinds = 0;
  for(let i = 0; i < 180; i++){
    SS.step(1 / 60);
    if(e.st){
      const k = ['fire','ice','venom','volt'].filter(x => e.st[x] > 0).length;
      if(k > maxKinds) maxKinds = k;
    }
  }
  ok('一次命中不会挂满全部元素', maxKinds >= 1 && maxKinds <= 2, `目标身上最多 ${maxKinds} 种`);
}

/* 6. 暴击率不会被叠到必暴 */
{
  const SS = boot();
  startGame(SS, 'chef');
  SS.P.passives.crit = 40;      /* 40 级暴击结晶 = +280% */
  SS.refresh();
  ok('暴击率有上限', SS.ST.crit <= 0.9501, 'ST.crit = ' + (SS.ST.crit * 100).toFixed(1) + '%');
}

/* 7. 跳弹不会再指数繁殖子弹 */
{
  const SS = boot();
  startGame(SS, 'ranger');
  SS.giveRelic('ricochet');
  SS.giveWeapon('slipper', 5);
  SS.spawn('brute', 60);
  let peak = 0;
  for(let i = 0; i < 360; i++){
    SS.step(1 / 60);
    if(SS.bullets.length > peak) peak = SS.bullets.length;
  }
  ok('跳弹不指数繁殖', peak < 260, '6 秒内子弹峰值 ' + peak);
}

console.log(`\n结果：通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
