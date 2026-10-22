/* 4.0 回归验证：数值经济 + 四项新机制
   用法：node tools/verify-4.0.mjs

   这一版的核心主张是"不再用上限/下限当平衡手段"，
   所以这套门禁验证的不是某个常数，而是下面这些**性质**：

     1. 护甲 / 闪避 / 治疗都是边际递减，而不是到某个点直接断掉
     2. 敌人伤害是绝对量：堆生命真的更耐揍（旧版按 maxHp 百分比算是无效的）
     3. 接触伤害按"每只怪自己的攻击间隔"结算，被几只围就吃几只
     4. 冲刺 / 过热两条机制真的能触发（擦弹与破韧均已删除）
     5. 刷怪走"威胁预算"，编成由成本决定，而不是一堆互不相干的手调权重
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
  vm.runInContext(html.slice(s + 8, e), ctx, { filename: 'game.js' });
  return ctx.__SS;
}

let pass = 0, fail = 0;
function ok(name, cond, info){
  if(cond){ pass++; console.log('  通过', name, info === undefined ? '' : String(info)); }
  else { fail++; console.log('  失败', name, info === undefined ? '' : String(info)); }
}

function setup(charId){
  const SS = boot(97531);
  SS.start(charId || 'knight');
  SS.state.mode = 'playing';
  SS.state.bossAt = 1e9;
  SS.state.eliteAt = 1e9;
  SS.state.hordeAt = 1e9;
  return SS;
}
function dummy(SS, hp){
  SS.spawn('iron', 1);
  const e = SS.enemies[SS.enemies.length - 1];
  e.hp = e.maxHp = hp || 1e9;
  e.speed = e.baseSpeed = 0;
  e.dmg = 0;
  e.x = SS.P.x + 30;
  e.y = SS.P.y;
  return e;
}

console.log('=== 4.0 回归验证（数值经济 + 新机制）===');

/* ---- 1. 护甲：边际递减，没有断崖 ---- */
{
  const SS = boot(11);
  const t = SS.armorTable();
  let mono = true, diminishing = true;
  let prevPer = 1e9;
  for(let i = 1; i < t.length; i++){
    const gain = t[i].dr - t[i - 1].dr;
    const per = gain / (t[i].pts - t[i - 1].pts);   /* 每一点的收益 */
    if(gain <= 0) mono = false;
    if(per >= prevPer) diminishing = false;
    prevPer = per;
  }
  ok('护甲减伤随投入单调递增（不会到顶就废）', mono && t[t.length - 1].dr > 0.70,
     '0→' + t[0].dr + '，320 点→' + t[t.length - 1].dr);
  ok('护甲每一点的收益递减（不是硬上限）', diminishing,
     '每点收益 20→40 点 ' + ((t[2].dr - t[1].dr) / 20).toFixed(4) +
     '，80→160 点 ' + ((t[4].dr - t[3].dr) / 80).toFixed(4));
}

/* ---- 2. 闪避：多来源乘法合并，永远不到 100% ---- */
{
  const SS = boot(12);
  const one = SS.dodgeOf([0.2]);
  const two = SS.dodgeOf([0.2, 0.2]);
  const ten = SS.dodgeOf([0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2]);
  ok('两个 20% 闪避合成 36%（乘法，不是相加）', Math.abs(two - 0.36) < 0.005, (two * 100).toFixed(1) + '%');
  ok('十个 20% 闪避也远不到 100%', ten < 0.90, (ten * 100).toFixed(1) + '%');
}

/* ---- 3. 敌人伤害是绝对量：堆生命真的更耐揍 ---- */
{
  const A = setup('knight');
  A.state.time = 300;
  A.spawn('burger', 1);
  const e1 = A.enemies[A.enemies.length - 1];
  const dmgThin = e1.dmg;
  /* 同一个时间点、同一种怪，伤害必须与玩家最大生命无关 */
  A.P.maxHp = 4000;
  A.spawn('burger', 1);
  const e2 = A.enemies[A.enemies.length - 1];
  const dmgFat = e2.dmg;
  ok('怪物伤害不随玩家最大生命变化（堆血有效）', Math.abs(dmgThin - dmgFat) < 0.001,
     dmgThin.toFixed(1) + ' / ' + dmgFat.toFixed(1));
}

/* ---- 4. 接触伤害：碰到就掉血，节奏来自玩家侧的受伤间隔 ----
   规则：每次结算 = Σ(贴身怪 dmg) × contactTickMul，再过护甲；
   两次结算之间至少隔 contactTick（0.45 秒）。 */
