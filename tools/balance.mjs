/* 批量平衡测试：多种子 × 多角色，输出存活分布与构筑摘要
   用法：node tools/balance.mjs --minutes 10 --seeds 4 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const MIN = Number(arg('minutes', 10));
const SEEDS = Number(arg('seeds', 4));
const CHARS = (arg('chars', 'ranger,knight,engineer,keeper,chef')).split(',');
const ROOT = path.resolve(import.meta.dirname, '..');

const rows = [];
for (const ch of CHARS) {
  for (let s = 0; s < SEEDS; s++) {
    const seed = 1000 + s * 4211;
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools/sim.mjs'),
      '--minutes', String(MIN), '--runs', '1', '--char', ch, '--seed', String(seed), '--json'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const r = JSON.parse(out)[0];
    rows.push({ ch, seed, t: r.gameOverAt || r.snap.time, ...r.snap, dead: !!r.gameOverAt });
  }
}

const byChar = {};
for (const r of rows) (byChar[r.ch] = byChar[r.ch] || []).push(r.t);
console.log('角色        中位存活   最快   最慢   平均   阵亡率');
for (const ch of CHARS) {
  const a = byChar[ch].slice().sort((x, y) => x - y);
  const med = a[Math.floor(a.length / 2)];
  const avg = a.reduce((x, y) => x + y, 0) / a.length;
  const dead = rows.filter(r => r.ch === ch && r.dead).length;
  console.log(`${ch.padEnd(10)} ${med.toFixed(0).padStart(6)}s ${a[0].toFixed(0).padStart(7)}s ${a[a.length-1].toFixed(0).padStart(7)}s ${avg.toFixed(0).padStart(7)}s ${(dead/SEEDS*100).toFixed(0).padStart(5)}%`);
}
const all = rows.map(r => r.t).sort((x, y) => x - y);
const pct = p => all[Math.min(all.length - 1, Math.floor(all.length * p))];
console.log(`\n全体分位：P25 ${pct(0.25).toFixed(0)}s · P50 ${pct(0.5).toFixed(0)}s · P75 ${pct(0.75).toFixed(0)}s`);
console.log('BOSS 击杀中位：' + rows.map(r => r.bossKills).sort((a,b)=>a-b)[Math.floor(rows.length/2)]);
console.log('\n典型构筑（每角色最后一局）：');
for (const ch of CHARS) {
  const r = rows.filter(x => x.ch === ch).pop();
  console.log(`  ${ch}: ${Object.entries(r.weapons).map(([k,v])=>k+'L'+v).join(' ')} | 遗物${r.relics.length} | ${(r.schools||[]).join(',')} | Lv${r.level}`);
}
