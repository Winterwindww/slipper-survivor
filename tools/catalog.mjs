/* 内容总览生成器：直接从游戏内核导出真实数据，生成 markdown
   用法：node tools/catalog.mjs > 游戏内容总览.md
   做法：把 index.html 里 IIFE 的收尾替换成"顺便把数据挂到 window 上"，不改动仓库文件 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

/* 在 IIFE 结束前导出所有数据表 */
const tail = code.lastIndexOf('})();');
if (tail < 0) throw new Error('IIFE tail not found');
const EXPORT = `
window.__CAT = {
  WEAPONS: WEAPONS, MODS: MODS, RELICS: RELICS, PASSIVES: PASSIVES,
  CHARS: CHARS, SCHOOLS: SCHOOLS, LINKS: LINKS, SCHOOL_MECH: SCHOOL_MECH, BALANCE: BALANCE,
  TURRETS: TURRETS, PET_TYPES: PET_TYPES,
  ENEMIES: ENEMIES, BOSSES: BOSSES, RARITY: RARITY,
  MAX_SLOTS: MAX_SLOTS
};
`;
code = code.slice(0, tail) + EXPORT + code.slice(tail);

const els = new Map();
const mkEl = () => ({
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return true; } },
  style: { setProperty(){} }, appendChild(){}, addEventListener(){},
  querySelector(){ return mkEl(); }, textContent: '', innerHTML: '',
  width: 0, height: 0, getContext(){ return new Proxy({}, { get(){ return () => ({ addColorStop(){} }); }, set(){ return true; } }); }
});
const sandbox = {
  console, document: {
    getElementById(id){ if(!els.has(id)) els.set(id, mkEl()); return els.get(id); },
    createElement(){ return mkEl(); }, querySelector(){ return mkEl(); },
    addEventListener(){}, body: mkEl()
  },
  performance: { now: () => 0 }, requestAnimationFrame(){ return 0; },
  cancelAnimationFrame(){}, setTimeout(){ return 0; }, clearTimeout(){},
  setInterval(){ return 0; }, clearInterval(){},
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  innerWidth: 1280, innerHeight: 720, addEventListener(){}, removeEventListener(){}
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: 'catalog.js' });
const C = sandbox.__CAT;

const MOD_NAME = id => (C.MODS[id] ? C.MODS[id].name : id);
const MOD_DESC = id => (C.MODS[id] ? C.MODS[id].desc : '');
const fmt = v => (v === undefined || v === null) ? '—' : (Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString());

const out = [];
const w = s => out.push(s);