const S0 = setup('knight');
function biteOnce(n){
  const A = setup('chef');
  A.state.time = 120;
  A.P.hp = A.P.maxHp;
  A.P.contactT = 0;
  A.spawn('iron', n);
  const near = A.enemies.slice(-n);
  for(let i = 0; i < near.length; i++){
    const a = (i / near.length) * Math.PI * 2;
    near[i].x = A.P.x + Math.cos(a) * 12;
    near[i].y = A.P.y + Math.sin(a) * 12;
    near[i].speed = 0;
    near[i].dmg = 40;
  }
  const hp0 = A.P.hp;
  A.step(1 / 60);
  return { lost: hp0 - A.P.hp, armor: A.ST.armor };
}
{
  const one = biteOnce(1), four = biteOnce(4);
  const rule = S0.contactRule();
  ok('碰到就掉血（第一帧就结算，不用等冷却）', one.lost > 1,
     '掉了 ' + one.lost.toFixed(1));
  ok('被几只围就吃几份（线性叠加）', Math.abs(four.lost - one.lost * 4) < one.lost * 0.9,
     '1 只 ' + one.lost.toFixed(1) + ' → 4 只 ' + four.lost.toFixed(1));
  const single = 40 * (1 - one.armor) * rule.mul;
  ok('单次结算按 contactTickMul 折算，不是满额', Math.abs(one.lost - single) < single * 0.3,
     '实测 ' + one.lost.toFixed(1) + ' / 期望 ' + single.toFixed(1) +
     '（tick ' + rule.tick + 's ×' + rule.mul + '）');
}

/* ---- 4a2. 受伤间隔：0.45 秒内不会再吃第二下 ---- */
{
  const A = setup('chef');
  A.state.time = 120;
  A.P.hp = A.P.maxHp;
  A.P.contactT = 0;
  A.spawn('iron', 1);
  const e = A.enemies[A.enemies.length - 1];
  e.x = A.P.x + 10; e.y = A.P.y; e.speed = 0; e.dmg = 40;
  const hp0 = A.P.hp;
  /* 【5.0】受伤间隔 0.45 → 1.1 秒：单口更重、来得更慢。
     断言跟着设计走：0.6 秒内只结算一次，1.6 秒内结算两次。 */
  for(let i = 0; i < 36; i++) A.step(1 / 60);      /* 0.60 秒 */
  const lostOnce = hp0 - A.P.hp;
  for(let i = 0; i < 60; i++) A.step(1 / 60);      /* 累计 1.60 秒 */
  const lostTwice = hp0 - A.P.hp;
  ok('1.1 秒受伤间隔内只结算一次', lostTwice > lostOnce * 1.4 && lostTwice < lostOnce * 2.4,
     '0.6s=' + lostOnce.toFixed(1) + '，1.6s=' + lostTwice.toFixed(1));

  /* 【5.0 回归】撞上去必须**立刻**掉血。
     这条防的是"冷却只在贴身时递减"的老写法：那样挨过一口再离开，
     冷却会冻结，下一次撞上去的第一口不结算——玩家看到的就是"撞怪不掉血"。 */
  {
    const B = setup('ranger');
    B.state.time = 40;
    B.P.contactT = 0;
    const e2 = B.spawn('slime', 1)[0] || B.enemies[B.enemies.length - 1];
    e2.x = B.P.x + 9; e2.y = B.P.y; e2.speed = 0; e2.hp = 1e7; e2.maxHp = 1e7;
    const h0 = B.P.hp;
    B.step(1 / 60);                       /* 只有一帧 */
    const oneFrame = h0 - B.P.hp;
    ok('撞上去第一帧就掉血（不是等冷却）', oneFrame > 0,
       '一帧掉 ' + oneFrame.toFixed(1));
    /* 离开接触 1.2 秒，再撞回来：仍然必须立刻结算 */
    e2.x = B.P.x + 400;
    for(let i = 0; i < 72; i++) B.step(1 / 60);
    /* 这 1.2 秒里玩家可能升级（mode 变成 levelup，updateGame 不再推进），先回到 playing */
    B.state.pending = 0;
    B.state.mode = 'playing';
    /* 游侠有 11% 闪避，单帧断言会抖；最多试 10 次，只要有一帧结算就算过 */
    let hitFrame = 0;
    for(let k = 0; k < 10 && !hitFrame; k++){
      B.P.contactT = 0;
      e2.x = B.P.x + 9; e2.stun = 0;
      const hh = B.P.hp;
      B.step(1 / 60);
      if(hh - B.P.hp > 0) hitFrame = hh - B.P.hp;
    }
    ok('离开再撞回来仍然立刻掉血', hitFrame > 0, '单帧掉 ' + hitFrame.toFixed(1));
  }
}

