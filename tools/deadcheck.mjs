/* 死代码/无效数值扫描：
   1) ST 的每个字段是否真的被用到
   2) relicStat 的每个字段是否真的被用到
   3) MODS 的每张卡是否有实现（在 dealDamage / addBullet / 武器里是否被读）
   用法：node tools/deadcheck.mjs */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const files = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js'));
const src = {};
for (const f of files) src[f] = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
const all = Object.values(src).join('\n');

function fieldsOf(block) {
  const out = [];
  for (const m of block.matchAll(/^\s{2,4}([a-zA-Z][a-zA-Z0-9]*):/gm)) out.push(m[1]);
  return [...new Set(out)];
}
function bodyOf(text, startMarker, endMarker) {
  const i = text.indexOf(startMarker);
  if (i < 0) return '';
  const j = text.indexOf(endMarker, i);
  return text.slice(i, j > 0 ? j : text.length);
}

const stBody = bodyOf(src['50-state.js'], 'function getStats(){', '\n}');
const stFields = fieldsOf(stBody);
const relicBody = bodyOf(src['44-relics.js'], 'function relicStat(){', '\n}');
const relicFields = fieldsOf(relicBody);

function usedElsewhere(name, exclude) {
  let n = 0;
  for (const f in src) {
    if (f === exclude) continue;
    const re = new RegExp('[.$]' + name + '\\b', 'g');
    n += (src[f].match(re) || []).length;
  }
  return n;
}

console.log('=== ST 字段（50-state 之外的使用次数）===');
const stDead = [];
for (const k of stFields) {
  const n = usedElsewhere(k, '50-state.js');
  if (n === 0) stDead.push(k);
}
console.log(stDead.length ? '未被使用：' + stDead.join(', ') : '全部有使用');

console.log('\n=== relicStat 字段（44-relics 之外的使用次数）===');
const rDead = [];
for (const k of relicFields) {
  const n = usedElsewhere(k, '44-relics.js');
  if (n === 0) rDead.push(k);
}
console.log(rDead.length ? '未被使用：' + rDead.join(', ') : '全部有使用');

console.log('\n=== 改造卡实现检查 ===');
const modsBody = bodyOf(src['42-weapons.js'], 'const MODS = {', '\n};');
const modIds = [...modsBody.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map(m => m[1]);
const modDead = [];
for (const id of modIds) {
  /* 在事件/武器代码里是否被 hasMod('x') 或 modElems 之类读到 */
  const hits = (all.match(new RegExp("'" + id + "'", 'g')) || []).length;
  /* 只出现在 MODS 表和 pools 里 = 没实现 */
  const logic = (all.match(new RegExp("hasMod\\([^)]*'" + id + "'|mods?\\[[^\\]]*'" + id + "'|=== ?'" + id + "'", 'g')) || []).length;
  if (logic === 0) modDead.push(id + '(引用' + hits + ')');
}
console.log(modDead.length ? '无逻辑实现：' + modDead.join(', ') : '全部有逻辑');

console.log('\n=== 遗物效果检查 ===');
const relBody = bodyOf(src['44-relics.js'], 'const RELICS = {', '\n};');
const relIds = [...relBody.matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map(m => m[1]);
const relDead = [];
for (const id of relIds) {
  /* 在 initRelics 里是否被 relic('x') 读到（注册了监听） */
  const n = (all.match(new RegExp("relic\\('" + id + "'\\)", 'g')) || []).length;
  const inStat = (relicBody.match(new RegExp('R\\.' + id + '\\b', 'g')) || []).length;
  if (n === 0 && inStat === 0) relDead.push(id);
}
console.log(relDead.length ? '没有任何实现：' + relDead.join(', ') : '全部有实现');
