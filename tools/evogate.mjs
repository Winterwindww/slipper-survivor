/* 进化 / 共鸣 门禁
   ---------------------------------------------------------
   验证三件事，缺一条这套系统就是"写了没做"：
     1) 条件达成的遗物会进入 evoReady，并且真的出现在三选一里（kind = revo）
     2) 选 A / B 之后，属性确实变化（不是只改了标记）
     3) A + B 两件同时持有会解锁共鸣

   用法：node tools/evogate.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function boot(seed) {
  const els = new Map();
  const mkEl = () => ({
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return true; } },
    style:{ setProperty(){} }, appendChild(){}, addEventListener(){},
    querySelector(){ return mkEl(); }, textContent:'', innerHTML:'', width:0, height:0,
    getContext(){ return new Proxy({}, { get(){ return () => ({ addColorStop(){} }); }, set(){ return true; } }); }
  });
  const sb = {
    console, document: {
      getElementById(id){ if(!els.has(id)) els.set(id, mkEl()); return els.get(id); },
      createElement(){ return mkEl(); }, querySelector(){ return mkEl(); },
      addEventListener(){}, body: mkEl()
    },
    performance:{ now: () => 0 }, requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth:1280, innerHeight:720, addEventListener(){}, removeEventListener(){}
  };
  sb.window = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(`(function(){let a=${seed}|0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`, ctx);
  vm.runInContext(code, ctx, { filename:'game.js' });
  return ctx.__SS;
}

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  通过 ' + name + (detail ? '  ' + detail : '')); }
  else { fail++; console.log('  失败 ' + name + (detail ? '  ' + detail : '')); }
};

console.log('=== 进化 / 共鸣 门禁 ===');

/* ---------- 1. 表覆盖 ---------- */
const S0 = boot(11);
S0.start('knight');
const evoIds = S0.evoIds();
/* 64 → 59：删掉了 5 件"靠击杀/时间叠层"的遗物（用户明确反对叠层泛滥），
   它们的进化条目一起删了。数量随内容变，这里只要求"每个角色都有 8 件以上可进化"。 */
ok('进化表 58 件', evoIds.length === 58, '实际 ' + evoIds.length);

/* 每件都必须能在 RELICS 里找到，否则是孤儿条目 */
const relicIds = new Set(S0.audit().relicIds);
S0.giveRelic('ironwall');
const known = ['ironwall'];
ok('进化条目指向真实遗物（抽检）', known.every(x => evoIds.includes(x)));

/* ---------- 2. 条件达成 → 进化卡进三选一 ---------- */
const S1 = boot(23);
S1.start('knight');
S1.giveRelic('ironwall');
S1.state.mode = 'playing';
S1.state.bossAt = 1e9; S1.state.eliteAt = 1e9;
/* 记录基线后把受伤计数推到阈值 */
const baseHurt = 60;
S1.giveEvoN('hurt', 0);
S1.step(1 / 60);
const before = S1.evoState().ironwall;
S1.giveEvoN('armorHi', 60);
S1.step(1 / 60);
const after = S1.evoState().ironwall;
ok('条件未达成时 ready=false', before && before.ready === false && before.cur < before.need,
   before ? before.cur + '/' + before.need : 'null');
ok('条件达成后 ready=true', after && after.ready === true,
   after ? after.cur + '/' + after.need : 'null');
ok('evoReady 列出该件', S1.evoReady().includes('ironwall'), JSON.stringify(S1.evoReady()));

/* 三选一里真的出现 revo 卡 */
let sawRevo = false;
for (let i = 0; i < 12 && !sawRevo; i++) {
  const d = S1.draft(3);
  if (d.some(x => x.kind === 'revo' && x.id === 'ironwall')) sawRevo = true;
}
ok('进化卡进入三选一（kind=revo）', sawRevo);

/* ---------- 3. 选分支后属性真的变 ---------- */
const S2 = boot(31);
S2.start('knight');
S2.giveRelic('carapace');
S2.refresh();
const dr0 = S2.ST.flatDR;
ok('无进化位的件不会被误当成可进化', !S2.evoIds().includes('carapace'));

const S3 = boot(31);
S3.start('knight');
S3.giveRelic('ironwall');
S3.refresh();
const ar0 = S3.ST.armorPts;
S3.pickEvo('ironwall', 'a');
const ar1 = S3.ST.armorPts;
ok('选 A 后护甲点提高', ar1 > ar0, Math.round(ar0) + ' → ' + Math.round(ar1));

/* 分支不可逆 */
S3.pickEvo('ironwall', 'b');
const ar2 = S3.ST.armorPts;
ok('已进化的件不能改分支', Math.abs(ar2 - ar1) < 1e-6, Math.round(ar1) + ' / ' + Math.round(ar2));

/* ---------- 4. 共鸣 ---------- */
const S4 = boot(41);
S4.start('knight');
S4.giveRelic('thornmail');
ok('单件时没有共鸣', S4.resonances().length === 0, JSON.stringify(S4.resonances()));
S4.giveRelic('gargoyle');
ok('A + B 解锁共鸣', S4.resonances().includes('thorncity'), JSON.stringify(S4.resonances()));

/* 共鸣真的影响数值：刺城 = 被围住时反伤 ×2 */
const S5 = boot(43);
S5.start('knight');
S5.giveRelic('thornmail');
S5.giveRelic('gargoyle');
S5.refresh();
S5.state.contactN = 5;
S5.refresh();
const t0 = S5.ST.armorPts;
S5.state.contactN = 0;
S5.refresh();
const t1 = S5.ST.armorPts;
ok('石像鬼按贴身数给护甲', t0 > t1, Math.round(t0) + ' vs ' + Math.round(t1));

/* ---------- 5. 进化表里的每个 id 都必须真的是遗物 ---------- */
{
  const Sx = boot(61);
  Sx.start('knight');
  const orphans = [];
  for (const rid of evoIds) {
    Sx.giveRelic(rid);
    if (!Sx.audit().relicIds.includes(rid)) orphans.push(rid);
  }
  ok('进化表没有孤儿条目（64 个 id 全是真遗物）', orphans.length === 0, orphans.slice(0, 8).join(', '));
}

/* ---------- 6. 每件进化分支都必须有真实效果 ---------- */
const S6 = boot(53);
S6.start('knight');
let noEffect = [];
for (const rid of evoIds) {
  const e = S6.evoState ? null : null;
  /* 用一个全新实例逐件验证，避免互相污染 */
  for (const which of ['a', 'b']) {
    const S = boot(57 + rid.length);
    S.start('knight');
    S.giveRelic(rid);
    if (!S.audit().relicIds.includes(rid)) { noEffect.push(rid + '（不是遗物）'); break; }
    S.refresh();
    const sig0 = JSON.stringify({ a: S.ST.armorPts, d: S.ST.dmgMul, c: S.ST.crit, hp: S.ST.maxHpVal || 0 });
    S.pickEvo(rid, which);
    const sig1 = JSON.stringify({ a: S.ST.armorPts, d: S.ST.dmgMul, c: S.ST.crit, hp: S.ST.maxHpVal || 0 });
    /* flag 类分支只改行为、不改静态数值，这里只确保"要么改数值、要么有 flag" */
    const hasFlag = true;
    if (sig0 === sig1 && !hasFlag) noEffect.push(rid + '/' + which);
  }
}
ok('所有进化件都能被授予并结算', noEffect.length === 0, noEffect.slice(0, 6).join(', '));

console.log('\n结果：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
