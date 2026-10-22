/* 3.0 回归验证：只验证本轮新增/修复的机制，不跑完整对局
   用法：node tools/verify-3.0.mjs
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
function dummy(SS, type, hp){
  SS.spawn(type || 'iron', 1);
  const e = SS.enemies[SS.enemies.length - 1];
  e.hp = e.maxHp = hp || 1e9;
  e.speed = e.baseSpeed = 0;
  e.dmg = 0;
  /* 放到玩家身边：范围型机制（怒爆脉冲 / 心跳泵 / 盾反）需要目标在半径内 */
  e.x = SS.P.x + 40;
  e.y = SS.P.y + 20;
  return e;
}
/* 打一下 + 走一帧：让"每帧怒气/充能上限"正常重置 */
function hit(SS, e, n, amount){
  for(let i = 0; i < n; i++){
    SS.probe(e, amount || 10, { canCrit:false });
    SS.step(1 / 60);
  }
}

const OWN = boot(424242).ownerTables();
const RELICS_OWN = OWN.relics;
const WEAPON_OWN = OWN.weapons;
const CRY_OWN = OWN.crystals;

console.log('=== 3.0 回归验证 ===');

/* ---- 1. 怒气 ---- */
{
  const SS = setup('knight');
  const e = dummy(SS);
  hit(SS, e, 560, 5);
  const r = SS.res();
  /* 4.0 去掉了每秒令牌闸门：攒怒变快之后，560 下会在中途反复进出狂战，
     所以这里验证的是"触发过 + 时长正确"，而不是"最后一帧仍在狂战"。 */
  ok('命中会攒怒气，满 100 进入狂战', (r.rageCount || 0) > 0, '触发 ' + (r.rageCount || 0) + ' 次');
  SS.P.berserk = 3;
  const before = SS.P.berserk;
  SS.step(0.2);
  ok('狂战会随时间结束（不会卡死）', SS.res().berserk < before, '剩余 ' + SS.res().berserk.toFixed(2) + 's');

  /* 狂战增伤：关掉暴击，比较同一发伤害 */
  SS.P.berserk = 0; SS.ST.crit = 0; SS.P.gambleDmg = 1;
  const base = SS.probe(e, 100, { canCrit:false });
  SS.P.berserk = 5;
  const buffed = SS.probe(e, 100, { canCrit:false });
  const ratio = buffed / Math.max(0.001, base);
  ok('狂战伤害加成生效（约 ×1.3~1.5）', ratio > 1.2 && ratio < 1.7, '×' + ratio.toFixed(2));
  SS.P.berserk = 0;
}

/* ---- 2. 怒气构筑：叠加速度 / 形态强化 / 引爆转化 ---- */
{
  /* ① 叠加速度件：同样的命中次数，攒得更快 */
  const A = setup('knight'), ea = dummy(A);
  hit(A, ea, 30, 5);
  const plain = A.res().rage;
  const B = setup('knight'), eb = dummy(B);
  B.giveRelic('ragewhet');
  B.giveRelic('ragecore');
  hit(B, eb, 30, 5);
  const boosted = B.res().rage;
  ok('叠加速度件让怒气来得更快', boosted > plain * 1.3, Math.round(plain) + ' → ' + Math.round(boosted));

  /* ② 形态强化件：狂战期间伤害更高 */
  const C = setup('knight');
  C.giveRelic('ragebrand');
  const ec = dummy(C);
  C.P.berserk = 5; C.ST.crit = 0;
  const withBrand = C.probe(ec, 100, { canCrit:false });
  C.P.berserk = 0;
  const withoutBrand = C.probe(ec, 100, { canCrit:false });
  ok('形态强化件强化狂战伤害', withBrand > withoutBrand * 1.2,
     Math.round(withoutBrand) + ' → ' + Math.round(withBrand));

  /* ③ 引爆转化件：满怒不再进狂战，而是炸一次 */
  const D = setup('knight');
  const ed = dummy(D);
  D.giveRelic('ragevent');
  D.giveRelic('rageburst');
  hit(D, ed, 660, 5);
  const r = D.res();
  ok('裂怒阀门让满怒不再进入狂战', (r.berserk || 0) === 0, 'berserk=' + (r.berserk || 0));
  ok('满怒改为引爆并造成范围伤害', (D.dmgBySrc().rage || 0) > 0, '引爆伤害 ' + Math.round(D.dmgBySrc().rage || 0));
  /* 引爆本身会把怒气清零；这里读到的是"爆炸炸死一片之后又攒回来的量"，
     所以断言的是"没有卡在满怒"而不是"一定是 0"。 */
  ok('引爆不会卡在满怒（能重新开始攒）', (r.rage || 0) < 100, 'rage=' + Math.round(r.rage || 0));

  /* 没有阀门时仍然是狂战 */
  const E2 = setup('knight');
  const ee = dummy(E2);
  E2.giveRelic('ragecore');
  hit(E2, ee, 660, 5);
  ok('没有裂怒阀门时照常进入狂战', (E2.res().rageCount || 0) > 0,
     '触发 ' + (E2.res().rageCount || 0) + ' 次');
}