/* ---- 4b. 统一受伤管线：接触伤害也要先吃护盾 ---- */
{
  /* 用工程师（唯一带护盾的角色）。旧版 applyContact 自己算护甲 + 自己扣血，
     护盾 / 格挡 / 反伤 / 怒气对贴脸伤害全部失效——这条断言就是防它回归。 */
  const A = setup('engineer');
  A.state.time = 120;
  A.P.hp = A.P.maxHp;
  A.spawn('iron', 1);
  const e = A.enemies[A.enemies.length - 1];
  e.x = A.P.x + 10; e.y = A.P.y;
  e.speed = 0; e.dmg = 30;
  A.P.shield = 120; A.ST.shieldMax = 200;
  const hp0 = A.P.hp, sh0 = A.P.shield;
  A.step(1 / 60);
  ok('接触伤害走统一管线（先吃护盾，不再绕过）',
     A.P.hp > hp0 - 0.01 && A.P.shield < sh0,
     '生命 ' + Math.round(hp0) + '→' + Math.round(A.P.hp) + '，护盾 ' + Math.round(sh0) + '→' + Math.round(A.P.shield));
}

/* ---- 4c. 被控住的怪根本咬不到（不是"咬得轻一点"）----
   4.1 把"控制 = 一串减伤乘数"改成一条规则：眩晕 / 冰冻中的敌人这一口没有发生。
   它不参与减伤，所以也不会和护甲互相打架。 */
{
  function bite(stunned){
    const A = setup('chef');
    A.state.time = 120;
    A.P.hp = A.P.maxHp;
    A.spawn('iron', 1);
    const e = A.enemies[A.enemies.length - 1];
    e.x = A.P.x + 10; e.y = A.P.y;
    e.speed = 0; e.dmg = 60;
    if(stunned) e.stun = 2;
    const h = A.P.hp;
    A.step(1 / 60);
    return h - A.P.hp;
  }
  const plain = bite(false), stunned = bite(true);
  ok('眩晕中的敌人完全咬不到你', plain > 1 && stunned < 0.01,
     '普通 ' + plain.toFixed(1) + ' → 眩晕 ' + stunned.toFixed(1));
}

/* ---- 4d. 减伤只有护甲一条线 ---- */
{
  const A = setup('knight');
  ok('受伤管线里没有独立的免伤字段', A.ST.hurtTaken === undefined,
     'ST.hurtTaken = ' + A.ST.hurtTaken);
  const rows = A.armorTable();
  let mono = true;
  for(let i = 1; i < rows.length; i++) if(rows[i].dr <= rows[i - 1].dr) mono = false;
  ok('护甲点数越高减伤越高，且永远不封顶', mono && rows[rows.length - 1].dr < 0.99,
     rows.map(r => r.pts + '→' + Math.round(r.dr * 100) + '%').join(' '));
  /* 每一点护甲的收益必须递减：这是"边际递减"的定义 */
  const g1 = (rows[1].dr - rows[0].dr) / (rows[1].pts - rows[0].pts);
  const g2 = (rows[4].dr - rows[3].dr) / (rows[4].pts - rows[3].pts);
  ok('护甲每一点的收益递减（边际递减，不是硬顶）', g1 > g2 * 1.5,
     g1.toFixed(5) + ' vs ' + g2.toFixed(5));
}

/* ---- 5. 治疗：软预算，效率随回血速度下降 ---- */
{
  const A = setup('chef');
  A.P.hp = Math.max(1, A.P.maxHp * 0.2);
  const per = A.P.maxHp * 0.05;
  const first = A.healTest(per);
  let last = first;
  for(let i = 0; i < 40; i++) last = A.healTest(per);
  ok('连续治疗效率递减（软预算）', last < first * 0.35,
     '首次 ' + first.toFixed(1) + ' → 第 41 次 ' + last.toFixed(1));
}