/* ---------------- 角色 ---------------- */
w('# 游戏内容总览');
w('');
w('> 本文由 `node tools/catalog.mjs` 从游戏内核直接导出，数值与代码保持一致。');
w('');
w(`共 **${Object.keys(C.CHARS).length} 个角色**、**${Object.keys(C.WEAPONS).length} 把武器**、**${Object.keys(C.MODS).length} 张改造卡**、**${Object.keys(C.RELICS).length} 件遗物**、**${Object.keys(C.PASSIVES).length} 种结晶**、**${Object.keys(C.SCHOOLS).length} 条流派**、**${Object.keys(C.SCHOOL_MECH).length} 条流派机制**、**${Object.keys(C.TURRETS).length} 种炮台**、**${Object.keys(C.PET_TYPES).length} 种宠物**。`);
w('');
w('---');
w('');
w('## 零、核心循环');
w('');
w('```');
w('选角色（决定起点）');
w('   ↓');
w('自动攻击 + 走位躲怪 → 捡经验宝石 → 升级');
w('   ↓');
w('三选一：新武器 / 武器升级 / 改造卡 / 遗物 / 结晶 / 治疗');
w('   ↓');
w('武器 Lv2、Lv4 各选 1 张改造卡 → 同一把武器每局长得不一样');
w('   ↓');
w('武器改造 → 流派机制触发 → 遗物监听事件 → 连锁自己滚起来');
w('   ↓');
w('75s 精英 → 110s 首 BOSS → 2:30 怪潮与场地事件 → 10:00 无尽');
w('```');
w('');
w('一句话：**武器负责"打了一下"，改造卡决定"怎么打"，流派机制与遗物决定"这一下还能引发什么"。**');
w('');
w('---');
w('');
w('## 一、角色');
w('');
w('| 角色 | 生命 | 移速 | 伤害 | 暴击 | 起始武器 | 亲和流派 | 专属机制 |');
w('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const id in C.CHARS) {
  const c = C.CHARS[id];
  const schools = (c.schools || []).map(s => C.SCHOOLS[s] ? C.SCHOOLS[s].name : s).join(' / ');
  const wn = C.WEAPONS[c.weapon] ? C.WEAPONS[c.weapon].name : c.weapon;
  w(`| **${c.name}** | ${c.hp} | ${c.speed} | ×${c.dmg.toFixed(2)} | ${Math.round(c.crit*100)}% | ${wn} | ${schools} | ${c.perkName} |`);
}
w('');
for (const id in C.CHARS) {
  const c = C.CHARS[id];
  w(`- **${c.name}**（${c.title}）：${c.blurb}  \n  **${c.perkName}** — ${c.perkDesc}`);
}
w('');
w('---');
w('');
w('## 二、武器');
w('');
w('| 武器 | 标签 | 伤害构成 | 数量 / 冷却 | 改造卡池 | 觉醒 |');
w('| --- | --- | --- | --- | --- | --- |');
for (const id in C.WEAPONS) {
  const wp = C.WEAPONS[id];
  let s1 = {}, s5 = {};
  try { s1 = wp.stats(1); } catch (e) {}
  try { s5 = wp.stats(Math.min(5, wp.max)); } catch (e) {}
  const dmgTxt = (s1.dmg !== undefined)
    ? `Lv1 ${fmt(s1.dmg)} → Lv5 ${fmt(s5.dmg)}`
    : (wp.continuous ? '持续型（见说明）' : '—');
  const cntTxt = [
    s1.cd !== undefined ? `冷却 ${fmt(s1.cd)}s → ${fmt(s5.cd)}s` : '',
    s1.count !== undefined ? `数量 ${fmt(s1.count)} → ${fmt(s5.count)}` : '',
    s1.radius !== undefined ? `范围 ${fmt(s1.radius)} → ${fmt(s5.radius)}` : '',
    s1.pierce !== undefined ? `穿透 ${fmt(s1.pierce)}` : '',
    s1.jumps !== undefined ? `跳跃 ${fmt(s1.jumps)}` : '',
    s1.bounces !== undefined ? `弹跳 ${fmt(s1.bounces)}` : '',
    s1.tick !== undefined ? `每跳 ${fmt(s1.tick)}s` : ''
  ].filter(Boolean).join('；');
  const mods = (wp.mods || []).map(MOD_NAME).join(' / ');
  const aw = wp.branches
    ? wp.branches.map(b => `**${b.name}**（${b.desc}）`).join(' 或 ')
    : (wp.awaken || '—');
  w(`| **${wp.name}** | ${(wp.tags || []).join('·')} | ${dmgTxt} | ${cntTxt || '—'} | ${mods} | ${aw} |`);
}
w('');
w('### 武器说明');
w('');
for (const id in C.WEAPONS) {
  const wp = C.WEAPONS[id];
  w(`- **${wp.name}**：${wp.blurb}${wp.continuous ? '（持续型，不需要冷却）' : ''}`);
}
w('');
w('---');
w('');
w('## 三、改造卡（' + Object.keys(C.MODS).length + ' 种）');
w('');
w('每把武器有 4 张候选，在 **Lv2 / Lv4** 各选 1 张，永久改变攻击行为；Lv5 觉醒。');
w('');
w('> **分支觉醒**：六个角色的起始武器（飞拖鞋 / 平底锅 / 泡泡糖炮台 / 小狗 / 喷火枪 / 幸运骰子）到 Lv5 时不再只有一种未来，而是**两条路线二选一**，改变的是打法而不是数值。');
w('');
w('| 改造 | 效果 |');
w('| --- | --- |');
for (const id in C.MODS) w(`| **${C.MODS[id].name}** | ${C.MODS[id].desc} |`);
w('');
w('---');
w('');
w('## 四、遗物');
w('');
const RAR_NAME = { common:'普通', rare:'稀有', epic:'史诗', curse:'诅咒' };
for (const rar of ['common','rare','epic','curse']) {
  const list = Object.keys(C.RELICS).filter(k => C.RELICS[k].rar === rar);
  w(`### ${RAR_NAME[rar]}（${list.length} 件）`);
  w('');
  w('| 遗物 | 标签 | 效果 |');
  w('| --- | --- | --- |');
  for (const id of list) {
    const r = C.RELICS[id];
    w(`| **${r.name}** | ${(r.tags || []).join('·')} | ${r.desc} |`);
  }
  w('');
}
w('---');
w('');
w('## 五、数值结晶');
w('');
w('| 结晶 | 上限 | 效果 |');
w('| --- | --- | --- |');
for (const id in C.PASSIVES) {
  const p = C.PASSIVES[id];
  let d = '';
  try { d = p.desc(0, 1); } catch (e) { d = ''; }
  w(`| **${p.name}** | Lv.${p.max} | ${d} |`);
}
w('');
w('---');
w('');
w('## 六、流派与标签共鸣');
w('');
w('### 流派（12 条）：决定卡池往哪边倾斜');
w('');
w('| 流派 | 构成标签 | 打法 |');
w('| --- | --- | --- |');
for (const id in C.SCHOOLS) {
  const s = C.SCHOOLS[id];
  w(`| **${s.name}** | ${s.tags.join('·')} | ${s.desc} |`);
}
w('');
w('### 流派机制（每个流派一条，走事件总线）');
w('');
w('| 联动 | 触发条件 | 效果 |');
w('| --- | --- | --- |');
for (const sid in C.SCHOOL_MECH) {
  const m = C.SCHOOL_MECH[sid];
  w(`| **${m.icon} ${m.name}** | ${C.SCHOOLS[sid] ? C.SCHOOLS[sid].name : sid} | ${m.desc} |`);
}
w('');
w('---');
w('');
const ENEMY_NAME = {
  slime:'果冻', carrot:'胡萝卜', bat:'蝙蝠', shooter:'吐籽射手', bomb:'自爆番茄',
  pudding:'布丁', burger:'汉堡', ghost:'幽灵', frog:'青蛙', bee:'蜜蜂',
  iron:'铁罐兵', ant:'蚂蚁', mushroom:'毒蘑菇'
};
w('## 七、敌人与 BOSS');
w('');
w('| 敌人 | 生命 | 速度 | 半径 | 接触伤害 | 经验 | 行为 |');
w('| --- | --- | --- | --- | --- | --- | --- |');
for (const id in C.ENEMIES) {
  const e = C.ENEMIES[id];
  const ai = { chase:'追击', dash:'冲刺', weave:'绕行', ranged:'远程', kamikaze:'自爆',
    split:'分裂', ghost:'直线加速', hop:'蹦跳', circle:'绕圈俯冲' }[e.ai] || e.ai;
  w(`| ${ENEMY_NAME[id] || id} | ${e.hp} | ${e.spd} | ${e.r} | ${e.dmg} | ${e.xp} | ${ai}${e.poison ? ' + 死后毒雾' : ''}${e.tank ? ' + 高血厚甲' : ''} |`);
}
w('');
w('| BOSS | 生命基数 | 速度 | 半径 | 接触伤害 | 机制 |');
w('| --- | --- | --- | --- | --- | --- |');
for (const id in C.BOSSES) {
  const b = C.BOSSES[id];
  w(`| ${b.name} | ${b.hp} | ${b.spd} | ${b.r} | ${b.dmg} | ${b.tag} |`);
}
w('');
w('---');
w('');
w('## 八、召唤物');
w('');
w('### 炮台（固定部署 · 有存在时间）');
w('');
w('| 炮台 | 生命 | 攻速(秒) | 射程 | 伤害系数 | 攻击方式 |');
w('| --- | --- | --- | --- | --- | --- |');
for (const id in C.TURRETS) {
  const t = C.TURRETS[id];
  const kindName = { bullet:'可见子弹', missile:'追踪火箭 + 爆炸', beam:'穿透激光', chain:'连锁电弧',
    flame:'扇形火焰', mine:'生产地雷', repair:'维修 + 超频' }[t.kind] || t.kind;
  w(`| ${t.name} | ${t.hp} | ${t.rate} | ${t.range} | ×${t.dmg} | ${kindName} |`);
}
w('');
w('### 宠物（围绕主人的小队 · 8 种 AI）');
w('');
w('| 宠物 | 生命 | 速度 | 攻击间隔 | 攻击距离 | 牵引半径 | 行为 |');
w('| --- | --- | --- | --- | --- | --- | --- |');
const pmode = { melee:'近战撕咬', shot:'远程射击', sweep:'近身范围拍击', cone:'扇形喷火',
  chain:'连锁电击', suicide:'冲上去自爆' };