/* ---- 2.5 狂战吸血 ---- */
{
  const SS = setup('knight');
  const e = dummy(SS);
  SS.P.hp = Math.round(SS.P.maxHp * 0.5);
  const before = SS.P.hp;
  /* 4.0 加了"脱战恢复"，这里先把最近受伤时间压到现在，隔离掉 1.8%/秒 的恢复 */
  SS.P.lastHurt = SS.state.time;
  hit(SS, e, 12, 300);
  for(let i = 0; i < 24; i++) SS.step(1 / 60);
  ok('非狂战状态不吸血', SS.P.hp <= before + 1, Math.round(before) + ' → ' + Math.round(SS.P.hp));

  SS.P.berserk = 6;
  SS.P.hp = Math.round(SS.P.maxHp * 0.5);
  SS.P.lastHurt = SS.state.time;
  const before2 = SS.P.hp;
  hit(SS, e, 12, 300);
  for(let i = 0; i < 24; i++) SS.step(1 / 60);
  /* 【5.0】吸血走的是治疗令牌桶，单次能兑现的量 = 桶容量（0.5% 最大生命/秒）。
     所以这里断的是"确实回了血"，而不是"回了多少"——上限由预算统一管。 */
  ok('狂战期间命中会吸血', SS.P.hp > before2 + 0.9,
     Math.round(before2) + ' → ' + Math.round(SS.P.hp));
}

/* ---- 2.6 充能不是"大招条"，是转速表 ---- */
{
  const A = setup('ranger');
  const f = A.chargeMul();
  A.P.charge = 100;
  const g = A.chargeMul();
  ok('充能越高攻速越快（线性转速）', g < f - 0.1, '空转 ×' + f.toFixed(2) + ' → 满转速 ×' + g.toFixed(2));
  /* 开火要扣充能：否则"转速"只会单调上涨，和大招条没区别 */
  A.P.charge = 80;
  A.spendCharge(10);
  ok('开火会消耗充能（所以是转速不是大招条）', A.P.charge <= 70.5, '80 → ' + Math.round(A.P.charge));
}

/* ---- 3. 充能 → 超载 ---- */
{
  const SS = setup('ranger');
  const e = dummy(SS);
  /* 【3.6】不能再硬编码 slipper：游侠起手武器换成连发弩之后，
     cds.slipper 根本不存在，这条断言会永远读到哨兵值 9。
     改成读"起手那把武器"，以后换起手也不会碎。 */
  const startW = Object.keys(SS.P.weapons)[0] || 'slipper';
  SS.P.cds[startW] = 9;
  /* 逐帧打，记下"开火间隔被拉到的最小值"——超载齐射就是把它压到 0.12。
     只读最后一帧的 cd 会受后续帧重新开火影响，属于测试本身的时序陷阱。 */
  /* 【3.3】充能改成每秒令牌桶之后，"一帧打几百下"不再能瞬间顶满，
     所以这里必须跑够时间（约 12 秒 = 700 帧；充能速率是随时间长的，前期只有 11/s）。
     同时要在**触发超载的那一帧**取样，看槽是否被清零——
     原来读循环结束时的值，会读到超载结束之后重新攒回来的量。 */
  let minCd = 9, sawOverload = false, chargeAtOverload = -1, overloadFrame = -1;
  for(let i = 0; i < 700; i++){
    SS.probe(e, 3, { canCrit:false });
    SS.step(1 / 60);
    const c = SS.P.cds[startW] === undefined ? 9 : SS.P.cds[startW];
    if(c < minCd) minCd = c;
    if(!sawOverload && SS.res().overload > 0){
      sawOverload = true;
      overloadFrame = i;
      chargeAtOverload = SS.res().charge;
    }
  }
  ok('命中攒充能，满 100 触发超载', sawOverload,
     'overload=' + sawOverload + (overloadFrame >= 0 ? '，第 ' + (overloadFrame / 60).toFixed(1) + ' 秒' : ''));
  ok('超载会清空充能槽', sawOverload && chargeAtOverload < 20,
     '触发时 charge=' + Math.round(chargeAtOverload));
  ok('超载瞬间所有武器被拉起来齐射', minCd <= 0.2, 'minCd=' + minCd.toFixed(2));
}

