/* 武器实测 DPS：每把武器单独上阵，打一群不会死的靶子，量真实输出
   不是算公式，是跑真实战斗逻辑后读伤害归因。
   用法：node tools/weapondps.mjs --lv 1,3,5 --sec 24 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const LVS = arg('lv', '1,3,5').split(',').map(Number);
const SEC = Number(arg('sec', 24));
const ONLY = arg('only', '').split(',').filter(Boolean);

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

const SS0 = boot(7);
const names = Object.keys(SS0.weapons ? SS0.weapons : {});
void names;

/* 从内核读武器表：给个访问器 */
const WEAPON_IDS = (() => {
  const s = boot(11);
  return s.weaponIds ? s.weaponIds() : null;
})();
if(!WEAPON_IDS){ console.error('需要 __SS.weaponIds()'); process.exit(1); }

const rows = [];
for (const id of WEAPON_IDS) {
  if (ONLY.length && ONLY.indexOf(id) < 0) continue;
  const rec = { id, dps: {} };
  for (const lv of LVS) {
    const SS = boot(1234 + lv * 97);
    SS.start('ranger');
    /* 【3.0】用"中性角色"测量：游侠自带 +1 弹道、厨师自带反应加成，
       直接拿角色当基准会让弹道类武器凭空多 50%~100% 伤害。
       这里把角色的结构性与数值性加成全部抹平，只看武器本体。 */
    if (SS.char) {
      SS.char.projBonus = 0;
      SS.char.dmg = 1;
      SS.char.crit = 0.05;
      SS.char.critMul = 1.6;
      SS.char.armor = 0;
      SS.char.hp = 300;
      SS.char.speed = 100;
      SS.char.rageGain = 1;
      SS.char.berserkBonus = 0;
      SS.char.berserkDmg = 0;
      SS.char.schools = [];
      SS.char.affinity = [];
    }
    SS.P.maxHp = 300; SS.P.hp = 300;
    /* 清空起始武器，只留这一把 */
    for (const k in SS.P.weapons) delete SS.P.weapons[k];
    for (const k in SS.P.cds) delete SS.P.cds[k];
    SS.P.weapons[id] = lv;
    SS.P.wmod[id] = [];
    SS.P.cds[id] = 0.05;
    SS.refresh();

    /* 靶场：一群不会死的靶子，围在中距离 */
    SS.state.bossAt = 1e9; SS.state.eliteAt = 1e9; SS.state.hordeAt = 1e9;
    const N = 18;
    for (let i = 0; i < N; i++) {
      SS.spawn('iron', 1);
      const e = SS.enemies[SS.enemies.length - 1];
      const a = i / N * Math.PI * 2;
      const d = 46 + (i % 4) * 18;
      e.x = SS.P.x + Math.cos(a) * d;
      e.y = SS.P.y + Math.sin(a) * d;
      e.hp = 1e9; e.maxHp = 1e9; e.spd = 0; e.dmg = 0;
    }
    const steps = Math.round(SEC * 60);
    for (let i = 0; i < steps; i++) {
      if (SS.state.mode === 'levelup') SS.autoPick();
      SS.step(1 / 60);
      /* 靶子不能被推走 */
      for (const e of SS.enemies) { if(e.hp < 1e9) e.hp = 1e9; }
    }
    const snap = SS.snapshot();
    let total = 0;
    for (const [src, v] of snap.dmg) if (src !== '贴身' && src !== 'knock') total += v;
    rec.dps[lv] = Math.round(total / SEC);
  }
  rows.push(rec);
}

rows.sort((a, b) => b.dps[LVS[LVS.length-1]] - a.dps[LVS[LVS.length-1]]);
console.log('武器'.padEnd(14) + LVS.map(l => ('Lv' + l).padStart(10)).join('') + '   成长');
for (const r of rows) {
  const first = r.dps[LVS[0]] || 1, last = r.dps[LVS[LVS.length-1]] || 0;
  console.log(r.id.padEnd(14) + LVS.map(l => String(r.dps[l]).padStart(10)).join('')
    + '   ×' + (last / Math.max(1, first)).toFixed(2));
}