for (const id in C.PET_TYPES) {
  const p = C.PET_TYPES[id];
  w(`| ${p.name} | ${p.hp} | ${p.spd} | ${p.cd} | ${p.range} | ${p.leash} | ${pmode[p.mode] || p.mode} · ${p.role === 'guard' ? '护卫' : (p.role === 'hover' ? '空中游走' : '追击')} |`);
}
w('');
w('---');
w('');
w('## 九、元素与反应');
w('');
w('| 元素 | 效果 |');
w('| --- | --- |');
w('| 燃烧 | 持续伤害（每秒 = 触发伤害 ×30%），火焰色光晕 |');
w('| 冰缓 | 移速降到 34%，冰环视觉 |');
w('| 中毒 | 持续伤害（每秒 = 触发伤害 ×24%），绿色气泡 |');
w('| 感电 | 标记 + 诱发反应，黄色电弧 |');
w('');
w('| 反应 | 组合 | 效果 |');
w('| --- | --- | --- |');
w('| 融化 | 火 + 冰 | 单点 1.15× 触发伤害，周围 55% 溅射 |');
w('| 毒爆 | 火 + 毒 | 范围伤害并把毒传给周围 |');
w('| 超导 | 电 + 冰 | 范围伤害 + 周围冰缓 |');
w('| 导电 | 电 + 毒 | 范围伤害 |');
w('');
w('---');
w('');
w('## 十、节奏与系统');
w('');
w('| 系统 | 数值 / 说明 |');
w('| --- | --- |');
w('| 武器槽 | **按等级解锁：Lv.1 / 4 / 9 / 14 各 +1**（诅咒遗物「献祭」-1），上限 4；**工程师 / 饲养员额外 +2**（6 槽） |');
w('| 升级卡 | 一次三选一；**一次升级最多出一张新武器卡**；槽满后普通池不出新武器 |');
w('| 改造卡时点 | 武器 Lv2、Lv4 各选 1 张（直接进三选一，没有第二层弹窗） |');
w('| 卡池亲和 | 角色亲和 ×1.8~2.0，流派浓度最多 +55% |');
w('| 遗物保底 | 连续 3 次升级没出遗物，第 4 次必出 |');
w('| 三幕 | 0:00 立流派 / 2:30 成型 / 5:30 爆发 / 10:00 终局 |');
w('| 首 BOSS | 110 秒，之后每 78 秒一只 |');
w('| BOSS 血量 | `8.2 × (t/60)^0.97 × (1+0.03×序号)`，**不参考玩家数值** |');
w('| BOSS 力竭 | 战斗超过 **14 秒**后每秒受伤 +14%，最多 +700% |');
w('| 近战对 BOSS | ×1.7（BOSS 会冲刺，近战命中窗口少） |');
w('| 精英 | **75 秒**起，之后每 **55 秒**一只；血量 = BOSS×16%，封顶 28% |');
w('| 怪潮 | 150 秒起每 40–52 秒一次 |');
w('| 场地事件 | 2:30 起每 55 秒：毒雾 / 闪电风暴 / 补给空投 / 精英裂隙 |');
w('| 击杀回血 | 每杀 1 只回 0.08% 最大生命，每秒硬上限 2.5% |');
w('| 愈合结晶 | 每 5 秒回 1.2%/级（独立节奏，不占击杀回血预算） |');
w('| 事件总线 | hit / crit / kill / reaction / boom / dodge / gem / allyDeath / hurt |');
w('| 防爆栈 | 递归 ≤4 层；每帧预算 kill 30 / react 22 / boom 20 / summon 8 |');
w('| 炮台上限 | **每种炮台独立** 2 座（工程师 3 座），满了替换最旧的一座 |');
w('| 宠物上限 | **每种宠物独立** 2 只（饲养员 **4 只**） |');
w('| 小怪血量 | `1 + t×0.012 + (t/60)^2.3×0.16`（前期几乎不变，后期抬升） |');

console.log(out.join('\n'));
