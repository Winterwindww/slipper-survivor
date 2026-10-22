/* 功能门禁：每把武器单独上阵，验证它**真的产出了效果**。
   冒烟测试只能证明"不崩溃"，抓不到"选了激光炮台却一座都没有"这类问题。
   判定：跑 8 秒后，该武器必须满足其一
     · 伤害归因里有它（快照 dmg 里命中数 > 0）
     · 场上有它部署的单位（炮台 / 宠物）
     · 场上有它发射的子弹
   用法：node tools/funcgate.mjs [--lv 3] [--sec 8] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const LV = Number(arg('lv', 3));
const SEC = Number(arg('sec', 8));

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

const ids = boot(9).weaponIds();

/* ---- 组合测试：多把炮台同时在场，每种都必须真的部署出来 ----
   这是"选了激光炮台却一座都没有"的唯一复现方式：
   单把上阵时上限够，只有多把共享上限才会互相挤掉。 */
function comboTest() {
  const TURRET_W = ['turret', 'lasertower', 'rocket', 'frosttower', 'tesla', 'minefactory'];
  const PET_W = ['pet', 'petbird', 'petcat', 'petslime', 'petlizard', 'petpenguin', 'pethamster'];
  const out = [];
  /* 炮台：一次塞 4 把 */
  const SS = boot(77);
  SS.start('engineer');
  for (const k in SS.P.weapons) { delete SS.P.weapons[k]; delete SS.P.cds[k]; }
  for (const w of TURRET_W.slice(0, 4)) { SS.P.weapons[w] = 3; SS.P.wmod[w] = []; SS.P.cds[w] = 0.02; }
  SS.refresh();
  SS.state.mode = 'playing'; SS.state.bossAt = 1e9; SS.state.eliteAt = 1e9;
  for (let i = 0; i < 10; i++) { SS.spawn('slime', 1); SS.enemies[SS.enemies.length-1].spd = 0; }
  for (let i = 0; i < 60 * 14; i++) {
    if (SS.state.mode === 'levelup') { let g = 0; while (SS.state.mode === 'levelup' && g++ < 40) SS.autoPick(); }
    SS.step(1/60);
  }
  const types = {};
  for (const a of SS.allies) if (a.kind === 'turret') types[a.ttype] = (types[a.ttype] || 0) + 1;
  const missing = TURRET_W.slice(0, 4).filter(w => {
    const map = { turret:'mg', lasertower:'laser', rocket:'rocket', frosttower:'frost' };
    return !types[map[w]];
  });
  out.push({ name:'炮台组合', detail: JSON.stringify(types), missing });

  /* 宠物：一次塞 4 把 */
  const SS2 = boot(78);
  SS2.start('keeper');
  for (const k in SS2.P.weapons) { delete SS2.P.weapons[k]; delete SS2.P.cds[k]; }
  for (const w of PET_W.slice(0, 4)) { SS2.P.weapons[w] = 3; SS2.P.wmod[w] = []; SS2.P.cds[w] = 0.02; }
  SS2.refresh();
  SS2.state.mode = 'playing'; SS2.state.bossAt = 1e9; SS2.state.eliteAt = 1e9;
  for (let i = 0; i < 10; i++) { SS2.spawn('slime', 1); SS2.enemies[SS2.enemies.length-1].spd = 0; }
  for (let i = 0; i < 60 * 12; i++) {
    if (SS2.state.mode === 'levelup') { let g = 0; while (SS2.state.mode === 'levelup' && g++ < 40) SS2.autoPick(); }
    SS2.step(1/60);
  }
  const ptypes = {};
  for (const a of SS2.allies) if (a.kind === 'pet') ptypes[a.ptype] = (ptypes[a.ptype] || 0) + 1;
  const pmap = { pet:'dog', petbird:'bird', petcat:'cat', petslime:'slime' };
  const pmissing = PET_W.slice(0, 4).filter(w => !ptypes[pmap[w]]);
  out.push({ name:'宠物组合', detail: JSON.stringify(ptypes), missing: pmissing });
  return out;
}
const fails = [], oks = [];

for (const id of ids) {
  const SS = boot(1234);
  SS.start('ranger');
  for (const k in SS.P.weapons) { delete SS.P.weapons[k]; delete SS.P.cds[k]; }
  SS.P.weapons[id] = LV;
  SS.P.wmod[id] = [];
  SS.P.cds[id] = 0.02;
  SS.refresh();
  SS.state.mode = 'playing';
  SS.state.bossAt = 1e9; SS.state.eliteAt = 1e9;
  /* 靶子：围一圈不会死的怪 */
  for (let i = 0; i < 10; i++) {
    SS.spawn('slime', 1);
    const e = SS.enemies[SS.enemies.length - 1];
    const a = i / 10 * Math.PI * 2;
    e.x = SS.P.x + Math.cos(a) * (30 + (i % 3) * 14);
    e.y = SS.P.y + Math.sin(a) * (30 + (i % 3) * 14);
    e.spd = 0; e.hp = 1e9; e.maxHp = 1e9;
  }
  let sawBullet = 0, sawAlly = 0;
  const steps = Math.round(SEC * 60);
  for (let i = 0; i < steps; i++) {
    if (SS.state.mode === 'levelup') { let g = 0; while (SS.state.mode === 'levelup' && g++ < 40) SS.autoPick(); }
    SS.step(1/60);
    if (SS.bullets.length > sawBullet) sawBullet = SS.bullets.length;
    if (SS.allies.length > sawAlly) sawAlly = SS.allies.length;
    for (const e of SS.enemies) { if (e.hp < 1e9) e.hp = 1e9; }
  }
  const snap = SS.snapshot();
  const bySrc = SS.dmgBySrc();
  /* 炮台 / 宠物的伤害统一记在 'turret' / 'pet' 上，所以按"场上有单位"判定 */
  const dealt = (bySrc[id] || 0) + (sawAlly > 0 ? (bySrc.turret || 0) + (bySrc.pet || 0) : 0);
  const kills = snap.kills || 0;
  const ok = dealt > 0 || sawBullet > 0 || sawAlly > 0 || kills > 0;
  if (ok) oks.push(`${id}(伤害${Math.round(dealt)}/弹${sawBullet}/召${sawAlly})`);
  else fails.push(id);
}

const combos = comboTest();
let comboFail = 0;
for (const c of combos) {
  if (c.missing.length) { comboFail++; console.log(`组合失败 ${c.name}：缺少 ${c.missing.join(', ')}  实况 ${c.detail}`); }
  else console.log(`组合通过 ${c.name}：${c.detail}`);
}

console.log(`通过 ${oks.length}/${ids.length}`);
console.log(oks.join('  '));
if (fails.length) {
  console.log('\n完全没有产出（选了等于没选）：' + fails.join(', '));
}
if (fails.length || comboFail) process.exit(1);
console.log('\n功能门禁通过');
