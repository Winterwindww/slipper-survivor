/* 数值校准：测出每把武器 Lv1 / Lv5 的实际 DPS，反推 BALANCE 校准表
   同一靶场（18 个不会死、不移动的铁罐）、同一时长、真实战斗逻辑。
   用法：
     node tools/tune.mjs                 只打印建议表
     node tools/tune.mjs --apply         直接写回 src/42-weapons.js
     node tools/tune.mjs --sec 10 --apply
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SEC = Number(arg('sec', 10));
const APPLY = argv.includes('--apply');
const GROWTH = Number(arg('growth', 6.0));   /* 期望 Lv5 / Lv1 的倍数 */

/* 定位决定目标强度：靶场里多目标武器天然占优，所以目标分档而不是拉平 */
const ROLE = {
  /* 大范围 / 多目标，靶场里最占便宜 —— 目标给中等，避免实战变成唯一解 */
  aoe: { popcorn:1, bolt:1, mine:1, bubble:1, candy:1, aura:1, flamer:1, tomato:1,
         hole:1, banana:1, chain:1, frost:1, minefactory:1 },
  /* 单点 / 直线：靶场里吃亏，实战打 BOSS 强 —— 目标给低一点 */
  single: { slipper:1, gun:1, fan:1, beam:1, snipe:1, missile:1, boomerang:1, dice:1 },
  /* 近战：要贴脸，风险换收益 */
  melee: { pan:1, cleaver:1, bat:1, chainsaw:1, mop:1, ladle:1, nunchaku:1, pizzacutter:1 },
  /* 部署物：会自己叠数量，可以低一档 */
  deploy: { turret:1, rocket:1, lasertower:1, frosttower:1, tesla:1, pet:1 }
};
const TARGET5 = { aoe: 9000, single: 6200, melee: 7600, deploy: 5400 };

function roleOf(id){
  for (const r in ROLE) if (ROLE[r][id]) return r;
  return 'aoe';
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function boot(seed){
  const els = new Map();
  const mkEl = () => ({
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return true; } },
    style:{ setProperty(){} }, appendChild(){}, addEventListener(){},
    querySelector(){ return mkEl(); }, textContent:'', innerHTML:'', width:0, height:0,
    getContext(){ return new Proxy({}, { get(){ return () => ({ addColorStop(){} }); }, set(){ return true; } }); }
  });
  const sandbox = {
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
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(`(function(){let a=${seed}|0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`, ctx);
  vm.runInContext(code, ctx, { filename:'game.js' });
  return ctx.__SS;
}

const probe = boot(11);
const IDS = probe.weaponIds();
const CUR = probe.balance();

function measure(id, lv){
  const SS = boot(1234 + lv * 97);
  SS.start('ranger');
  for (const k in SS.P.weapons) delete SS.P.weapons[k];
  for (const k in SS.P.cds) delete SS.P.cds[k];
  SS.P.weapons[id] = lv;
  SS.P.wmod[id] = [];
  SS.P.cds[id] = 0.05;
  SS.refresh();

  SS.state.bossAt = 1e9; SS.state.eliteAt = 1e9; SS.state.hordeAt = 1e9;
  const N = 18;
  for (let i = 0; i < N; i++) {
    SS.spawn('iron', 1);
    const e = SS.enemies[SS.enemies.length - 1];
    const a = i / N * Math.PI * 2;
    e.x = SS.P.x + Math.cos(a) * (46 + (i % 4) * 18);
    e.y = SS.P.y + Math.sin(a) * (46 + (i % 4) * 18);
    e.hp = 1e9; e.maxHp = 1e9; e.spd = 0; e.dmg = 0;
  }
  const steps = Math.round(SEC * 60);
  for (let i = 0; i < steps; i++) {
    if (SS.state.mode === 'levelup') SS.autoPick();
    SS.step(1 / 60);
    for (const e of SS.enemies) if (e.hp < 1e9) e.hp = 1e9;
  }
  const snap = SS.snapshot();
  let total = 0;
  for (const [src, v] of snap.dmg) if (src !== '贴身' && src !== 'knock') total += v;
  return total / SEC;
}

const rows = [];
for (const id of IDS) {
  const role = roleOf(id);
  const t5 = TARGET5[role];
  const t1 = t5 / GROWTH;
  const d1 = measure(id, 1);
  const d5 = measure(id, 5);
  const c = CUR[id] || { s: 1, k: 1 };
  /* 现有测量已经包含现有校准，所以要在现有系数上继续修正 */
  const m1 = c.s;
  const m5 = c.s * Math.pow(c.k, 4);
  const s = clamp(m1 * (t1 / Math.max(1, d1)), 0.05, 40);
  const k = clamp(Math.pow((m5 * (t5 / Math.max(1, d5))) / s, 0.25), 0.45, 1.95);
  rows.push({ id, role, d1: Math.round(d1), d5: Math.round(d5), s: +s.toFixed(3), k: +k.toFixed(3) });
}
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

console.log('武器'.padEnd(13) + '定位'.padEnd(8) + 'Lv1'.padStart(8) + 'Lv5'.padStart(9) + '   新系数');
for (const r of rows) {
  console.log(r.id.padEnd(13) + r.role.padEnd(8) + String(r.d1).padStart(8) + String(r.d5).padStart(9)
    + '   s=' + r.s + ' k=' + r.k);
}
const sorted = rows.slice().sort((a, b) => b.d5 - a.d5);
console.log('\n修正前 Lv5 极差：' + (sorted[0].d5 / Math.max(1, sorted[sorted.length - 1].d5)).toFixed(0) + ' 倍');

if (APPLY) {
  const lines = rows.map(r => `  ${r.id}: { s: ${r.s}, k: ${r.k} },`).join('\n');
  const file = path.join(ROOT, 'src/42-weapons.js');
  let src = fs.readFileSync(file, 'utf8');
  const re = /const BALANCE = \{[\s\S]*?\n\};/;
  if (!re.test(src)) { console.error('找不到 BALANCE 表'); process.exit(1); }
  src = src.replace(re, 'const BALANCE = {\n' + lines + '\n};');
  fs.writeFileSync(file, src, 'utf8');
  console.log('\n已写入 src/42-weapons.js，请重新 build 后再跑一次确认。');
}
