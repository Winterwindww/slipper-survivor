/* 卡表体检（运行时对象版，不用正则解析源码——正则会被多行格式骗）
   ---------------------------------------------------------
   之前这工具查 `SS.relicDef`，而那个方法根本不存在，
   于是"重名 / 空卡 / 越权"三项全是**空跑假绿**。
   现在用的是 __SS.relicTable()（真实导出每件的 own/tags/desc）。

   七项：
     1. 遗物重名
     2. 结晶重名
     3. 公共件引用角色锁定资源（宠物/炮台/怒气/充能/护盾/吞噬/召唤）
     4. 空卡：整份代码里没有任何 relic('id') / R.id 引用
     5. 进化表孤儿条目
     6. 每个角色的专属件数量
     7. 每个角色的专属武器数量（卡池收口之后）
   用法：node tools/cardcheck.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const SRC = path.join(ROOT, 'src');
const allSrc = fs.readdirSync(SRC).filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

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

const SS = boot(1);
SS.start('knight');

let fail = 0;
const bad = (msg) => { fail++; console.log('  ✗ ' + msg); };
const okmsg = (msg) => console.log('  ✓ ' + msg);

const relics = SS.relicTable();
const passives = SS.passiveTable();
const relicIds = relics.map(r => r.id);

/* ---- 1. 重名 ---- */
console.log('1. 遗物重名');
{
  const map = new Map();
  for (const r of relics) { if (!r.name) continue; if(!map.has(r.name)) map.set(r.name, []); map.get(r.name).push(r.id); }
  const dup = [...map.entries()].filter(([, v]) => v.length > 1);
  if (dup.length === 0) okmsg('无重名（' + relics.length + ' 件）');
  else dup.forEach(([n, ids]) => bad('「' + n + '」→ ' + ids.join(', ')));
}
console.log('2. 结晶重名');
{
  const map = new Map();
  for (const p of passives) { if (!p.name) continue; if(!map.has(p.name)) map.set(p.name, []); map.get(p.name).push(p.id); }
  const dup = [...map.entries()].filter(([, v]) => v.length > 1);
  if (dup.length === 0) okmsg('无重名（' + passives.length + ' 个）');
  else dup.forEach(([n, ids]) => bad('「' + n + '」→ ' + ids.join(', ')));
}

/* ---- 3. 公共件引用角色锁定资源 ---- */
console.log('3. 公共件是否引用角色锁定资源');
const LOCK_TAGS = ['pet', 'turret', 'rage', 'charge', 'shield', 'devour', 'summon'];
const violate = [];
for (const r of relics) {
  if (r.own) continue;
  const hit = (r.tags || []).filter(t => LOCK_TAGS.includes(t));
  if (hit.length) violate.push(r.id + '(' + r.name + ':' + hit.join(',') + ')');
}
if (violate.length === 0) okmsg('无违规');
else violate.forEach(v => bad('公共件引用角色资源：' + v));

/* ---- 4. 空卡 ---- */
console.log('4. 空卡（代码里没有任何 relic()/R. 引用）');
const empty = relicIds.filter(id =>
  !allSrc.includes("relic('" + id + "')") && !allSrc.includes('R.' + id));
if (empty.length === 0) okmsg('无空卡');
else empty.forEach(id => bad('空卡：' + id));

/* ---- 5. 进化表 ---- */
console.log('5. 进化表指向真实遗物');
const evo = SS.evoIds();
const orphan = evo.filter(id => !relicIds.includes(id));
if (orphan.length === 0) okmsg(evo.length + ' 条进化，全部有效');
else orphan.forEach(id => bad('进化表孤儿条目：' + id));

/* ---- 6. 每个角色的专属件数量 ---- */
console.log('6. 每个角色的专属遗物数量');
const byChar = {};
for (const r of relics) { if (r.own) byChar[r.own] = (byChar[r.own] || 0) + 1; }
for (const c of ['knight', 'ranger', 'engineer', 'keeper', 'chef']) {
  const n = byChar[c] || 0;
  if (n >= 8) okmsg(c + ' ' + n + ' 件');
  else bad(c + ' 只有 ' + n + ' 件（少于 8）');
}

/* ---- 7. 每个角色实际能抽到的武器 ---- */
console.log('7. 每个角色可抽武器数（开局池）');
for (const c of ['knight', 'ranger', 'engineer', 'keeper', 'chef']) {
  const S = boot(1); S.start(c);
  const pool = S.poolFor();
  if (pool.length >= 8) okmsg(c + ' ' + pool.length + ' 把');
  else bad(c + ' 只有 ' + pool.length + ' 把可抽');
}

console.log('\n结果：' + (fail ? fail + ' 项不通过' : '全部通过'));
process.exit(fail ? 1 : 0);