/* ---- 4. 护盾 ---- */
{
  const SS = setup('engineer');
  SS.giveRelic('shdbarrier');
  const maxS = SS.res().shieldMax;
  SS.P.shield = maxS;
  SS.P.invuln = 0;
  const hp0 = SS.P.hp;
  SS.hurtPlayer(60);
  ok('护盾先于生命值吸收伤害', SS.P.hp === hp0 && SS.P.shield < maxS,
     'hp ' + hp0 + '→' + SS.P.hp + ' · 盾 ' + Math.round(SS.P.shield) + '/' + Math.round(maxS));
  /* 【4.2】护盾**不再**随时间自然回充：它只能靠升级与击杀补给。
     这条断言从"会回充"改成"不会自己长回来"——正是这一版的设计意图。 */
  SS.P.shield = 0;
  for(let i = 0; i < 60 * 5; i++){
    if(SS.state.mode !== 'playing') break;
    SS.P.invuln = 1;
    SS.step(1 / 60);
  }
  ok('护盾不再随时间自然回充（改由升级 / 击杀补给）', SS.P.shield < 1,
     '5 秒后仍是 ' + Math.round(SS.P.shield));
}

/* ---- 5. 血肉：真实伤害无视护甲 ---- */
{
  const SS = setup('knight');
  const e = dummy(SS, 'brute');
  e.armor = 0.60;
  SS.P.maxHp = 1000;
  const normal = SS.probe(e, 100, { canCrit:false });
  const pure = SS.probe(e, 100, { canCrit:false, trueDmg:true });
  ok('60% 护甲会吃掉普通伤害', normal < 60, '普通 ' + Math.round(normal));
  ok('真实伤害无视护甲', Math.abs(pure - 100) < 12, '真实 ' + Math.round(pure));

  SS.giveRelic('fleshhammer');
  SS.dmgBySrc();
  SS.probe(e, 10, { canCrit:false });
  const dm = SS.dmgBySrc();
  ok('血肉重锤按最大生命附加伤害', (dm.flesh || 0) > 5, '血肉伤害 ' + Math.round(dm.flesh || 0));
}

/* ---- 6. 吞噬 ---- */
{
  const SS = setup('keeper');
  SS.giveRelic('growdevour');
  const hp0 = SS.P.maxHp;
  for(let i = 0; i < 15; i++){
    SS.spawn('slime', 1);
    const e = SS.enemies[SS.enemies.length - 1];
    e.hp = 1;
    SS.hurt(e, 999);
  }
  ok('吞噬之心每 15 杀叠一层', SS.res().devour === 1, 'devour=' + SS.res().devour);
  ok('吞噬同时加最大生命', SS.P.maxHp === hp0 + 2, hp0 + '→' + SS.P.maxHp);
}

/* ---- 7. 流派识别 ---- */
{
  const SS = setup('knight');
  const t0 = SS.arch().rage.tier;
  SS.giveRelic('ragecore');
  SS.giveRelic('ragebrand');
  const a = SS.arch().rage;
  ok('角色禀赋让初始流派达到 I 级', t0 >= 1, '初始 ' + t0);
  ok('两件同路遗物把怒气推到 II 级', a.tier >= 2, '点数 ' + a.pts.toFixed(1) + ' → ' + a.tier + ' 级');
}

/* ---- 8. 新内容确实进卡池 ---- */
{
  const SS = setup('ranger');
  SS.giveRelic('chggear');
  let sawCharge = false, sawRelic = false;
  for(let i = 0; i < 60; i++){
    const d = SS.draft(3);
    for(const o of d){
      if(o.kind === 'crystal' && o.id === 'chargegem') sawCharge = true;
      if(o.kind === 'relic' && ['chgres', 'chgcap', 'chgcore', 'chgcoil', 'chgspring'].indexOf(o.id) >= 0) sawRelic = true;
    }
  }
  ok('过载结晶会出现在卡池', sawCharge);
  ok('过载遗物会出现在卡池', sawRelic);
}

/* ---- 9. 精英词缀 ---- */
{
  const SS = setup('knight');
  const seen = {};
  for(let i = 0; i < 24; i++){
    const r = SS.spawnElite();
    if(r && r.affix) seen[r.affix] = 1;
    /* 立刻清场，避免影响下一次 */
    SS.enemies.length = 0;
  }
  const keys = Object.keys(seen);
  ok('精英会带行为词缀', keys.length >= 2, keys.join('/'));
}

