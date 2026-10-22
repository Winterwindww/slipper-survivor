/* 可玩性体检：6 角色 × N 种子，跑满时长，按硬指标判定能不能上线
   用法：node tools/health.mjs --minutes 7 --seeds 2 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const MIN = Number(arg('minutes', 7));
const SEEDS = Number(arg('seeds', 2));
const CHARS = ['ranger','knight','engineer','keeper','chef'];
const ROOT = path.resolve(import.meta.dirname, '..');

const rows = [];
for (const ch of CHARS) {
  for (let s = 0; s < SEEDS; s++) {
    const seed = 1000 + s * 4211;
    let r;
    try {
      const out = execFileSync(process.execPath, [path.join(ROOT, 'tools/sim.mjs'),
        '--minutes', String(MIN), '--runs', '1', '--char', ch, '--seed', String(seed), '--json'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 180000 });
      r = JSON.parse(out)[0];
    } catch (e) {
      console.log(`FAIL ${ch} seed${seed}: 模拟崩溃 ${e.message.slice(0, 120)}`);
      rows.push({ ch, seed, crashed: true, t: 0 });
      continue;
    }
    rows.push({
      ch, seed,
      t: r.gameOverAt || r.snap.time,
      lv: r.snap.level,
      kills: r.snap.kills,
      weapons: Object.keys(r.snap.weapons).length,
      boss: r.snap.bossKills,
      enemies: r.snap.enemies,
      hp: r.snap.hp, maxHp: r.snap.maxHp,
      enemyPeak: r.peaks ? r.peaks.enemies : 0
    });
  }
}

const full = MIN * 60;
console.log('角色       种子   存活    等级  击杀   武器  BOSS  峰值敌人');
for (const r of rows) {
  if (r.crashed) continue;
  console.log(`${r.ch.padEnd(9)} ${String(r.seed).padStart(5)} ${String(Math.round(r.t)).padStart(5)}s ${String(r.lv).padStart(4)} ${String(r.kills).padStart(6)} ${String(r.weapons).padStart(4)} ${String(r.boss).padStart(5)} ${String(r.enemyPeak).padStart(8)}`);
}

/* ---- 硬指标 ---- */
const fails = [];
const ok = rows.filter(r => !r.crashed);
if (ok.length !== rows.length) fails.push('有模拟崩溃');

while (ok.length < rows.length) ok.push({ t: 0 });

for (const r of ok) {
  if (r.t < 150) fails.push(`${r.ch} 存活 ${Math.round(r.t)}s < 150s（太容易死）`);
  if (r.weapons < 2) fails.push(`${r.ch} 只有 ${r.weapons} 把武器（构筑没跑起来）`);
  if (r.enemyPeak > 420) fails.push(`${r.ch} 敌人峰值 ${r.enemyPeak}（性能风险）`);
}
const med = {};
for (const ch of CHARS) {
  const a = ok.filter(r => r.ch === ch).map(r => r.t).sort((x,y)=>x-y);
  if (a.length) med[ch] = a[Math.floor(a.length/2)];
}
const vals = Object.values(med);
const lo = Math.min(...vals), hi = Math.max(...vals);
if (hi / Math.max(1, lo) > 2.2) fails.push(`角色差距过大：最弱 ${Math.round(lo)}s / 最强 ${Math.round(hi)}s`);

console.log('\n角色中位：' + Object.entries(med).map(([k,v]) => `${k} ${Math.round(v)}s`).join(' · '));
console.log(fails.length ? '\n未通过：\n - ' + fails.join('\n - ') : '\n体检通过：可以上线');
process.exit(fails.length ? 1 : 0);
