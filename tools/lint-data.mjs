/* 数据表体检：把"写错一个键就让客户端崩"这类问题挡在发布之前。
   - 所有武器的 mods / 分支 mods 必须是 MODS 表里存在的键
   - 所有遗物、结晶、武器的 own 必须是真实角色 id
   - 所有 ARCH 引用必须存在
   用法：node tools/lint-data.mjs */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function block(startMark, endMark = '\n};') {
  const i = html.indexOf(startMark);
  if (i < 0) return '';
  const j = html.indexOf(endMark, i);
  return html.slice(i, j);
}
function keysOf(text) {
  const out = new Set();
  const re = /^ {2}([A-Za-z0-9_]+)\s*:/gm;
  let m;
  while ((m = re.exec(text))) out.add(m[1]);
  return out;
}

let fail = 0;
function report(name, bad) {
  if (bad.length) {
    console.log(`✗ ${name}：${bad.join(' / ')}`);
    fail += bad.length;
  } else {
    console.log(`✓ ${name}`);
  }
}

/* 1. 改造卡键 */
const modsText = block('const MODS = {');
const MODS = keysOf(modsText);
const badMods = new Set();
const reMods = /mods:\s*\[([^\]]*)\]/g;
let mm;
while ((mm = reMods.exec(html))) {
  for (const q of mm[1].matchAll(/'([a-z]+)'/g)) if (!MODS.has(q[1])) badMods.add(q[1]);
}
report('武器 mods 引用的改造卡都存在', [...badMods]);

/* NEUTRAL_MODS 兜底池 */
const nStart = html.indexOf('NEUTRAL_MODS');
const nEnd = html.indexOf(']', nStart);
const badNeutral = [];
for (const q of html.slice(nStart, nEnd).matchAll(/'([a-z]+)'/g)) {
  if (!MODS.has(q[1])) badNeutral.push(q[1]);
}
report('NEUTRAL_MODS 全部合法', badNeutral);

/* 2. 角色 id */
const charsText = block('const CHARS = {');
const CHARS = keysOf(charsText);
report('角色表非空', CHARS.size ? [] : ['CHARS 解析失败']);

/* 3. own 归属指向真实角色 */
const badOwn = [];
for (const q of html.matchAll(/own\s*:\s*'([a-z]+)'/g)) {
  if (!CHARS.has(q[1])) badOwn.push(q[1]);
}
report('遗物/结晶的 own 都是真实角色', [...new Set(badOwn)]);

/* 4. WEAPON_OWNER 指向真实角色 */
const ownerText = block('const WEAPON_OWNER = {');
const badOwner = [];
for (const q of ownerText.matchAll(/'([a-z]+)'/g)) {
  if (!CHARS.has(q[1])) badOwner.push(q[1]);
}
report('专属武器归属都是真实角色', [...new Set(badOwner)]);

/* 5. CHAR_ROUTES 里的流派都存在 */
const archIdsText = html.match(/const ARCH_IDS = \[([^\]]*)\]/);
const ARCH_IDS = archIdsText ? [...archIdsText[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]) : [];
const routesText = block('const CHAR_ROUTES = {');
const badRoute = [];
for (const q of routesText.matchAll(/'([a-z]+)'/g)) {
  const id = q[1];
  if (CHARS.has(id)) continue;                       /* 角色 id */
  if (!ARCH_IDS.includes(id)) badRoute.push(id);     /* 否则必须是流派 */
}
report('CHAR_ROUTES 引用的流派都存在', [...new Set(badRoute)]);

/* 6. 专属武器 / 遗物 / 结晶：每个角色至少各 1 */
const WEAPONS_BLOCK = ownerText;
const perChar = {};
for (const c of CHARS) perChar[c] = { w: 0, r: 0, c: 0 };
for (const q of WEAPONS_BLOCK.matchAll(/:\s*'([a-z]+)'/g)) {
  if (perChar[q[1]]) perChar[q[1]].w++;
}
const relicOwn = html.match(/const RELICS = \{[\s\S]*?\n\};/);
const passOwn = html.match(/const PASSIVES = \{[\s\S]*?\n\};/);
for (const seg of [relicOwn, passOwn]) {
  if (!seg) continue;
  for (const line of seg[0].split('\n')) {
    const m = line.match(/own\s*:\s*'([a-z]+)'/);
    if (!m || !perChar[m[1]]) continue;
    if (seg === relicOwn) perChar[m[1]].r++;
    else perChar[m[1]].c++;
  }
}
const noContent = [];
for (const c of CHARS) {
  const v = perChar[c];
  if (v.w + v.r + v.c === 0) noContent.push(c);
}
report('每个角色都有专属内容', noContent);
console.log('  专属数量：' + Object.entries(perChar).map(([k, v]) => `${k} 武器${v.w}/遗物${v.r}/结晶${v.c}`).join('  '));

/* 7. 每把有专属归属的武器必须真的存在于 WEAPONS */
const weaponsBlock = html.match(/const WEAPONS = \{[\s\S]*?\n\};/);
if (weaponsBlock) {
  const badWeap = [];
  for (const q of ownerText.matchAll(/^ {2}([a-z0-9_]+)\s*:/gm)) {
    if (!new RegExp('\\b' + q[1] + '\\s*:\\s*\\{').test(html)) badWeap.push(q[1]);
  }
  report('专属武器都真实存在', badWeap);
}

console.log(fail === 0 ? '\n数据表体检通过' : `\n数据表体检失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
