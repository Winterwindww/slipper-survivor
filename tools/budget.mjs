/* 遗物数值预算审计
   ---------------------------------------------------------
   要回答的问题是："把卡全拿满，数值会不会跑出框架？"
   做法：起一局，把 RELICS 里的每一件都塞进去，跑 5 分钟，
        然后看 maxHp / 伤害倍率 / 暴击 / 冷却 的实际量级。
   再逐件做"单独贡献"排序，找出毒瘤件。

   用法：node tools/budget.mjs [--char knight] [--min 5] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const CHAR = arg('char', 'ranger');
const MIN = Number(arg('min', 5));

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

/* ---- 1. 全卡压力测试 ---- */
function fullBuild(minutes) {
  const S = boot(1234);
  S.start(CHAR);
  const ids = Object.keys(S.relicIds ? {} : {});
  // 拿全部遗物
  const all = S.allRelicIds ? S.allRelicIds() : null;
  if (!all) { console.log('缺少 allRelicIds 接口'); process.exit(1); }
  let n = 0;
  for (const id of all) { S.giveRelic(id); n++; }
  S.refresh();
  S.state.mode = 'playing';
  S.state.bossAt = 1e9; S.state.eliteAt = 1e9;
  const rows = [];
  const total = Math.round(minutes * 60);
  for (let i = 0; i < total * 60; i++) {
    if (S.state.mode === 'levelup') S.autoPick();
    S.step(1 / 60);
    if (S.state.mode === 'gameover') break;
    if (i % (60 * 60) === 0) {
      rows.push({ t: Math.round(S.state.time), hp: Math.round(S.P.maxHp), dmg: +S.ST.dmgMul.toFixed(2) });
    }
  }
  return { n, rows, S };
}

const r = fullBuild(MIN);
console.log('=== 全卡压力测试（' + CHAR + '，装了 ' + r.n + ' 件遗物）===');
console.log('时间   最大生命      伤害倍率');
for (const x of r.rows) console.log(String(x.t + 's').padStart(5), String(x.hp).padStart(12), String(x.dmg).padStart(10));
const S = r.S;
console.log('\n最终面板：');
console.log('  maxHp      ', Math.round(S.P.maxHp));
console.log('  dmgMul     ', S.ST.dmgMul.toFixed(2));
console.log('  暴击/爆伤  ', (S.ST.crit * 100).toFixed(0) + '% / ×' + S.ST.critMul.toFixed(2));
console.log('  冷却倍率   ', S.ST.cdMul.toFixed(3));
console.log('  护甲点数   ', Math.round(S.ST.armorPts), '→ 减伤', (S.ST.armor * 100).toFixed(0) + '%');
console.log('  单发伤害×  ', (S.ST.dmgMul * (1 + S.ST.crit * (S.ST.critMul - 1))).toFixed(1), '（按期望折算）');


/* ---- 2. 单件归因：每件遗物单独装上跑 60 秒，看它对面板的实际贡献 ---- */
function attrib(){
  const rows = [];
  const S0 = boot(99); S0.start(CHAR);
  S0.refresh();
  const baseHp = S0.P.maxHp, baseDmg = S0.ST.dmgMul, baseCrit = S0.ST.crit;
  const all = S0.allRelicIds();
  for (const id of all) {
    const S = boot(99);
    S.start(CHAR);
    S.giveRelic(id);
    S.refresh();
    /* 只看"装上瞬间"的面板：跑时间太慢（160 件 × 45 秒），
       而且层数类遗物在 45 秒内本来就长不起来，跑也看不出差别。 */
    S.state.mode = 'playing'; S.state.bossAt = 1e9; S.state.eliteAt = 1e9;
    for (let i = 0; i < 30; i++) S.step(1/60);
    rows.push({
      id,
      hp: S.P.maxHp / baseHp,
      dmg: S.ST.dmgMul / baseDmg,
      crit: S.ST.crit - baseCrit
    });
  }
  rows.sort((a,b) => (b.hp + b.dmg*2) - (a.hp + a.dmg*2));
  console.log('\n=== 单件归因（装上瞬间 vs 空手，层数类必然读 1.00）===');
  console.log('生命×   伤害×   暴击+   遗物');
  for (const r of rows.slice(0, 14)) {
    console.log(r.hp.toFixed(2).padStart(6) + '  ' + r.dmg.toFixed(2).padStart(6) + '  ' +
                (r.crit*100).toFixed(0).padStart(5) + '%   ' + r.id);
  }
}
if (argv.includes('--attrib')) attrib();
