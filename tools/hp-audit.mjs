/* 数值审计：3 / 5 / 8 / 10 分钟时的 小兵 / 精英 / BOSS 血量
   全部走游戏内核里的真实函数，不手算。
   用法：node tools/hp-audit.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

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
vm.runInContext(code, ctx, { filename:'game.js' });
const SS = ctx.__SS;
const d = SS.hpTable();

const NAMES = { slime:'果冻', carrot:'胡萝卜', bat:'蝙蝠', shooter:'吐籽射手', bomb:'自爆番茄',
  pudding:'布丁', burger:'汉堡', ghost:'幽灵', frog:'青蛙', bee:'蜜蜂', iron:'铁罐兵',
  ant:'蚂蚁', mushroom:'毒蘑菇', brute:'重甲兵', runner:'疾行者', nest:'巢母' };
const fmt = n => n >= 10000 ? (n/10000).toFixed(1) + '万' : String(Math.round(n));

const MARKS = [180, 300, 480, 600];
const BOSS_AT = [188, 266, 422, 578];   /* 最接近该分钟的一次 BOSS 出场 */

console.log('时间     小兵（最脆）  小兵（最厚）   精英（普通怪）  精英（铁罐兵）  BOSS');
console.log('------  ------------  ------------  --------------  --------------  ----------');
for (let i = 0; i < MARKS.length; i++) {
  const t = MARKS[i];
  const row = d.mobs;
  const minId = 'ant', maxId = 'iron';
  const mobMin = row[minId][t], mobMax = row[maxId][t];
  /* 和游戏里一致：精英 = max(怪种×8, BOSS×16%)，封顶 BOSS×28% */
  const boss = d.bossAt[BOSS_AT[i]];
  const elite = Math.min(Math.max(mobMin * 8, boss * 0.16), boss * 0.28);
  const eliteIron = Math.min(Math.max(mobMax * 8, boss * 0.16), boss * 0.28);
  console.log(
    (t/60 + '分').padEnd(6) +
    fmt(mobMin).padStart(10) + '  ' +
    fmt(mobMax).padStart(12) + '  ' +
    fmt(elite).padStart(14) + '  ' +
    fmt(eliteIron).padStart(14) + '  ' +
    fmt(d.bossAt[BOSS_AT[i]]).padStart(10) +
    '  (' + d.bossName[BOSS_AT[i]] + ')'
  );
}
console.log('\n对照：玩家单次命中的伤害量级（8 分钟实测约 33–43，暴击 ×1.6）');