/* ---- 6. 破韧已经删除（4.1）----
   它同时出现在每一只怪身上，飘字 + 金圈 + 易伤，玩家读不懂它为什么存在。
   这里只留一条"防止死灰复燃"的断言：怪身上不该再有韧性字段。 */
{
  const A = setup('knight');
  A.spawn('slime', 1);
  const e = A.enemies[A.enemies.length - 1];
  ok('破韧已彻底移除（敌人身上没有韧性/破防字段）',
     e.poise === undefined && e.broken === undefined,
     'poise=' + e.poise + ' broken=' + e.broken);
}

/* ---- 7. 灵光已删除（4.2）----
   它读不懂、也没人为了它改变操作。这里只留一条"防止死灰复燃"的断言。 */
{
  const A = setup('ranger');
  ok('灵光系统已彻底移除', A.P.spark === undefined && A.P.grazeCount === undefined,
     'spark=' + A.P.spark + ' grazeCount=' + A.P.grazeCount);
}

/* ---- 8. 冲刺：两段充能 + 位移 + 无敌 + 短 ---- */
{
  const A = setup('ranger');
  const x0 = A.P.x;
  ok('开局有两段冲刺充能', A.eco().dashCharge >= 2, A.eco().dashCharge);
  A.dash();
  for(let i = 0; i < 12; i++) A.step(1 / 60);
  ok('冲刺会位移', Math.abs(A.P.x - x0) > 40, '位移 ' + Math.round(A.P.x - x0));
  ok('冲刺距离被压短（96px，4.0 是 138）', Math.abs(A.P.x - x0) <= 110,
     '位移 ' + Math.round(A.P.x - x0));
  ok('冲刺消耗一段充能', A.eco().dashCharge < 2, A.eco().dashCharge.toFixed(2));
  ok('冲刺期间短暂无敌', A.P.invuln > 0 || A.eco().dashT > 0, 'invuln=' + (A.P.invuln || 0).toFixed(2));
}

/* ---- 8b. 破风：冲刺撞到敌人造成伤害 ---- */
{
  const A = setup('knight');
  A.giveRelic('breakwind', 1);
  A.refresh();
  A.state.time = 60;
  A.spawn('burger', 1);
  const e = A.enemies[A.enemies.length - 1];
  e.x = A.P.x + 40; e.y = A.P.y; e.speed = 0;
  const hp0 = e.hp;
  A.dash();
  for(let i = 0; i < 14; i++) A.step(1 / 60);
  ok('「破风」冲刺撞到敌人会掉血', e.hp < hp0 - 1,
     '血量 ' + Math.round(hp0) + '→' + Math.round(e.hp));
}

/* ---- 9. 过热：超载之后必须有一段恢复期 ---- */
{
  const A = setup('ranger');
  A.P.charge = 100;
  A.P.overload = 0.2;
  A.step(0.3);
  ok('超载结束会进入过热', (A.res().overheat || 0) > 0, '余温 ' + (A.res().overheat || 0).toFixed(1) + 's');
  const c0 = A.P.charge;
  for(let i = 0; i < 30; i++) A.step(1 / 60);
  ok('过热期间充能不涨', A.P.charge <= c0 + 0.01, c0.toFixed(1) + ' → ' + A.P.charge.toFixed(1));
}

/* ---- 10. 刷怪经济：预算随时间与威胁成本变化 ---- */
{
  const A = boot(13);
  const rows = A.ecoTable();
  let rising = true;
  for(let i = 1; i < rows.length; i++) if(rows[i].budget <= rows[i - 1].budget) rising = false;
  ok('刷怪预算随进度增长（不是固定权重表）', rising,
     rows.map(r => r.t + 's:' + r.budget).join(' '));
  const costSlime = A.unitThreatOf('slime');
  const costBrute = A.unitThreatOf('brute');
  ok('高威胁单位成本更高（重甲 > 史莱姆）', costBrute > costSlime * 2,
     costSlime.toFixed(2) + ' vs ' + costBrute.toFixed(2));
}

/* ---- 11. 新武器都能被对应角色抽到 ---- */
{
  const A = boot(14);
  const want = {
    knight: ['claymore'],
    keeper: ['hive'],
    ranger: ['prism'],
    engineer: ['drum'],
    chef: ['ember']
  };
  const bad = [];
  for(const cid in want){
    A.start(cid);
    const pool = A.weaponPool();
    for(const w of want[cid]) if(pool.indexOf(w) < 0) bad.push(cid + ':' + w);
  }
  ok('新武器都在对应角色的武器池里', bad.length === 0, bad.join(' / ') || '5 把全部命中');
}

console.log('\n结果：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