/* ---- 10. 角色专属卡池：别人的东西抽不到 ---- */
{
  function scan(charId, rolls){
    const SS = setup(charId);
    const relics = {}, weapons = {}, crystals = {};
    for(let i = 0; i < rolls; i++){
      for(const o of SS.draft(3)){
        if(o.kind === 'relic') relics[o.id] = 1;
        if(o.kind === 'wnew' || o.kind === 'swapNew') weapons[o.id] = 1;
        if(o.kind === 'crystal') crystals[o.id] = 1;
      }
    }
    return { relics: Object.keys(relics), weapons: Object.keys(weapons), crystals: Object.keys(crystals) };
  }
  const knight = scan('knight', 120);
  const ranger = scan('ranger', 120);
  const engineer = scan('engineer', 120);
  const bad = [];
  for(const id of knight.relics) if(RELICS_OWN[id] && RELICS_OWN[id] !== 'knight') bad.push('骑士拿到 ' + id);
  for(const id of ranger.relics) if(RELICS_OWN[id] && RELICS_OWN[id] !== 'ranger') bad.push('游侠拿到 ' + id);
  for(const id of engineer.relics) if(RELICS_OWN[id] && RELICS_OWN[id] !== 'engineer') bad.push('工程师拿到 ' + id);
  ok('专属遗物不会串角色', bad.length === 0, bad.slice(0, 3).join(' / '));

  const wpBad = [];
  for(const id of knight.weapons) if(WEAPON_OWN[id]) wpBad.push('骑士拿到 ' + id);
  for(const id of ranger.weapons) if(WEAPON_OWN[id]) wpBad.push('游侠拿到 ' + id);
  ok('专属武器不会串角色（炮台只给工程师 / 宠物只给饲养员）', wpBad.length === 0, wpBad.slice(0, 3).join(' / '));

  /* 每个角色都必须真的能抽到"只有自己有"的东西，否则专属就是空话 */
  const CH6 = ['knight', 'ranger', 'engineer', 'keeper', 'chef'];
  /* 武器：直接看"这个角色的池子里有没有专属武器"。
     用 draft 抽样判断会有随机性，池子判断才是确定性的。 */
  const noWp = [], noRel = [], noCry = [];
  for(const c of CH6){
    const SS = setup(c);
    const poolIds = SS.weaponPool();
    if(!poolIds.some(id => WEAPON_OWN[id] === c)) noWp.push(c);
    if(!SS.crystalPool().some(id => CRY_OWN[id] === c)) noCry.push(c);
    const got = scan(c, 60);
    if(!got.relics.some(id => RELICS_OWN[id] === c)) noRel.push(c);
  }
  ok('六个角色都有专属武器可抽', noWp.length === 0, noWp.join(',') || CH6.join('/'));
  ok('六个角色都有专属遗物可抽', noRel.length === 0, noRel.join(','));
  ok('六个角色都有专属结晶可抽', noCry.length === 0, noCry.join(','));

  ok('骑士能抽到自己的怒气遗物', knight.relics.some(id => RELICS_OWN[id] === 'knight'), knight.relics.filter(id => RELICS_OWN[id] === 'knight').slice(0, 3).join('/'));
  ok('游侠能抽到自己的充能遗物', ranger.relics.some(id => RELICS_OWN[id] === 'ranger'), ranger.relics.filter(id => RELICS_OWN[id] === 'ranger').slice(0, 3).join('/'));
  ok('工程师能抽到自己的护盾遗物', engineer.relics.some(id => RELICS_OWN[id] === 'engineer'), engineer.relics.filter(id => RELICS_OWN[id] === 'engineer').slice(0, 3).join('/'));

  /* 资源归属：只有对应角色有这条资源 */
  const K = setup('knight'), R = setup('ranger'), E = setup('engineer'), P2 = setup('keeper');
  ok('只有骑士有怒气', !!K.char.hasRage && !R.char.hasRage && !E.char.hasRage && !P2.char.hasRage);
  ok('只有游侠有充能', !K.char.hasCharge && !!R.char.hasCharge && !E.char.hasCharge);
  ok('只有工程师有护盾', !K.char.hasShield && !R.char.hasShield && !!E.char.hasShield);
  ok('只有饲养员有吞噬', !K.char.hasDevour && !!P2.char.hasDevour);

  /* 非骑士打满命中也不该进狂战 */
  const e2 = dummy(R);
  hit(R, e2, 200, 3);
  ok('游侠命中不会攒出怒气', (R.res().rage || 0) < 1 && (R.res().berserk || 0) === 0,
     'rage=' + Math.round(R.res().rage || 0));
}

/* ---- 11. 治疗口径没有被新系统绕过 ---- */
{
  const SS = setup('chef');
  SS.P.hp = SS.P.maxHp * 0.4;
  const per = SS.P.maxHp * 0.05;
  const first = SS.healTest(per);
  let last = first;
  for(let i = 0; i < 19; i++) last = SS.healTest(per);
  ok('连续治疗会被效率曲线压下去', last < first * 0.35,
     '首次 ' + first.toFixed(1) + ' → 第 20 次 ' + last.toFixed(1));
}

console.log('\n结果：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
